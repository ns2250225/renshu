import { Container, Graphics, Text } from 'pixi.js'
import { PAL } from '../game/Particles'
import { ease, type FxContext, type Vec } from '../game/VFXManager'

export { PAL, ease }

export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function bezier(a: Vec, c: Vec, b: Vec, t: number): Vec {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
}

/** 锯齿闪电折线 */
export function drawBolt(
  g: Graphics,
  x1: number, y1: number, x2: number, y2: number,
  o: { segs?: number; jitter?: number; color?: number; width?: number; branches?: number; alpha?: number } = {},
): void {
  const segs = o.segs ?? 10
  const jitter = o.jitter ?? 10
  const pts: Vec[] = [{ x: x1, y: y1 }]
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len, ny = dx / len
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    const off = (Math.random() - 0.5) * 2 * jitter
    pts.push({ x: x1 + dx * t + nx * off, y: y1 + dy * t + ny * off })
  }
  pts.push({ x: x2, y: y2 })
  const stroke = (w: number, c: number, a: number) => {
    g.moveTo(Math.round(pts[0].x), Math.round(pts[0].y))
    for (const p of pts.slice(1)) g.lineTo(Math.round(p.x), Math.round(p.y))
    g.stroke({ width: w, color: c, alpha: a })
  }
  const w = o.width ?? 2
  stroke(w + 4, o.color ?? 0x4fc3ff, (o.alpha ?? 1) * 0.35)
  stroke(w, 0xffffff, o.alpha ?? 1)
  for (let b = 0; b < (o.branches ?? 2); b++) {
    const p = pts[1 + Math.floor(Math.random() * (pts.length - 2))]
    if (!p) continue
    let bx = p.x, by = p.y
    g.moveTo(Math.round(bx), Math.round(by))
    for (let i = 0; i < 4; i++) {
      bx += rand(-jitter, jitter)
      by += rand(2, jitter)
      g.lineTo(Math.round(bx), Math.round(by))
    }
    g.stroke({ width: 1, color: 0xdff9ff, alpha: (o.alpha ?? 1) * 0.8 })
  }
}

/** 闪烁一次后消失的闪电 */
export function boltFlash(fx: FxContext, a: Vec, b: Vec, ms = 180, o: Parameters<typeof drawBolt>[5] = {}): void {
  const g = new Graphics()
  let acc = 99
  fx.add(g, 'front', (dt, age) => {
    acc += dt
    if (acc > 45) {
      acc = 0
      g.clear()
      drawBolt(g, a.x, a.y, b.x, b.y, { ...o, alpha: 1 - age / ms })
    }
    return age < ms
  })
  g.blendMode = 'add'
}

export function explosion(
  fx: FxContext, x: number, y: number, size = 1,
  palette: number[] = PAL.fire, smoke = true,
): void {
  const p = fx.p
  p.emit({ x, y, count: Math.round(40 * size), speed: 120 * size, life: 450, size: 3 * size, sizeVar: size, endSize: 1, colors: palette, add: true, drag: 3 })
  p.emit({ x, y, count: Math.round(14 * size), speed: 30 * size, life: 350, size: 10 * size, endSize: 2, colors: palette, add: true })
  p.emit({ x, y, count: Math.round(24 * size), speed: 200 * size, life: 600, size: 1, colors: [0xffffff, 0xffd23f], add: true, gravity: 200, stretch: 0.03 })
  if (smoke) p.emit({ x, y: y - 4, count: Math.round(16 * size), spreadX: 10 * size, speed: 25 * size, angle: -Math.PI / 2, arc: 1.4, life: 1400, size: 6 * size, endSize: 14 * size, colors: PAL.smoke, alpha: 0.55, layer: 'back' })
  // 冲击环
  const ring = new Graphics()
  fx.add(ring, 'front', (_dt, age) => {
    const t = age / 300
    ring.clear()
    ring.circle(x, y, 6 + t * 40 * size).stroke({ width: Math.max(1, 3 * (1 - t)), color: palette[1] ?? 0xffffff, alpha: 1 - t })
    return t < 1
  })
}

export function poof(fx: FxContext, x: number, y: number, size = 1): void {
  fx.sfx.play('poof')
  fx.p.emit({ x, y, count: Math.round(26 * size), spreadX: 6 * size, spreadY: 10 * size, speed: 50 * size, drag: 3, life: 700, size: 7 * size, endSize: 12 * size, colors: PAL.whiteSmoke, alpha: 0.9 })
  fx.p.emit({ x, y, count: Math.round(10 * size), speed: 80 * size, drag: 4, life: 500, size: 3, colors: [0xffffff], alpha: 0.9 })
}

export function splash(fx: FxContext, x: number, y: number, size = 1): void {
  fx.sfx.play('splash')
  fx.p.emit({ x, y, count: Math.round(50 * size), angle: -Math.PI / 2, arc: 2.4, speed: 150 * size, gravity: 420, life: 800, size: 2, sizeVar: 1, colors: PAL.water })
  fx.p.emit({ x, y, count: Math.round(12 * size), speed: 30, life: 500, size: 8 * size, endSize: 14 * size, colors: [0xc9f2ff, 0x7fd4ff], alpha: 0.5 })
}

export function dust(fx: FxContext, x: number, y: number, size = 1): void {
  fx.p.emit({ x, y, count: Math.round(20 * size), spreadX: 12 * size, angle: -Math.PI / 2, arc: 2.6, speed: 50 * size, drag: 2, life: 900, size: 4 * size, endSize: 10 * size, colors: PAL.dust, alpha: 0.7, layer: 'back' })
}

export function rocks(fx: FxContext, x: number, y: number, size = 1): void {
  fx.p.emit({ x, y, count: Math.round(22 * size), spreadX: 8 * size, angle: -Math.PI / 2, arc: 1.8, speed: 160 * size, gravity: 500, life: 900, size: 3, sizeVar: 1, colors: PAL.rock, fade: false })
}

/** 屏幕水滴（屏幕层，不随镜头） */
export function screenDroplets(fx: FxContext, count = 16): void {
  for (let i = 0; i < count; i++) {
    const g = new Graphics()
    const x = rand(0, fx.W), y0 = rand(0, fx.H * 0.7), r = rand(2, 6)
    g.circle(0, 0, r).fill({ color: 0xc9f2ff, alpha: 0.35 })
    g.circle(-r / 3, -r / 3, r / 3).fill({ color: 0xffffff, alpha: 0.6 })
    g.position.set(x, y0)
    const speed = rand(10, 40)
    fx.add(g, 'screen', (dt, age) => {
      g.y += (speed * dt) / 1000
      g.alpha = 1 - age / 2200
      return age < 2200
    })
  }
}

/** 普通投射物：从 a 飞到 b，每帧调用 trail */
export function projectile(
  fx: FxContext,
  obj: Container,
  a: Vec, b: Vec,
  ms: number,
  o: { arc?: number; trail?: (x: number, y: number, t: number) => void; spin?: number; e?: (t: number) => number } = {},
): Promise<void> {
  const ctrl = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + (o.arc ?? 0) }
  obj.position.set(a.x, a.y)
  fx.add(obj, 'front')
  return fx.tween(ms, (t) => {
    const p = bezier(a, ctrl, b, t)
    obj.position.set(Math.round(p.x), Math.round(p.y))
    if (o.spin) obj.rotation += o.spin
    o.trail?.(p.x, p.y, t)
  }, o.e).then(() => fx.remove(obj))
}

export function fireOrb(r: number): Graphics {
  const g = new Graphics()
  g.circle(0, 0, r).fill({ color: 0xc62f1a, alpha: 0.9 })
  g.circle(0, 0, r * 0.8).fill(0xff5a1a)
  g.circle(0, 0, r * 0.6).fill(0xff9a1f)
  g.circle(r * 0.1, -r * 0.1, r * 0.4).fill(0xffd23f)
  g.circle(r * 0.15, -r * 0.15, r * 0.2).fill(0xfff1a8)
  g.blendMode = 'add'
  return g
}

export function waterOrb(r: number): Graphics {
  const g = new Graphics()
  g.circle(0, 0, r).fill({ color: 0x1f63c9, alpha: 0.9 })
  g.circle(0, 0, r * 0.75).fill(0x3aa0ff)
  g.circle(-r * 0.25, -r * 0.25, r * 0.3).fill(0xc9f2ff)
  return g
}

/** 大字（像素画布内的连击数 / HIT） */
export function bigText(fx: FxContext, text: string, x: number, y: number, color = 0xffffff, size = 14, ms = 700): Text {
  const t = new Text({
    text,
    style: { fontFamily: 'monospace', fontSize: size, fontWeight: 'bold', fill: color, stroke: { color: 0x000000, width: 3 } },
  })
  t.anchor.set(0.5)
  t.position.set(x, y)
  fx.add(t, 'front', (_dt, age) => {
    const k = age / ms
    t.scale.set(k < 0.15 ? 1.5 - k * 3.3 : 1)
    t.y = y - k * 10
    t.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1
    return k < 1
  })
  return t
}

/** 忍者吸气：粒子吸入嘴部 */
export function inhale(fx: FxContext, ms: number, colors: number[] = PAL.chakra): Promise<void> {
  const m = fx.ninja.mouth()
  let acc = 0
  return fx.during(ms, (dt) => {
    acc += dt
    while (acc > 30) {
      acc -= 30
      const ang = rand(0, Math.PI * 2)
      const d = rand(20, 36)
      const sp = d / (0.25)
      fx.p.emit({ x: m.x + Math.cos(ang) * d, y: m.y + Math.sin(ang) * d, count: 1, angle: ang + Math.PI, arc: 0, speed: sp, speedVar: 0, life: 250, lifeVar: 0, size: 1, colors, add: true })
    }
  })
}

export function sealCircle(fx: FxContext, x: number, y: number, r: number, color = 0x6fd0ff, ms = 1200): Graphics {
  const g = new Graphics()
  g.blendMode = 'add'
  fx.add(g, 'back', (_dt, age) => {
    const t = age / ms
    const k = Math.min(1, t * 3)
    g.clear()
    const rr = r * k
    g.ellipse(x, y, rr, rr * 0.28).stroke({ width: 2, color, alpha: 1 - t * t })
    g.ellipse(x, y, rr * 0.7, rr * 0.2).stroke({ width: 1, color, alpha: 1 - t * t })
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + age / 400
      g.rect(Math.round(x + Math.cos(a) * rr * 0.85) - 1, Math.round(y + Math.sin(a) * rr * 0.24) - 1, 3, 2).fill({ color: 0xffffff, alpha: 1 - t })
    }
    return t < 1
  })
  return g
}
