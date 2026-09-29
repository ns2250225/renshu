import { Container, Graphics } from 'pixi.js'

/** 镜头特效：震屏、闪光、背景变暗、慢动作、镜头缩放、电影黑边 */
export class Camera {
  readonly world: Container
  readonly flashLayer = new Graphics()
  readonly darkLayer = new Graphics()
  readonly bars = new Graphics()
  private W: number
  private H: number

  private shakeAmp = 0
  private shakeDecay = 0
  private flashColor = 0xffffff
  private flashAlpha = 0
  private flashDecay = 0
  private darkTarget = 0
  private darkAlpha = 0
  private darkColor = 0x05060f
  private zoomTarget = 1
  private zoom = 1
  private focusX: number
  private focusY: number
  private barsTarget = 0
  private barsH = 0
  private slowUntil = 0
  private slowScale = 1

  constructor(world: Container, W: number, H: number) {
    this.world = world
    this.W = W
    this.H = H
    this.focusX = W / 2
    this.focusY = H / 2
  }

  /** 真实时间下的时间缩放（慢动作） */
  timeScale(realNow: number): number {
    return realNow < this.slowUntil ? this.slowScale : 1
  }

  shake(amp: number, ms = 400): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp)
    this.shakeDecay = this.shakeAmp / ms
  }

  flash(color = 0xffffff, alpha = 1, ms = 120): void {
    this.flashColor = color
    this.flashAlpha = alpha
    this.flashDecay = alpha / ms
  }

  darken(alpha: number, color = 0x05060f): void {
    this.darkTarget = alpha
    this.darkColor = color
  }

  zoomTo(z: number, fx = this.W / 2, fy = this.H / 2): void {
    this.zoomTarget = z
    this.focusX = fx
    this.focusY = fy
  }

  letterbox(on: boolean): void {
    this.barsTarget = on ? 22 : 0
  }

  slowmo(scale: number, ms: number, realNow: number): void {
    this.slowScale = scale
    this.slowUntil = realNow + ms
  }

  reset(): void {
    this.darkTarget = 0
    this.zoomTarget = 1
    this.barsTarget = 0
    this.slowUntil = 0
  }

  /** dt 使用真实时间，镜头效果不受慢动作影响 */
  update(dt: number): void {
    const W = this.W, H = this.H
    this.shakeAmp = Math.max(0, this.shakeAmp - this.shakeDecay * dt)
    const sx = this.shakeAmp ? Math.round((Math.random() * 2 - 1) * this.shakeAmp) : 0
    const sy = this.shakeAmp ? Math.round((Math.random() * 2 - 1) * this.shakeAmp * 0.6) : 0

    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt / 180)
    const z = this.zoom
    this.world.scale.set(z)
    this.world.x = Math.round(this.focusX - this.focusX * z + sx)
    this.world.y = Math.round(this.focusY - this.focusY * z + sy)

    this.darkAlpha += (this.darkTarget - this.darkAlpha) * Math.min(1, dt / 250)
    this.darkLayer.clear()
    if (this.darkAlpha > 0.01) this.darkLayer.rect(-40, -40, W + 80, H + 80).fill({ color: this.darkColor, alpha: this.darkAlpha })

    this.flashAlpha = Math.max(0, this.flashAlpha - this.flashDecay * dt)
    this.flashLayer.clear()
    if (this.flashAlpha > 0.01) this.flashLayer.rect(0, 0, W, H).fill({ color: this.flashColor, alpha: this.flashAlpha })

    this.barsH += (this.barsTarget - this.barsH) * Math.min(1, dt / 200)
    this.bars.clear()
    if (this.barsH > 0.5) {
      const h = Math.round(this.barsH)
      this.bars.rect(0, 0, W, h).fill(0x000000)
      this.bars.rect(0, H - h, W, h).fill(0x000000)
    }
  }
}
