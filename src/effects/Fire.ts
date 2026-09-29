import { Container, Graphics } from 'pixi.js'
import type { EffectFn, FxContext } from '../game/VFXManager'
import { PAL, ease, explosion, fireOrb, inhale, projectile, rand } from './common'

function fireTrail(fx: FxContext, x: number, y: number, r: number): void {
  fx.p.emit({ x, y, count: 3, spreadX: r * 0.5, spreadY: r * 0.5, speed: 20, life: 380, size: r * 0.5, endSize: 1, colors: PAL.fire, add: true, vx: -30 })
  if (Math.random() < 0.3) fx.p.emit({ x, y: y - 4, count: 1, speed: 10, angle: -Math.PI / 2, life: 900, size: 3, endSize: 8, colors: PAL.smoke, alpha: 0.4, layer: 'back' })
}

/** 豪火球之术：吸气 → 大火球 → 爆炸 → 焦痕 */
const fireball: EffectFn = async (fx) => {
  fx.ninja.play('charge', 500, 'cast')
  fx.sfx.play('cast')
  await inhale(fx, 450, PAL.fireSoft)
  fx.ninja.play('cast', 900)
  fx.sfx.play('fire')
  const m = fx.ninja.mouth()
  const orb = fireOrb(14)
  const target = fx.dummy.center()
  let r = 6
  await projectile(fx, orb, m, target, 650, {
    e: ease.inQuad,
    trail: (x, y, t) => {
      r = 6 + t * 12
      orb.scale.set(r / 14 + Math.sin(t * 40) * 0.05)
      fireTrail(fx, x, y, r)
    },
  })
  fx.sfx.play('explode')
  explosion(fx, target.x, target.y, 1.4)
  fx.cam.shake(5, 400)
  fx.cam.flash(0xffd23f, 0.35, 160)
  fx.hit(1, { knock: 1.5 })
  fx.stage.scorch(fx.dummy.x, 50)
  await fx.wait(700)
}

/** 凤仙火之术：多枚小火球连射 */
const phoenix: EffectFn = async (fx) => {
  fx.ninja.play('charge', 300, 'cast')
  await inhale(fx, 300, PAL.fireSoft)
  fx.ninja.play('cast', 1400)
  const m = fx.ninja.mouth()
  const shots: Promise<void>[] = []
  for (let i = 0; i < 7; i++) {
    fx.sfx.play('fire')
    const c = fx.dummy.center()
    const tgt = { x: c.x + rand(-10, 10), y: c.y + rand(-22, 20) }
    const orb = fireOrb(5)
    shots.push(
      projectile(fx, orb, m, tgt, 480 + rand(-60, 80), {
        arc: rand(-50, 30),
        trail: (x, y) => fx.p.emit({ x, y, count: 1, speed: 10, life: 260, size: 3, endSize: 1, colors: PAL.fire, add: true }),
      }).then(() => {
        fx.sfx.play('hit')
        explosion(fx, tgt.x, tgt.y, 0.45, PAL.fire, false)
        fx.cam.shake(2, 120)
        fx.hit(1 / 7, { knock: 0.3 })
      }),
    )
    await fx.wait(130)
  }
  await Promise.all(shots)
  fx.stage.scorch(fx.dummy.x, 36)
  await fx.wait(500)
}

/** 龙火之术：沿地面燃起的火线 */
const dragonfire: EffectFn = async (fx) => {
  fx.ninja.play('cast', 1100)
  fx.sfx.play('fire')
  const x0 = fx.ninja.x + 20
  const x1 = fx.dummy.x
  await fx.during(700, (_dt, t) => {
    const x = x0 + (x1 - x0) * t
    fx.p.emit({ x, y: fx.GY - 2, count: 4, spreadX: 4, angle: -Math.PI / 2, arc: 0.5, speed: 70, life: 420, size: 3, endSize: 1, colors: PAL.fire, add: true })
  })
  fx.sfx.play('explode')
  const c = fx.dummy.center()
  fx.p.emit({ x: c.x, y: fx.GY - 4, count: 60, spreadX: 10, angle: -Math.PI / 2, arc: 0.6, speed: 150, life: 600, size: 4, endSize: 1, colors: PAL.fire, add: true })
  fx.cam.shake(3, 250)
  fx.hit(1, { knock: 0.5 })
  fx.stage.scorch(fx.dummy.x, 40)
  await fx.wait(500)
}

/** 火龙炎弹：火龙沿曲线扑向目标 */
const firedragon: EffectFn = async (fx) => {
  fx.cam.darken(0.45)
  fx.ninja.play('charge', 500, 'ult')
  fx.sfx.play('cast')
  await inhale(fx, 500, PAL.fireSoft)
  fx.ninja.play('ult', 1500)
  fx.sfx.play('fire')
  const m = fx.ninja.mouth()
  const c = fx.dummy.center()
  const body = new Container()
  const segs: Graphics[] = []
  for (let i = 0; i < 14; i++) {
    const g = fireOrb(Math.max(3, 11 - i * 0.6))
    segs.push(g)
    body.addChild(g)
  }
  fx.add(body, 'front')
  const hist: { x: number; y: number }[] = []
  await fx.tween(900, (t) => {
    const x = m.x + (c.x - m.x) * t
    const y = m.y + Math.sin(t * Math.PI * 2.5) * 30 * (1 - t) - Math.sin(t * Math.PI) * 30
    hist.unshift({ x, y })
    segs.forEach((g, i) => {
      const h = hist[Math.min(hist.length - 1, i * 2)]
      g.position.set(Math.round(h.x), Math.round(h.y))
    })
    fireTrail(fx, x, y, 10)
  }, ease.inOutQuad)
  fx.remove(body)
  fx.sfx.play('bigExplode')
  explosion(fx, c.x, c.y, 2)
  fx.cam.shake(8, 600)
  fx.cam.flash(0xff9a1f, 0.5, 220)
  fx.hit(1, { knock: 2.5 })
  fx.stage.scorch(fx.dummy.x, 70)
  await fx.wait(900)
}

/** 豪火灭却：覆盖全屏的火海 */
const majestic: EffectFn = async (fx) => {
  fx.cam.letterbox(true)
  fx.cam.darken(0.7)
  fx.cam.zoomTo(1.35, fx.ninja.x + 30, fx.ninja.y - 40)
  fx.ninja.play('charge', 900, 'ult')
  fx.sfx.play('cast')
  await inhale(fx, 900, PAL.fire)
  fx.cam.zoomTo(1, fx.W / 2, fx.H / 2)
  fx.ninja.play('ult', 2400)
  fx.sfx.play('fire')
  fx.sfx.play('rumble')
  const m = fx.ninja.mouth()
  let front = m.x
  await fx.during(1400, (_dt, t) => {
    front = m.x + (fx.W + 40 - m.x) * ease.outQuad(t)
    for (let i = 0; i < 10; i++) {
      const x = rand(m.x, front)
      const spread = ((x - m.x) / (fx.W - m.x)) * 110 + 6
      fx.p.emit({ x, y: m.y + rand(-spread, spread * 0.6), count: 1, speed: 40, life: 450, size: rand(4, 9), endSize: 2, colors: PAL.fire, add: true, vx: 90 })
    }
    if (Math.random() < 0.3) fx.p.emit({ x: rand(m.x, front), y: rand(20, fx.GY), count: 1, speed: 15, angle: -Math.PI / 2, life: 1600, size: 6, endSize: 16, colors: PAL.smoke, alpha: 0.5, layer: 'back' })
    fx.cam.shake(3, 100)
  })
  fx.cam.slowmo(0.35, 700, fx.realNow)
  fx.sfx.play('bigExplode')
  const c = fx.dummy.center()
  explosion(fx, c.x, c.y, 2.6)
  fx.cam.flash(0xffffff, 0.8, 300)
  fx.cam.shake(12, 900)
  fx.hit(1, { knock: 3, lift: 3 })
  fx.stage.scorch(fx.dummy.x, 110)
  fx.stage.scorch(fx.dummy.x - 90, 80)
  await fx.wait(1100)
}

export const FIRE_FX: Record<string, EffectFn> = { fireball, phoenix, dragonfire, firedragon, majestic }
