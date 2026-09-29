import { Graphics } from 'pixi.js'
import type { EffectFn, FxContext } from '../game/VFXManager'
import { PAL, dust, ease, rand } from './common'

function windLines(fx: FxContext, x: number, y: number, h: number, speed = 360): void {
  fx.p.emit({ x, y, count: 3, spreadY: h, angle: 0, arc: 0.05, speed, speedVar: 60, life: 450, size: 1, colors: PAL.wind, aspect: 10, alpha: 0.8 })
}

/** 大突破：一阵强风吹飞 */
const breakthrough: EffectFn = async (fx) => {
  fx.ninja.play('charge', 300, 'cast')
  await fx.wait(300)
  fx.ninja.play('cast', 1000)
  fx.sfx.play('wind')
  const m = fx.ninja.mouth()
  await fx.during(800, (_dt, t) => {
    windLines(fx, m.x + 10, m.y + 4, 16 + t * 40)
    fx.p.emit({ x: rand(m.x, fx.dummy.x), y: fx.GY - 2, count: 1, angle: -0.3, arc: 0.4, speed: 120, life: 500, size: 2, colors: PAL.dust, layer: 'back' })
    if (t > 0.4 && Math.random() < 0.3) fx.p.emit({ x: rand(m.x, fx.dummy.x), y: rand(120, fx.GY), count: 1, angle: -0.2, arc: 0.6, speed: 180, life: 700, size: 2, colors: PAL.leaf, wobble: 4 })
  })
  fx.hit(1, { knock: 3 })
  dust(fx, fx.dummy.x, fx.GY, 1.2)
  fx.cam.shake(3, 250)
  await fx.wait(500)
}

/** 真空玉：连续吐出空气弹 */
const vacuum: EffectFn = async (fx) => {
  fx.ninja.play('cast', 1200)
  const m = fx.ninja.mouth()
  const c = fx.dummy.center()
  for (let i = 0; i < 4; i++) {
    fx.sfx.play('whoosh')
    const g = new Graphics()
    g.circle(0, 0, 6).stroke({ width: 1, color: 0xeafff0, alpha: 0.9 })
    g.circle(0, 0, 3).stroke({ width: 1, color: 0xffffff, alpha: 0.6 })
    const ty = c.y + rand(-16, 16)
    g.position.set(m.x, m.y)
    fx.add(g, 'front', (dt) => {
      g.x += (dt / 1000) * 420
      g.y += ((ty - g.y) * dt) / 300
      g.rotation += dt / 50
      fx.p.emit({ x: g.x, y: g.y, count: 1, speed: 10, life: 200, size: 1, colors: PAL.wind, alpha: 0.6 })
      if (g.x >= c.x) {
        fx.sfx.play('hit')
        fx.p.emit({ x: g.x, y: g.y, count: 14, speed: 90, life: 250, size: 1, colors: PAL.wind, aspect: 4 })
        fx.hit(0.25, { knock: 0.5 })
        return false
      }
    })
    await fx.wait(180)
  }
  await fx.wait(700)
}

/** 风刃：月牙形风刃斩击 */
const windblade: EffectFn = async (fx) => {
  fx.ninja.play('attack', 900)
  const h = fx.ninja.hand()
  const c = fx.dummy.center()
  const blades: Promise<void>[] = []
  for (let i = 0; i < 3; i++) {
    fx.sfx.play('wind')
    const g = new Graphics()
    const ang = (i - 1) * 0.35
    g.arc(0, 0, 18, -1.1, 1.1).stroke({ width: 3, color: 0xc8f5d4, alpha: 0.85 })
    g.arc(-2, 0, 16, -0.9, 0.9).stroke({ width: 1, color: 0xffffff })
    g.rotation = ang
    fx.add(g, 'front')
    const y0 = h.y + (i - 1) * 10
    blades.push(
      fx.tween(380, (t) => {
        g.position.set(Math.round(h.x + (c.x - h.x) * t), Math.round(y0 + (c.y - y0) * t))
        fx.p.emit({ x: g.x - 6, y: g.y, count: 1, spreadY: 10, speed: 20, life: 220, size: 1, colors: PAL.wind, aspect: 6, alpha: 0.6 })
      }, ease.inQuad).then(() => {
        fx.remove(g)
        fx.sfx.play('hit')
        fx.p.emit({ x: c.x, y: c.y, count: 10, speed: 120, life: 300, size: 1, colors: [...PAL.wind, 0xe3c066], aspect: 5 })
        fx.hit(1 / 3, { knock: 0.6 })
        fx.cam.shake(2, 100)
      }),
    )
    await fx.wait(140)
  }
  await Promise.all(blades)
  await fx.wait(400)
}

export const WIND_FX: Record<string, EffectFn> = { breakthrough, vacuum, windblade }
