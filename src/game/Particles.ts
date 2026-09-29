import { Container, Sprite, Texture } from 'pixi.js'

let pixelTex: Texture | null = null

/** 1×1 白色像素纹理，所有粒子与像素块共用 */
export function pixelTexture(): Texture {
  if (!pixelTex) {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 1, 1)
    pixelTex = Texture.from(c)
    pixelTex.source.scaleMode = 'nearest'
  }
  return pixelTex
}

export interface EmitOptions {
  x: number
  y: number
  count?: number
  /** 发射区域半径 / 矩形 */
  spreadX?: number
  spreadY?: number
  angle?: number
  arc?: number
  speed?: number
  speedVar?: number
  life?: number
  lifeVar?: number
  size?: number
  sizeVar?: number
  endSize?: number
  /** 按寿命阶段取色（像素风不做渐变插值） */
  colors?: number[]
  gravity?: number
  drag?: number
  add?: boolean
  alpha?: number
  fade?: boolean
  /** 沿速度方向拉长 */
  stretch?: number
  vx?: number
  vy?: number
  layer?: 'back' | 'front'
  /** 自定义宽高比（例如风线） */
  aspect?: number
  wobble?: number
}

interface P {
  s: Sprite
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  endSize: number
  colors: number[]
  gravity: number
  drag: number
  alpha: number
  fade: boolean
  stretch: number
  aspect: number
  wobble: number
  seed: number
}

export class Particles {
  readonly back = new Container()
  readonly front = new Container()
  private pool: Sprite[] = []
  private live: P[] = []
  max = 2600

  get count(): number {
    return this.live.length
  }

  emit(o: EmitOptions): void {
    const n = o.count ?? 10
    for (let i = 0; i < n; i++) {
      if (this.live.length >= this.max) return
      const s = this.pool.pop() ?? new Sprite(pixelTexture())
      s.anchor.set(0.5)
      s.blendMode = o.add ? 'add' : 'normal'
      s.visible = true
      const layer = o.layer === 'back' ? this.back : this.front
      layer.addChild(s)
      const ang = (o.angle ?? 0) + (Math.random() - 0.5) * (o.arc ?? Math.PI * 2)
      const sp = (o.speed ?? 40) + (Math.random() - 0.5) * 2 * (o.speedVar ?? (o.speed ?? 40) * 0.5)
      const life = (o.life ?? 600) + (Math.random() - 0.5) * 2 * (o.lifeVar ?? (o.life ?? 600) * 0.3)
      const size = Math.max(1, (o.size ?? 2) + (Math.random() - 0.5) * 2 * (o.sizeVar ?? 0))
      this.live.push({
        s,
        x: o.x + (Math.random() - 0.5) * 2 * (o.spreadX ?? 0),
        y: o.y + (Math.random() - 0.5) * 2 * (o.spreadY ?? o.spreadX ?? 0),
        vx: Math.cos(ang) * sp + (o.vx ?? 0),
        vy: Math.sin(ang) * sp + (o.vy ?? 0),
        life,
        max: life,
        size,
        endSize: o.endSize ?? size,
        colors: o.colors ?? [0xffffff],
        gravity: o.gravity ?? 0,
        drag: o.drag ?? 0,
        alpha: o.alpha ?? 1,
        fade: o.fade ?? true,
        stretch: o.stretch ?? 0,
        aspect: o.aspect ?? 1,
        wobble: o.wobble ?? 0,
        seed: Math.random() * 100,
      })
    }
  }

  update(dt: number): void {
    const sec = dt / 1000
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]
      p.life -= dt
      if (p.life <= 0) {
        p.s.visible = false
        p.s.removeFromParent()
        this.pool.push(p.s)
        this.live[i] = this.live[this.live.length - 1]
        this.live.pop()
        continue
      }
      const k = 1 - p.life / p.max
      p.vy += p.gravity * sec
      if (p.drag) {
        const d = Math.max(0, 1 - p.drag * sec)
        p.vx *= d
        p.vy *= d
      }
      if (p.wobble) p.vx += Math.sin((p.seed + k * 10) * 2) * p.wobble * sec
      p.x += p.vx * sec
      p.y += p.vy * sec
      const size = p.size + (p.endSize - p.size) * k
      const s = p.s
      s.x = Math.round(p.x)
      s.y = Math.round(p.y)
      if (p.stretch) {
        const v = Math.hypot(p.vx, p.vy)
        s.rotation = Math.atan2(p.vy, p.vx)
        s.width = Math.max(size, size + v * p.stretch)
        s.height = size
      } else {
        s.rotation = 0
        s.width = Math.max(1, Math.round(size * p.aspect))
        s.height = Math.max(1, Math.round(size))
      }
      s.tint = p.colors[Math.min(p.colors.length - 1, Math.floor(k * p.colors.length))]
      s.alpha = p.fade ? p.alpha * (1 - k * k) : p.alpha
    }
  }

  clear(): void {
    for (const p of this.live) {
      p.s.visible = false
      p.s.removeFromParent()
      this.pool.push(p.s)
    }
    this.live = []
  }
}

/** 常用调色板 */
export const PAL = {
  fire: [0xffffff, 0xfff1a8, 0xffd23f, 0xff9a1f, 0xff5a1a, 0xc62f1a, 0x6b1f1a],
  fireSoft: [0xffd23f, 0xff9a1f, 0xff5a1a, 0xc62f1a],
  smoke: [0x9a9aa6, 0x77778a, 0x5a5a6e, 0x3e3e50],
  whiteSmoke: [0xffffff, 0xeeeeF5, 0xd6d6e2, 0xb4b4c6],
  water: [0xffffff, 0xc9f2ff, 0x7fd4ff, 0x3aa0ff, 0x1f63c9],
  waterDeep: [0x7fd4ff, 0x3aa0ff, 0x1f63c9, 0x163f8a],
  elec: [0xffffff, 0xdff9ff, 0x9fe8ff, 0x4fc3ff, 0x3a6bff],
  wind: [0xffffff, 0xeafff0, 0xc8f5d4],
  leaf: [0x7bd35a, 0x4fae3f, 0x2f7d34],
  dust: [0xd9bf8c, 0xb89b68, 0x8c7350],
  rock: [0x9b8b78, 0x7a6b5a, 0x5c4f42],
  chakra: [0xffffff, 0xbfe6ff, 0x6fb8ff, 0x3a7dff],
  wood: [0x8a5a34, 0x6b4226, 0x4a2c18],
  purple: [0xffffff, 0xe6d0ff, 0xb48cff, 0x7a4fd8, 0x40287a],
}
