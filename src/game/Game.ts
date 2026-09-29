import { Application, Container, Text } from 'pixi.js'
import { sfx, type Sfx } from '../audio/Sfx'
import { EFFECTS, rankIntro, rankOutro } from '../effects'
import type { SealId } from '../gesture/seals'
import type { GameHooks } from '../jutsu/JutsuManager'
import type { Element, JutsuDef } from '../jutsu/types'
import { state, type Rating } from '../store/game'
import { Camera } from './Camera'
import { Dummy, type DummyStatus, type HitOptions } from './Dummy'
import { Ninja } from './Ninja'
import { PAL, Particles } from './Particles'
import { Stage } from './Stage'
import { FxContext, type Updater } from './VFXManager'

export const W = 480
export const H = 270
export const GROUND_Y = 212

const ELEMENT_STATUS: Partial<Record<Element, DummyStatus>> = {
  fire: 'burn',
  water: 'wet',
  lightning: 'electrified',
  wind: 'gust',
  earth: 'earth',
}

interface Reaction {
  text: string
  color: string
  mult: number
  status?: DummyStatus[]
  remove?: DummyStatus[]
}

/** 元素交互：目标身上的状态 × 本次忍术元素 */
function reactionOf(el: Element, has: (s: DummyStatus) => boolean): Reaction | null {
  if (el === 'water' && has('burn')) return { text: '蒸汽爆发', color: '#e8f4ff', mult: 1.3, remove: ['burn'] }
  if (el === 'lightning' && has('wet')) return { text: '感电', color: '#9fe8ff', mult: 2, status: ['stunned'] }
  if ((el === 'fire' && has('gust')) || (el === 'wind' && has('burn'))) return { text: '火焰增强', color: '#ff9a1f', mult: 1.5, status: ['burn'] }
  if (el === 'wind' && has('wet')) return { text: '冰封', color: '#bff4ff', mult: 1.4, status: ['frozen'], remove: ['wet'] }
  if ((el === 'earth' && has('electrified')) || (el === 'lightning' && has('earth'))) return { text: '碎石爆炸', color: '#d9bf8c', mult: 1.5 }
  if (el === 'fire' && has('wet')) return { text: '蒸汽', color: '#c9d6e8', mult: 0.8, remove: ['wet'] }
  if (el === 'fire' && has('frozen')) return { text: '融化', color: '#7fd4ff', mult: 1.3, remove: ['frozen'], status: ['wet'] }
  return null
}

interface Timer {
  until: number
  resolve: () => void
}

interface Upd {
  fn: Updater
  start: number
}

/** PixiJS 场景：道场、忍者、稻草人、特效与镜头 */
export class Game implements GameHooks {
  readonly W = W
  readonly H = H
  readonly GY = GROUND_Y
  readonly app = new Application()
  readonly world = new Container()
  readonly screen = new Container()
  readonly stage = new Stage(W, H, GROUND_Y)
  readonly particles = new Particles()
  readonly actors = new Container()
  readonly backFx = new Container()
  readonly frontFx = new Container()
  readonly screenFx = new Container()
  readonly ninja = new Ninja()
  readonly dummy: Dummy
  readonly camera: Camera
  readonly sfx: Sfx = sfx
  private time = 0
  private timers: Timer[] = []
  private updaters: Upd[] = []
  private auraAcc = 0
  private ready = false

  constructor() {
    this.dummy = new Dummy(this.particles)
    this.camera = new Camera(this.world, W, H)
  }

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({ width: W, height: H, antialias: false, background: 0x1b1f3a, resolution: 1, autoDensity: false })
    const canvas = this.app.canvas
    canvas.classList.add('game-canvas')
    host.appendChild(canvas)

    this.ninja.position.set(96, GROUND_Y)
    this.ninja.baseX = 96
    this.ninja.baseY = GROUND_Y
    this.dummy.position.set(384, GROUND_Y)
    this.dummy.homeX = 384
    this.dummy.homeY = GROUND_Y
    this.actors.addChild(this.dummy, this.ninja)

    this.world.addChild(
      this.stage,
      this.camera.darkLayer,
      this.backFx,
      this.particles.back,
      this.actors,
      this.frontFx,
      this.particles.front,
    )
    this.screen.addChild(this.camera.flashLayer, this.camera.bars, this.screenFx)
    this.app.stage.addChild(this.world, this.screen)

    this.dummy.onLand = (x, y) => {
      this.particles.emit({ x, y, count: 16, spreadX: 12, angle: -Math.PI / 2, arc: 2.6, speed: 50, drag: 2, life: 800, size: 4, endSize: 9, colors: PAL.dust, alpha: 0.7, layer: 'back' })
      this.camera.shake(3, 200)
      sfx.play('hit')
    }
    this.dummy.onDestroyed = () => {
      sfx.play('explode')
      this.camera.shake(6, 400)
      this.floatText('DESTROYED!', this.dummy.x, GROUND_Y - 100, 0xff4d4d, 14)
    }

    this.app.ticker.add((tk) => this.tick(tk.deltaMS))
    this.ready = true
  }

  destroy(): void {
    if (!this.ready) return
    this.app.destroy(true, { children: true })
    this.ready = false
  }

  // ---------- 时间轴 ----------

  private tick(realDt: number): void {
    const rdt = Math.min(realDt, 50)
    const dt = rdt * this.camera.timeScale(performance.now())
    this.time += dt

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i]
      if (this.time >= t.until) {
        this.timers.splice(i, 1)
        t.resolve()
      }
    }
    const list = this.updaters
    this.updaters = []
    const keep: Upd[] = []
    for (const u of list) {
      let r: boolean | void
      try {
        r = u.fn(dt, this.time - u.start)
      } catch (e) {
        console.error(e)
        r = false
      }
      if (r !== false) keep.push(u)
    }
    this.updaters = keep.concat(this.updaters)

    this.stage.update(dt)
    this.ninja.update(dt)
    this.dummy.update(dt)
    this.particles.update(dt)
    this.camera.update(rdt)
    this.emitAura(dt)
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.timers.push({ until: this.time + ms, resolve }))
  }

  addUpdater(fn: Updater): void {
    this.updaters.push({ fn, start: this.time })
  }

  layer(name: 'back' | 'front' | 'screen'): Container {
    return name === 'back' ? this.backFx : name === 'front' ? this.frontFx : this.screenFx
  }

  private emitAura(dt: number): void {
    const lv = this.ninja.chakra
    if (lv <= 0 || !this.ninja.visible) return
    this.auraAcc += dt
    const every = Math.max(30, 140 - lv * 14)
    while (this.auraAcc > every) {
      this.auraAcc -= every
      this.particles.emit({
        x: this.ninja.x, y: this.ninja.y - 2, count: 1 + Math.floor(lv / 3), spreadX: 10 + lv,
        angle: -Math.PI / 2, arc: 0.4, speed: 30 + lv * 6, life: 500 + lv * 40, size: 2, endSize: 1,
        colors: PAL.chakra, add: true, alpha: 0.8, layer: 'back',
      })
    }
  }

  // ---------- 命中 ----------

  applyHit(fx: FxContext, frac: number, o: HitOptions): void {
    const d = this.dummy
    if (d.isDestroyed) return
    const el = fx.j.element
    if (!fx.reacted) {
      fx.reacted = true
      const r = reactionOf(el, (s) => d.has(s))
      if (r) {
        fx.mult = r.mult
        r.remove?.forEach((s) => d.clearStatus(s))
        r.status?.forEach((s) => d.setStatus(s, 3000))
        state.reaction = { text: r.text, color: r.color, key: Date.now() }
        const c = d.center()
        this.floatText(r.text, c.x, c.y - 50, parseInt(r.color.slice(1), 16), 12, 1100)
        if (r.text.startsWith('蒸汽')) {
          sfx.play('steam')
          this.particles.emit({ x: c.x, y: c.y, count: 40, spreadX: 16, spreadY: 20, angle: -Math.PI / 2, arc: 1.2, speed: 40, life: 1600, size: 6, endSize: 16, colors: PAL.whiteSmoke, alpha: 0.7 })
        } else if (r.text === '感电') {
          sfx.play('zap')
          this.camera.flash(0x9fe8ff, 0.4, 120)
        } else if (r.text === '碎石爆炸') {
          sfx.play('rock')
          this.particles.emit({ x: c.x, y: c.y, count: 40, speed: 160, gravity: 400, life: 900, size: 3, colors: PAL.rock, fade: false })
        }
      }
    }
    const status = [...(o.status ?? [])]
    const def = ELEMENT_STATUS[el]
    if (def) status.push(def)
    const statusMs = o.statusMs ?? (state.mode === 'continuous' ? 9000 : 3500)
    const dmg = Math.max(1, Math.round(fx.j.damage * frac * fx.mult))
    d.hit(dmg, { ...o, status, statusMs })
    const c = d.center()
    this.floatText(String(dmg), c.x + (Math.random() * 20 - 10), c.y - 20, fx.mult > 1 ? 0xffe066 : 0xffffff, fx.mult > 1 ? 12 : 10, 700)
  }

  floatText(text: string, x: number, y: number, color = 0xffffff, size = 10, ms = 800): void {
    const t = new Text({
      text,
      style: { fontFamily: 'monospace', fontSize: size, fontWeight: 'bold', fill: color, stroke: { color: 0x000000, width: 3 } },
    })
    t.anchor.set(0.5)
    t.position.set(Math.round(x), Math.round(y))
    this.frontFx.addChild(t)
    const y0 = t.y
    this.addUpdater((_dt, age) => {
      const k = age / ms
      t.y = Math.round(y0 - k * 18)
      t.alpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1
      if (k >= 1) {
        t.destroy()
        return false
      }
    })
  }

  // ---------- GameHooks ----------

  onSeal(_seal: SealId, count: number, rating: Rating): void {
    if (state.casting && this.ninja.pose !== 'idle' && this.ninja.pose !== 'seal') return
    this.ninja.play('seal', 300, 'seal')
    this.ninja.chakra = count
    this.ninja.flashChakra()
    sfx.play('seal', count)
    const h = this.ninja.point(5, -14)
    this.particles.emit({
      x: h.x, y: h.y, count: rating === 'PERFECT' ? 18 : 10, speed: 60, drag: 3, life: 350, size: 2, endSize: 1,
      colors: rating === 'PERFECT' ? [0xffffff, 0xffe066, 0xffb13b] : PAL.chakra, add: true,
    })
  }

  onSealError(_seal: SealId): void {
    sfx.play('miss')
    if (state.casting) return
    this.ninja.play('fail', 450, state.seq.length ? 'seal' : 'idle')
    this.particles.emit({ x: this.ninja.x + 8, y: this.ninja.y - 40, count: 6, speed: 30, life: 400, size: 2, colors: [0xff4d4d, 0x9c1f2c] })
  }

  onSequenceClear(): void {
    if (state.casting) return
    this.ninja.setHold('idle')
    this.ninja.chakra = 0
  }

  onCountdown(n: number): void {
    sfx.play(n > 0 ? 'countdown' : 'start')
  }

  async cast(j: JutsuDef): Promise<void> {
    const fx = new FxContext(this, j)
    const effect = EFFECTS[j.animation] ?? EFFECTS.fireball
    const n = this.ninja
    this.ninja.chakra = Math.max(this.ninja.chakra, j.seals.length)
    try {
      await rankIntro(fx)
      await effect(fx)
      rankOutro(fx)
    } catch (e) {
      console.error('[cast]', j.id, e)
    } finally {
      fx.cleanup()
      this.camera.reset()
      this.stage.setStorm(false)
      n.visible = true
      n.facing = 1
      n.position.set(n.baseX, n.baseY)
      n.chakra = state.seq.length
      n.play('success', 500, state.seq.length ? 'seal' : 'idle')
    }
    await this.wait(250)
  }
}
