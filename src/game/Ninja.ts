import { Container, Graphics } from 'pixi.js'

export type NinjaPose =
  | 'idle' | 'seal' | 'charge' | 'cast' | 'attack' | 'ult'
  | 'tired' | 'success' | 'fail' | 'dash' | 'jump' | 'kick'

const C = {
  outline: 0x15121f,
  hair: 0x2a2342,
  hairHi: 0x3d3560,
  skin: 0xf2c29b,
  skinSh: 0xd49a78,
  band: 0x2d4f9e,
  metal: 0xd5dce8,
  suit: 0x27335e,
  suitHi: 0x3d4f8a,
  belt: 0x151a30,
  scarf: 0xd8323c,
  scarfSh: 0x9c1f2c,
  pants: 0x2b2b3d,
  shoe: 0x121218,
}

interface PoseDef {
  lean: number
  crouch: number
  legs: 'stand' | 'wide' | 'crouch' | 'tuck' | 'kick'
  front: [number, number]
  back: [number, number]
  headDrop: number
}

const POSES: Record<NinjaPose, (f: number) => PoseDef> = {
  idle: (f) => ({ lean: 0, crouch: f % 2, legs: 'stand', front: [4, -9 + (f % 2)], back: [-4, -9 + (f % 2)], headDrop: 0 }),
  seal: (f) => ({ lean: 0, crouch: 0, legs: 'stand', front: [5, -14 + (f % 2)], back: [4, -13 + (f % 2)], headDrop: 0 }),
  charge: (f) => ({ lean: 0, crouch: 2, legs: 'crouch', front: [5, -13 + (f % 2)], back: [4, -12], headDrop: 0 }),
  cast: () => ({ lean: 1, crouch: 1, legs: 'wide', front: [11, -15], back: [5, -12], headDrop: 0 }),
  attack: () => ({ lean: 2, crouch: 1, legs: 'wide', front: [12, -14], back: [-5, -12], headDrop: 0 }),
  ult: (f) => ({ lean: 1, crouch: 2, legs: 'wide', front: [11, -16 + (f % 2)], back: [10, -13 + (f % 2)], headDrop: 0 }),
  tired: (f) => ({ lean: 2, crouch: 2, legs: 'crouch', front: [4, -6 + (f % 2)], back: [0, -6], headDrop: 1 }),
  success: (f) => ({ lean: 0, crouch: 0, legs: 'stand', front: [4, -29 + (f % 2)], back: [-4, -10], headDrop: 0 }),
  fail: () => ({ lean: 1, crouch: 1, legs: 'stand', front: [2, -7], back: [-2, -7], headDrop: 1 }),
  dash: () => ({ lean: 4, crouch: 3, legs: 'wide', front: [9, -13], back: [-8, -12], headDrop: 0 }),
  jump: () => ({ lean: 0, crouch: 0, legs: 'tuck', front: [5, -18], back: [-5, -18], headDrop: 0 }),
  kick: () => ({ lean: -2, crouch: 0, legs: 'kick', front: [-2, -18], back: [-6, -14], headDrop: 0 }),
}

/** 程序化绘制的像素忍者（8~12 FPS 逐帧动画） */
export class Ninja extends Container {
  readonly aura = new Graphics()
  readonly body = new Graphics()
  pose: NinjaPose = 'idle'
  chakra = 0
  private frame = 0
  private frameTime = 0
  private poseTimer = 0
  private holdPose: NinjaPose = 'idle'
  private drawn = ''
  private tintTimer = 0
  private auraT = 0
  baseX = 0
  baseY = 0
  facing: 1 | -1 = 1
  ghost = false

  constructor(scale = 2) {
    super()
    this.addChild(this.aura, this.body)
    this.body.scale.set(scale)
    this.aura.scale.set(scale)
  }

  /** 播放姿势；ms 后回到 hold 姿势 */
  play(pose: NinjaPose, ms = 0, hold: NinjaPose = 'idle'): void {
    this.pose = pose
    this.poseTimer = ms
    this.holdPose = hold
    this.frame = 0
  }

  setHold(pose: NinjaPose): void {
    this.holdPose = pose
    if (this.poseTimer <= 0) this.pose = pose
  }

  flashChakra(): void {
    this.tintTimer = 120
  }

  /** 相对脚底的局部点 → 世界坐标 */
  point(lx: number, ly: number): { x: number; y: number } {
    const s = this.body.scale.x
    return { x: this.x + lx * s * this.facing, y: this.y + ly * s }
  }

  mouth(): { x: number; y: number } {
    return this.point(6, -21)
  }

  hand(): { x: number; y: number } {
    const p = POSES[this.pose](this.frame)
    return this.point(p.front[0] + p.lean, p.front[1] + p.crouch)
  }

  update(dt: number): void {
    this.frameTime += dt
    const fps = this.pose === 'idle' ? 3 : 10
    if (this.frameTime > 1000 / fps) {
      this.frameTime = 0
      this.frame++
    }
    if (this.poseTimer > 0) {
      this.poseTimer -= dt
      if (this.poseTimer <= 0) this.pose = this.holdPose
    }
    if (this.tintTimer > 0) {
      this.tintTimer -= dt
      this.body.tint = this.tintTimer > 0 ? 0x9fd8ff : 0xffffff
    }
    this.body.scale.x = Math.abs(this.body.scale.x) * this.facing
    this.aura.scale.x = Math.abs(this.aura.scale.x) * this.facing
    const key = `${this.pose}:${this.frame % 2}`
    if (key !== this.drawn) {
      this.drawn = key
      this.redraw()
    }
    this.auraT += dt
    this.drawAura()
  }

  private drawAura(): void {
    const g = this.aura
    g.clear()
    const lv = this.chakra
    if (lv <= 0) return
    const pulse = Math.sin(this.auraT / 120) * 0.5 + 0.5
    const w = 9 + Math.min(lv, 8) * 1.2 + pulse
    const alpha = Math.min(0.9, 0.25 + lv * 0.08)
    g.ellipse(0, 0, w, 2.5 + lv * 0.2).stroke({ width: 1, color: 0x6fd0ff, alpha })
    if (lv >= 3) g.ellipse(0, 0, w - 3, 1.5).fill({ color: 0x3a7dff, alpha: alpha * 0.5 })
    if (lv >= 5) {
      // 查克拉火焰：身体周围的蓝色气场
      const h = 30 + lv * 1.5 + pulse * 2
      g.ellipse(0, -h / 2 + 2, 9 + lv * 0.6, h / 2).fill({ color: 0x4fb4ff, alpha: 0.12 + lv * 0.015 })
    }
    if (lv >= 7) g.ellipse(0, -16, 16 + pulse * 2, 22 + pulse * 2).stroke({ width: 1, color: 0xbfe6ff, alpha: 0.6 })
  }

  private redraw(): void {
    const g = this.body
    g.clear()
    const p = POSES[this.pose](this.frame)
    const px = (x: number, y: number, w: number, h: number, c: number) => {
      g.rect(x, y, w, h).fill(c)
    }
    const cr = p.crouch
    const L = p.lean
    const f = this.frame % 2

    // 腿
    const leg = (x0: number, x1: number, top: number) => {
      const len = Math.max(3, -top)
      for (let i = 0; i < len; i++) {
        const t = i / (len - 1)
        const x = Math.round(x0 + (x1 - x0) * t)
        px(x - 1, top + i, 3, 1, C.pants)
      }
      px(Math.round(x1) - 1, -1, 4, 1, C.shoe)
      px(Math.round(x1) - 1, -2, 3, 1, C.shoe)
    }
    const hip = -8 + cr
    switch (p.legs) {
      case 'stand': leg(-2 + L * 0.3, -2, hip); leg(2 + L * 0.3, 2, hip); break
      case 'wide': leg(-2 + L * 0.5, -5, hip); leg(2 + L * 0.5, 5, hip); break
      case 'crouch': leg(-2 + L * 0.5, -4, hip); leg(2 + L * 0.5, 4, hip); break
      case 'tuck':
        px(-3, hip, 3, 4, C.pants); px(1, hip, 3, 4, C.pants)
        px(-3, hip + 4, 3, 1, C.shoe); px(2, hip + 3, 3, 1, C.shoe)
        break
      case 'kick':
        leg(-1, -2, hip)
        for (let i = 0; i < 9; i++) px(1 + i, hip - Math.round(i * 0.8), 3, 2, C.pants)
        px(10, hip - 9, 3, 3, C.shoe)
        break
    }

    const tx = -4 + L
    const ty = -17 + cr
    // 围巾飘带（身后）
    const wave = f ? 1 : 0
    px(tx - 4, ty + 1 + wave, 4, 2, C.scarf)
    px(tx - 7, ty + 2 - wave, 3, 2, C.scarfSh)

    // 后手臂
    this.arm(g, tx + 1, ty + 2, p.back[0] + L * 0.5, p.back[1] + cr, C.suit)

    // 躯干
    px(tx, ty, 8, 9, C.suit)
    px(tx + 6, ty + 1, 2, 7, C.suitHi)
    px(tx, ty + 7, 8, 1, C.belt)
    px(tx - 1, ty, 1, 9, C.outline)
    px(tx + 8, ty, 1, 9, C.outline)
    // 围巾
    px(tx - 1, ty - 1, 10, 2, C.scarf)
    px(tx - 1, ty, 10, 1, C.scarfSh)

    // 头
    const hx = -4 + L
    const hy = -26 + cr + p.headDrop
    px(hx, hy, 9, 8, C.skin)
    px(hx, hy + 6, 2, 2, C.skinSh)
    // 头发
    px(hx - 1, hy - 2, 10, 3, C.hair)
    px(hx - 1, hy, 4, 6, C.hair)
    px(hx - 3, hy - 1, 2, 2, C.hair)
    px(hx - 4, hy + 1, 3, 2, C.hair)
    px(hx + 2, hy - 3, 2, 1, C.hair)
    px(hx + 5, hy - 3, 2, 1, C.hair)
    px(hx + 1, hy - 2, 3, 1, C.hairHi)
    // 护额
    px(hx - 1, hy + 2, 11, 2, C.band)
    px(hx + 4, hy + 2, 4, 2, C.metal)
    px(hx - 5, hy + 3 + wave, 4, 1, C.band)
    // 眼睛
    const tired = this.pose === 'tired' || this.pose === 'fail'
    px(hx + 6, hy + 5, 2, tired ? 1 : 2, C.outline)
    // 口罩下缘
    px(hx + 3, hy + 7, 6, 1, C.skinSh)
    // 轮廓
    px(hx - 1, hy + 4, 1, 4, C.outline)
    px(hx + 9, hy + 1, 1, 7, C.outline)
    px(hx, hy + 8, 9, 1, C.outline)

    // 前手臂
    this.arm(g, tx + 5, ty + 2, p.front[0] + L * 0.5, p.front[1] + cr, C.suitHi)
    if (this.pose === 'seal' || this.pose === 'charge') {
      const [ax, ay] = p.front
      px(ax - 1 + L, ay + cr - 1, 3, 3, C.skin)
      px(ax - 1 + L, ay + cr + 1, 3, 1, C.skinSh)
    }
  }

  private arm(g: Graphics, x0: number, y0: number, x1: number, y1: number, color: number): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      g.rect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 2, 2).fill(color)
    }
    g.rect(Math.round(x1), Math.round(y1), 2, 2).fill(C.skin)
  }
}
