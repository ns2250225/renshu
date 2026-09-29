import { Container, Graphics } from 'pixi.js'

export interface Decal {
  g: Graphics
  life: number
  max: number
}

/** 道场背景：天空、远山、树林、围栏、地面，以及地面残留（焦痕 / 积水 / 裂缝） */
export class Stage extends Container {
  readonly sky = new Graphics()
  readonly far = new Graphics()
  readonly clouds = new Graphics()
  readonly ground = new Graphics()
  readonly decals = new Container()
  readonly storm = new Graphics()
  private decalList: Decal[] = []
  private W: number
  private H: number
  readonly groundY: number
  private t = 0
  private stormAlpha = 0
  private stormTarget = 0

  constructor(W: number, H: number, groundY: number) {
    super()
    this.W = W
    this.H = H
    this.groundY = groundY
    this.addChild(this.sky, this.clouds, this.far, this.storm, this.ground, this.decals)
    this.drawStatic()
  }

  setStorm(on: boolean): void {
    this.stormTarget = on ? 1 : 0
  }

  addDecal(draw: (g: Graphics) => void, life = 6000): void {
    const g = new Graphics()
    draw(g)
    this.decals.addChild(g)
    this.decalList.push({ g, life, max: life })
    if (this.decalList.length > 30) {
      const d = this.decalList.shift()!
      d.g.destroy()
    }
  }

  scorch(x: number, w = 40): void {
    const y = this.groundY
    this.addDecal((g) => {
      g.ellipse(x, y + 4, w / 2, 4).fill({ color: 0x1a120c, alpha: 0.6 })
      g.ellipse(x, y + 4, w / 3, 2.5).fill({ color: 0x0c0806, alpha: 0.6 })
      for (let i = 0; i < 6; i++) g.rect(Math.round(x - w / 2 + Math.random() * w), y + 2 + Math.round(Math.random() * 5), 2, 1).fill({ color: 0xff7a1a, alpha: 0.8 })
    }, 9000)
  }

  puddle(x: number, w = 60): void {
    const y = this.groundY
    this.addDecal((g) => {
      g.ellipse(x, y + 5, w / 2, 4).fill({ color: 0x2f7bd8, alpha: 0.55 })
      g.ellipse(x - w / 8, y + 4, w / 5, 1.5).fill({ color: 0xc9f2ff, alpha: 0.6 })
    }, 10000)
  }

  crack(x0: number, x1: number): void {
    const y = this.groundY
    this.addDecal((g) => {
      let x = x0, cy = y + 4
      g.moveTo(x, cy)
      while (x < x1) {
        x += 4 + Math.random() * 6
        cy = y + 2 + Math.random() * 6
        g.lineTo(Math.round(x), Math.round(cy))
      }
      g.stroke({ width: 1, color: 0x2a1c12, alpha: 0.9 })
    }, 8000)
  }

  clearDecals(): void {
    for (const d of this.decalList) d.g.destroy()
    this.decalList = []
  }

  update(dt: number): void {
    this.t += dt
    for (let i = this.decalList.length - 1; i >= 0; i--) {
      const d = this.decalList[i]
      d.life -= dt
      d.g.alpha = Math.min(1, d.life / 1500)
      if (d.life <= 0) {
        d.g.destroy()
        this.decalList.splice(i, 1)
      }
    }
    this.stormAlpha += (this.stormTarget - this.stormAlpha) * Math.min(1, dt / 400)
    this.drawClouds()
  }

  private drawClouds(): void {
    const g = this.clouds
    g.clear()
    const drift = (this.t / 400) % this.W
    const base = [
      [40, 36, 46], [170, 22, 60], [300, 44, 50], [420, 28, 40],
    ]
    for (const [x, y, w] of base) {
      const cx = ((x + drift) % (this.W + 80)) - 40
      g.rect(Math.round(cx), y, w, 6).fill({ color: 0xffffff, alpha: 0.18 })
      g.rect(Math.round(cx) + 8, y - 4, w - 16, 4).fill({ color: 0xffffff, alpha: 0.14 })
    }
    const s = this.storm
    s.clear()
    if (this.stormAlpha > 0.01) {
      s.rect(0, 0, this.W, this.groundY).fill({ color: 0x0a0c1c, alpha: 0.55 * this.stormAlpha })
      for (let i = 0; i < 9; i++) {
        const cx = ((i * 60 + this.t / 30) % (this.W + 120)) - 60
        const cy = 8 + ((i * 17) % 30)
        s.ellipse(cx, cy, 50, 16).fill({ color: 0x1b1e33, alpha: 0.9 * this.stormAlpha })
        s.ellipse(cx + 20, cy + 8, 40, 12).fill({ color: 0x262a44, alpha: 0.8 * this.stormAlpha })
      }
    }
  }

  private drawStatic(): void {
    const { W, H, groundY: GY } = this
    const sky = this.sky
    // 天空分层色带（像素风不用渐变）
    const bands = [0x1b1f3a, 0x252a52, 0x33386a, 0x474a80, 0x6a5d8f, 0xa06f8a, 0xd98c7a]
    const bh = Math.ceil(GY / bands.length)
    bands.forEach((c, i) => sky.rect(0, i * bh, W, bh + 1).fill(c))
    // 抖动过渡
    for (let i = 1; i < bands.length; i++) {
      for (let x = 0; x < W; x += 4) sky.rect(x + ((i % 2) * 2), i * bh - 1, 2, 1).fill(bands[i])
    }
    // 月亮
    sky.circle(390, 40, 14).fill(0xfff1c9)
    sky.circle(385, 37, 3).fill(0xf0dca8)
    sky.circle(395, 45, 2).fill(0xf0dca8)
    // 星星
    for (let i = 0; i < 40; i++) {
      sky.rect(Math.floor(Math.random() * W), Math.floor(Math.random() * GY * 0.45), 1, 1).fill({ color: 0xffffff, alpha: 0.5 + Math.random() * 0.5 })
    }

    const far = this.far
    // 远山
    const mountain = (baseY: number, color: number, peaks: number[][]) => {
      const pts: number[] = [0, baseY]
      for (const [x, y] of peaks) pts.push(x, y)
      pts.push(W, baseY)
      far.poly(pts).fill(color)
    }
    mountain(GY - 30, 0x3b3563, [[0, 120], [60, 90], [120, 118], [190, 80], [260, 115], [330, 86], [400, 110], [480, 92]])
    mountain(GY - 10, 0x2c2850, [[0, 150], [50, 130], [110, 150], [170, 125], [240, 148], [300, 132], [370, 150], [440, 128], [480, 140]])
    // 树林剪影
    for (let x = -6; x < W; x += 14) {
      const h = 22 + ((x * 37) % 17)
      const tx = x + ((x * 13) % 5)
      far.poly([tx, GY - 6, tx + 7, GY - 6 - h, tx + 14, GY - 6]).fill(0x1d2a3a)
      far.rect(tx + 6, GY - 8, 2, 4).fill(0x14161f)
    }
    // 围栏
    for (let x = 0; x < W; x += 24) {
      far.rect(x, GY - 20, 3, 16).fill(0x5a3b26)
      far.rect(x, GY - 20, 1, 16).fill(0x7a5236)
    }
    far.rect(0, GY - 17, W, 2).fill(0x6b4630)
    far.rect(0, GY - 10, W, 2).fill(0x5a3b26)

    const gr = this.ground
    gr.rect(0, GY - 4, W, H - GY + 4).fill(0x6b5238)
    gr.rect(0, GY - 4, W, 2).fill(0x8a6c48)
    // 地砖
    for (let y = GY; y < H; y += 10) {
      const off = ((y - GY) / 10) % 2 ? 16 : 0
      gr.rect(0, y, W, 1).fill(0x57422d)
      for (let x = off; x < W; x += 32) gr.rect(x, y, 1, 10).fill(0x57422d)
    }
    for (let i = 0; i < 80; i++) {
      gr.rect(Math.floor(Math.random() * W), GY + Math.floor(Math.random() * (H - GY)), 2, 1).fill(0x7c6043)
    }
    // 施法区域标记
    gr.rect(60, GY + 6, 70, 1).fill({ color: 0xffffff, alpha: 0.12 })
    gr.rect(350, GY + 6, 70, 1).fill({ color: 0xffffff, alpha: 0.12 })
  }
}
