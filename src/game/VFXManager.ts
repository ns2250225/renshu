import type { Container } from 'pixi.js'
import type { Sfx } from '../audio/Sfx'
import type { JutsuDef } from '../jutsu/types'
import type { Camera } from './Camera'
import type { Dummy, HitOptions } from './Dummy'
import type { Game } from './Game'
import type { Ninja } from './Ninja'
import type { Particles } from './Particles'
import type { Stage } from './Stage'

export interface Vec {
  x: number
  y: number
}

export type Updater = (dt: number, age: number) => boolean | void
export type EffectFn = (fx: FxContext) => Promise<void>

export const ease = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inQuad: (t: number) => t * t,
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
}

/** 单次忍术释放的特效上下文：统一的时间轴、图层、命中接口 */
export class FxContext {
  readonly game: Game
  readonly j: JutsuDef
  reacted = false
  mult = 1
  private owned: Container[] = []

  constructor(game: Game, j: JutsuDef) {
    this.game = game
    this.j = j
  }

  get W(): number { return this.game.W }
  get H(): number { return this.game.H }
  get GY(): number { return this.game.GY }
  get ninja(): Ninja { return this.game.ninja }
  get dummy(): Dummy { return this.game.dummy }
  get p(): Particles { return this.game.particles }
  get cam(): Camera { return this.game.camera }
  get stage(): Stage { return this.game.stage }
  get sfx(): Sfx { return this.game.sfx }

  /** 游戏时间（受慢动作影响） */
  wait(ms: number): Promise<void> {
    return this.game.wait(ms)
  }

  tween(ms: number, fn: (t: number) => void, e: (t: number) => number = ease.linear): Promise<void> {
    return new Promise((resolve) => {
      this.game.addUpdater((_dt, age) => {
        const t = Math.min(1, age / ms)
        fn(e(t))
        if (t >= 1) {
          resolve()
          return false
        }
      })
    })
  }

  /** 持续执行 ms 毫秒的每帧回调 */
  during(ms: number, fn: (dt: number, t: number) => void): Promise<void> {
    return new Promise((resolve) => {
      this.game.addUpdater((dt, age) => {
        fn(dt, Math.min(1, age / ms))
        if (age >= ms) {
          resolve()
          return false
        }
      })
    })
  }

  /** 添加显示对象到图层；updater 返回 false 时自动移除销毁 */
  add<T extends Container>(obj: T, layer: 'back' | 'front' | 'screen' = 'front', update?: Updater): T {
    this.game.layer(layer).addChild(obj)
    this.owned.push(obj)
    if (update) {
      this.game.addUpdater((dt, age) => {
        if (obj.destroyed) return false
        const keep = update(dt, age)
        if (keep === false) {
          this.remove(obj)
          return false
        }
      })
    }
    return obj
  }

  remove(obj: Container): void {
    if (!obj.destroyed) obj.destroy({ children: true })
    this.owned = this.owned.filter((o) => o !== obj)
  }

  /** 按伤害比例命中稻草人 */
  hit(frac: number, o: HitOptions = {}): void {
    this.game.applyHit(this, frac, o)
  }

  get realNow(): number {
    return performance.now()
  }

  /** 忍术结束时清理残留对象 */
  cleanup(): void {
    for (const o of this.owned) if (!o.destroyed) o.destroy({ children: true })
    this.owned = []
  }
}
