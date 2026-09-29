import { Container, Graphics } from 'pixi.js'
import type { EffectFn } from '../game/VFXManager'
import { PAL, ease, projectile, rand, screenDroplets, splash, waterOrb } from './common'

/** 水喇叭：从口中喷出的水柱 */
const watertrumpet: EffectFn = async (fx) => {
  fx.ninja.play('charge', 300, 'cast')
  fx.sfx.play('cast')
  await fx.wait(300)
  fx.ninja.play('cast', 900)
  fx.sfx.play('water')
  const m = fx.ninja.mouth()
  const c = fx.dummy.center()
  let hitDone = false
  await fx.during(800, (_dt, t) => {
    for (let i = 0; i < 6; i++) {
      fx.p.emit({ x: m.x, y: m.y, count: 1, angle: Math.atan2(c.y - m.y, c.x - m.x), arc: 0.08, speed: 420, speedVar: 40, life: 700, size: 3, sizeVar: 1, colors: PAL.water, gravity: 40, stretch: 0.02 })
    }
    if (t > 0.35 && !hitDone) {
      hitDone = true
      splash(fx, c.x - 6, c.y, 0.8)
      fx.hit(1, { knock: 1 })
    }
  })
  fx.stage.puddle(fx.dummy.x, 50)
  await fx.wait(400)
}

/** 水阵壁：身前升起的水墙挡住并推开 */
const waterwall: EffectFn = async (fx) => {
  fx.ninja.play('cast', 1600)
  fx.sfx.play('water')
  const wall = new Graphics()
  const wx = fx.ninja.x + 40
  fx.add(wall, 'front')
  await fx.tween(1200, (t) => {
    const h = Math.min(1, t * 3) * 80 * (t > 0.8 ? (1 - t) * 5 : 1)
    wall.clear()
    for (let i = 0; i < 8; i++) {
      const x = wx - 16 + i * 4
      const hh = h + Math.sin(t * 30 + i) * 4
      wall.rect(x, fx.GY - hh, 4, hh).fill({ color: i % 2 ? 0x3aa0ff : 0x7fd4ff, alpha: 0.75 })
    }
    wall.rect(wx - 16, fx.GY - h - 3, 32, 3).fill({ color: 0xffffff, alpha: 0.8 })
    fx.p.emit({ x: wx + rand(-16, 16), y: fx.GY - h, count: 2, angle: -Math.PI / 2, arc: 1.5, speed: 60, gravity: 300, life: 500, size: 2, colors: PAL.water })
  })
  fx.remove(wall)
  // 水浪推开稻草人
  fx.sfx.play('splash')
  await fx.during(500, (_dt, t) => {
    const x = wx + (fx.dummy.x - wx) * t
    fx.p.emit({ x, y: fx.GY - 6, count: 8, spreadY: 10, angle: -Math.PI / 2, arc: 1, speed: 80, gravity: 300, life: 500, size: 3, colors: PAL.water })
  })
  splash(fx, fx.dummy.x, fx.GY - 16, 1)
  fx.hit(1, { knock: 2.5 })
  fx.stage.puddle(fx.dummy.x - 30, 90)
  await fx.wait(400)
}

function sharkShape(scale: number): Container {
  const c = new Container()
  const g = new Graphics()
  // 像素鲨鱼（朝右）
  const px = (x: number, y: number, w: number, h: number, col: number) => g.rect(x, y, w, h).fill(col)
  px(-12, -3, 22, 7, 0x3aa0ff)
  px(-8, -5, 14, 2, 0x3aa0ff)
  px(-4, -9, 5, 4, 0x2f7bd8)
  px(-18, -6, 6, 4, 0x2f7bd8)
  px(-18, 2, 6, 3, 0x2f7bd8)
  px(-10, 2, 18, 3, 0xc9f2ff)
  px(6, -2, 2, 2, 0x0b1a3a)
  px(8, 2, 4, 1, 0xffffff)
  c.addChild(g)
  c.scale.set(scale)
  return c
}

/** 水鲛弹：水鲨鱼冲撞 */
const watershark: EffectFn = async (fx) => {
  fx.ninja.play('cast', 1200)
  fx.sfx.play('water')
  const m = fx.ninja.hand()
  const c = fx.dummy.center()
  const shark = sharkShape(2)
  await projectile(fx, shark, { x: m.x + 10, y: fx.GY - 10 }, c, 700, {
    arc: -30,
    e: ease.inQuad,
    trail: (x, y) => fx.p.emit({ x: x - 20, y, count: 4, spreadY: 6, speed: 30, gravity: 120, life: 500, size: 3, colors: PAL.water }),
  })
  splash(fx, c.x, c.y, 1.4)
  fx.cam.shake(5, 300)
  fx.hit(1, { knock: 2.5 })
  fx.stage.puddle(fx.dummy.x, 70)
  await fx.wait(600)
}

/** 水龙弹：水龙从地面升起俯冲 */
const waterdragon: EffectFn = async (fx) => {
  fx.cam.darken(0.4)
  fx.ninja.play('ult', 2200)
  fx.sfx.play('water')
  fx.sfx.play('rumble')
  const sx = fx.ninja.x + 50
  const c = fx.dummy.center()
  const segs: Graphics[] = []
  const body = new Container()
  for (let i = 0; i < 18; i++) {
    const g = waterOrb(Math.max(3, 12 - i * 0.5))
    segs.push(g)
    body.addChild(g)
  }
  fx.add(body, 'front')
  const hist: { x: number; y: number }[] = []
  await fx.tween(1400, (t) => {
    let x: number, y: number
    if (t < 0.45) {
      const k = t / 0.45
      x = sx + Math.sin(k * Math.PI * 2) * 16
      y = fx.GY - k * 150
    } else {
      const k = (t - 0.45) / 0.55
      x = sx + (c.x - sx) * ease.inQuad(k)
      y = fx.GY - 150 + (c.y - (fx.GY - 150)) * ease.inQuad(k)
    }
    hist.unshift({ x, y })
    segs.forEach((g, i) => {
      const h = hist[Math.min(hist.length - 1, i * 2)]
      g.position.set(Math.round(h.x), Math.round(h.y))
    })
    fx.p.emit({ x, y, count: 3, spreadX: 6, spreadY: 6, speed: 30, gravity: 200, life: 600, size: 2, colors: PAL.water })
    if (t < 0.45) fx.cam.shake(2, 80)
  })
  fx.remove(body)
  splash(fx, c.x, c.y, 2.2)
  fx.cam.shake(8, 500)
  fx.cam.flash(0xc9f2ff, 0.4, 200)
  fx.hit(1, { knock: 3 })
  fx.stage.puddle(fx.dummy.x, 110)
  screenDroplets(fx, 12)
  await fx.wait(800)
}

/** 大瀑布之术：巨浪从天而降 */
const waterfall: EffectFn = async (fx) => {
  fx.cam.letterbox(true)
  fx.cam.darken(0.5, 0x04122a)
  fx.cam.zoomTo(0.92)
  fx.ninja.play('ult', 2600)
  fx.sfx.play('cast')
  await fx.wait(400)
  fx.sfx.play('water')
  fx.sfx.play('rumble')
  const x0 = fx.dummy.x - 60
  const x1 = fx.dummy.x + 60
  const fall = new Graphics()
  fx.add(fall, 'front')
  await fx.tween(1300, (t) => {
    const bottom = Math.min(fx.GY, t * 3 * fx.GY)
    fall.clear()
    for (let x = x0; x < x1; x += 4) {
      const off = Math.sin(x * 0.3 + t * 40) * 3
      fall.rect(x, 0, 4, bottom + off).fill({ color: (x / 4) % 2 ? 0x3aa0ff : 0x1f63c9, alpha: 0.85 * (t > 0.8 ? (1 - t) * 5 : 1) })
      if (Math.random() < 0.2) fall.rect(x + 1, rand(0, bottom), 1, 8).fill({ color: 0xffffff, alpha: 0.7 })
    }
    if (bottom >= fx.GY) {
      fx.p.emit({ x: rand(x0, x1), y: fx.GY - 4, count: 6, angle: -Math.PI / 2, arc: 2, speed: 180, gravity: 400, life: 700, size: 3, colors: PAL.water })
      fx.cam.shake(4, 80)
    }
  })
  fx.remove(fall)
  fx.hit(0.6, { lift: 2 })
  splash(fx, fx.dummy.x, fx.GY - 20, 2.5)
  await fx.wait(300)
  fx.hit(0.4, { knock: 2, lift: 2 })
  fx.stage.puddle(fx.dummy.x, 150)
  screenDroplets(fx, 24)
  fx.cam.flash(0xc9f2ff, 0.4, 200)
  await fx.wait(900)
}

export const WATER_FX: Record<string, EffectFn> = { watertrumpet, waterwall, watershark, waterdragon, waterfall }
