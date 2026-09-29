import { Container, Graphics } from 'pixi.js'
import { PAL, type Particles } from './Particles'

export type DummyStatus = 'burn' | 'wet' | 'frozen' | 'electrified' | 'stunned' | 'gust' | 'earth'

const STATUS_LIST: DummyStatus[] = ['burn', 'wet', 'frozen', 'electrified', 'stunned', 'gust', 'earth']

const C = {
  post: 0x7a4a2a,
  postSh: 0x55321c,
  straw: 0xe3c066,
  strawSh: 0xb8913f,
  rope: 0x8a6a3a,
  sack: 0xe8d7b0,
  sackSh: 0xc4b089,
  red: 0xd8323c,
  white: 0xf5f1e6,
  outline: 0x2a1a10,
}

export interface HitOptions {
  knock?: number
  lift?: number
  status?: DummyStatus[]
  statusMs?: number
}

/** 程序化像素训练稻草人 */
export class Dummy extends Container {
  readonly rig = new Container()
  readonly body = new Graphics()
  readonly overlay = new Graphics()
  readonly hpBar = new Graphics()
  readonly maxHp = 600
  hp = 600
  private particles: Particles
  private status = new Map<DummyStatus, number>()
  /** 焦黑程度 0~1 */
  char = 0
  private ang = 0
  private angV = 0
  private offX = 0
  private offV = 0
  private liftY = 0
  private liftV = 0
  private airborne = false
  private broken = false
  private respawn = 0
  private riseY = 0
  private t = 0
  private emitAcc = 0
  private hpShown = 600
  homeX = 0
  homeY = 0
  onDestroyed: () => void = () => {}
  onLand: (x: number, y: number) => void = () => {}

  constructor(particles: Particles) {
    super()
    this.particles = particles
    this.rig.addChild(this.body, this.overlay)
    this.body.scale.set(2)
    this.overlay.scale.set(2)
    this.addChild(this.rig, this.hpBar)
    this.draw()
  }

  get isDestroyed(): boolean {
    return this.broken
  }

  has(s: DummyStatus): boolean {
    return (this.status.get(s) ?? 0) > 0
  }

  statuses(): DummyStatus[] {
    return STATUS_LIST.filter((s) => this.has(s))
  }

  setStatus(s: DummyStatus, ms: number): void {
    this.status.set(s, Math.max(this.status.get(s) ?? 0, ms))
    if (s === 'wet') this.status.delete('burn')
    if (s === 'burn') this.status.delete('frozen')
  }

  clearStatus(s: DummyStatus): void {
    this.status.delete(s)
  }

  /** 身体中心的世界坐标 */
  center(): { x: number; y: number } {
    return { x: this.x + this.offX, y: this.y - 40 - this.liftY + this.riseY }
  }

  head(): { x: number; y: number } {
    return { x: this.x + this.offX, y: this.y - 64 - this.liftY + this.riseY }
  }

  feet(): { x: number; y: number } {
    return { x: this.x + this.offX, y: this.y }
  }

  hit(damage: number, o: HitOptions = {}): void {
    if (this.broken) return
    this.hp = Math.max(0, this.hp - damage)
    this.angV += (Math.random() * 0.3 + 0.2) * (1 + damage / 40)
    if (o.knock) this.offV += o.knock * 60
    if (o.lift) {
      this.liftV = Math.max(this.liftV, o.lift * 60)
      this.airborne = true
    }
    for (const s of o.status ?? []) this.setStatus(s, o.statusMs ?? 3500)
    if (this.hp <= 0) this.destroy_()
  }

  private destroy_(): void {
    this.broken = true
    this.rig.visible = false
    const c = this.center()
    // 碎片飞散
    this.particles.emit({ x: c.x, y: c.y, count: 40, spreadX: 10, spreadY: 24, speed: 140, gravity: 380, life: 1200, size: 3, sizeVar: 1, colors: [C.straw, C.strawSh, C.post], fade: false })
    this.particles.emit({ x: c.x, y: c.y, count: 30, spreadX: 14, speed: 40, life: 1200, size: 6, endSize: 12, colors: PAL.smoke, alpha: 0.7 })
    this.respawn = 2600
    this.status.clear()
    this.onDestroyed()
  }

  update(dt: number): void {
    this.t += dt
    const sec = dt / 1000
    for (const [k, v] of this.status) {
      const nv = v - dt
      if (nv <= 0) this.status.delete(k)
      else this.status.set(k, nv)
    }

    if (this.broken) {
      this.respawn -= dt
      if (this.respawn <= 0) {
        this.broken = false
        this.hp = this.maxHp
        this.char = 0
        this.rig.visible = true
        this.riseY = 70
        this.offX = this.offV = this.liftY = this.liftV = 0
      }
    }
    // 重新站起
    if (this.riseY > 0) this.riseY = Math.max(0, this.riseY - sec * 120)

    // 摇晃弹簧
    const idleSway = Math.sin(this.t / 700) * 0.02
    this.angV += (-this.ang * 60 - this.angV * 6) * sec
    this.ang += this.angV * sec
    // 击退弹簧（缓慢回到原位）
    this.offV += (-this.offX * 8 - this.offV * 4) * sec
    this.offX += this.offV * sec
    this.offX = Math.max(-40, Math.min(70, this.offX))
    // 击飞
    if (this.airborne) {
      this.liftV -= 520 * sec
      this.liftY += this.liftV * sec
      if (this.liftY <= 0) {
        this.liftY = 0
        this.airborne = false
        if (this.liftV < -120) {
          this.onLand(this.x + this.offX, this.y)
          this.liftV = -this.liftV * 0.25
          if (this.liftV > 40) this.airborne = true
        }
        this.liftV = 0
      }
    }

    const stunned = this.has('stunned') || this.has('frozen')
    this.rig.rotation = stunned ? 0 : this.ang + idleSway + (this.airborne ? this.liftY * 0.01 : 0)
    this.rig.x = Math.round(this.offX)
    this.rig.y = Math.round(-this.liftY + this.riseY)

    if (this.has('burn')) this.char = Math.min(1, this.char + sec * 0.25)
    this.applyTint()
    this.emitStatusParticles(dt)
    this.drawOverlay()
    this.drawHp(dt)
  }

  private applyTint(): void {
    let tint = lerpColor(0xffffff, 0x4a3a30, this.char * 0.8)
    if (this.has('wet')) tint = mulColor(tint, 0xa9c8ff)
    if (this.has('frozen')) tint = mulColor(tint, 0xbff4ff)
    if (this.has('electrified') && Math.random() < 0.35) tint = Math.random() < 0.5 ? 0xffffff : 0x9fe8ff
    this.body.tint = tint
  }

  private emitStatusParticles(dt: number): void {
    if (this.broken) return
    this.emitAcc += dt
    if (this.emitAcc < 50) return
    this.emitAcc = 0
    const c = this.center()
    if (this.has('burn')) {
      this.particles.emit({ x: c.x, y: c.y + 6, count: 3, spreadX: 10, spreadY: 14, angle: -Math.PI / 2, arc: 0.6, speed: 40, life: 500, size: 3, endSize: 1, colors: PAL.fire, add: true })
      if (Math.random() < 0.3) this.particles.emit({ x: c.x, y: c.y - 20, count: 1, spreadX: 6, angle: -Math.PI / 2, arc: 0.4, speed: 20, life: 1400, size: 3, endSize: 8, colors: PAL.smoke, alpha: 0.5 })
    } else if (this.char > 0.2 && Math.random() < 0.2) {
      this.particles.emit({ x: c.x, y: c.y - 20, count: 1, spreadX: 6, angle: -Math.PI / 2, arc: 0.4, speed: 15, life: 1400, size: 2, endSize: 6, colors: PAL.smoke, alpha: 0.35 })
    }
    if (this.has('wet') && Math.random() < 0.5) {
      this.particles.emit({ x: c.x, y: c.y + 10, count: 1, spreadX: 10, angle: Math.PI / 2, arc: 0.1, speed: 10, gravity: 300, life: 500, size: 1, colors: PAL.water })
    }
    if (this.has('electrified') && Math.random() < 0.5) {
      this.particles.emit({ x: c.x, y: c.y, count: 2, spreadX: 12, spreadY: 20, speed: 60, life: 150, size: 1, colors: PAL.elec, add: true, stretch: 0.05 })
    }
  }

  private drawOverlay(): void {
    const g = this.overlay
    g.clear()
    if (this.broken) return
    if (this.has('electrified')) {
      // 电弧残留
      for (let k = 0; k < 2; k++) {
        let x = -7 + Math.random() * 3, y = -30 + Math.random() * 4
        g.moveTo(x, y)
        for (let i = 0; i < 5; i++) {
          x += 2 + Math.random() * 2
          y += (Math.random() - 0.3) * 5
          g.lineTo(x, y)
        }
        g.stroke({ width: 1, color: 0xdff9ff, alpha: 0.9 })
      }
    }
    if (this.has('frozen')) {
      g.rect(-8, -30, 16, 20).fill({ color: 0xbff4ff, alpha: 0.35 })
      g.rect(-6, -28, 2, 8).fill({ color: 0xffffff, alpha: 0.6 })
    }
    if (this.has('stunned')) {
      const a = this.t / 200
      for (let i = 0; i < 3; i++) {
        const ang = a + (i * Math.PI * 2) / 3
        g.rect(Math.round(Math.cos(ang) * 7) - 1, -40 + Math.round(Math.sin(ang) * 2), 2, 2).fill(0xffe066)
      }
    }
  }

  private drawHp(dt: number): void {
    const g = this.hpBar
    g.clear()
    if (this.broken) return
    this.hpShown += (this.hp - this.hpShown) * Math.min(1, dt / 300)
    const w = 40
    const x = Math.round(this.offX - w / 2)
    const y = Math.round(-84 - this.liftY + this.riseY)
    g.rect(x - 1, y - 1, w + 2, 5).fill(0x000000)
    g.rect(x, y, w, 3).fill(0x3a1a1a)
    g.rect(x, y, Math.round((w * this.hpShown) / this.maxHp), 3).fill(0xffd23f)
    g.rect(x, y, Math.round((w * this.hp) / this.maxHp), 3).fill(0xff4d4d)
  }

  private draw(): void {
    const g = this.body
    const px = (x: number, y: number, w: number, h: number, c: number) => g.rect(x, y, w, h).fill(c)
    // 底座
    px(-8, -2, 16, 2, C.postSh)
    px(-6, -3, 12, 1, C.post)
    // 立柱
    px(-1, -26, 3, 24, C.post)
    px(1, -26, 1, 24, C.postSh)
    // 横杆手臂
    px(-13, -25, 26, 2, C.post)
    px(-15, -27, 3, 6, C.straw)
    px(12, -27, 3, 6, C.straw)
    px(-16, -26, 1, 4, C.strawSh)
    px(15, -26, 1, 4, C.strawSh)
    // 稻草身体
    px(-6, -29, 12, 18, C.straw)
    px(-7, -27, 1, 14, C.strawSh)
    px(6, -27, 1, 14, C.strawSh)
    for (let i = 0; i < 6; i++) px(-5 + i * 2, -28, 1, 16, C.strawSh)
    px(-6, -23, 12, 1, C.rope)
    px(-6, -15, 12, 1, C.rope)
    // 靶心
    px(-3, -22, 6, 6, C.white)
    px(-2, -21, 4, 4, C.red)
    px(-1, -20, 2, 2, C.white)
    // 下摆
    px(-5, -11, 2, 3, C.strawSh)
    px(-1, -11, 2, 2, C.straw)
    px(3, -11, 2, 3, C.strawSh)
    // 头（麻袋）
    px(-5, -37, 10, 8, C.sack)
    px(-4, -38, 8, 1, C.sack)
    px(3, -36, 2, 7, C.sackSh)
    px(-5, -30, 10, 1, C.rope)
    px(-3, -35, 2, 2, C.outline)
    px(1, -35, 2, 2, C.outline)
    px(-2, -32, 4, 1, C.outline)
    px(-1, -40, 2, 2, C.rope)
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t)
}

function mulColor(a: number, b: number): number {
  const r = (((a >> 16) & 255) * ((b >> 16) & 255)) / 255
  const g = (((a >> 8) & 255) * ((b >> 8) & 255)) / 255
  const bl = ((a & 255) * (b & 255)) / 255
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl)
}
