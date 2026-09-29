import { Graphics } from 'pixi.js'
import type { EffectFn } from '../game/VFXManager'
import { PAL, boltFlash, drawBolt, ease, rand } from './common'

/** 千鸟：手中雷球 → 冲刺突刺 */
const chidori: EffectFn = async (fx) => {
  fx.cam.darken(0.35)
  fx.ninja.play('charge', 900, 'attack')
  fx.sfx.play('chirp')
  const arcs = new Graphics()
  arcs.blendMode = 'add'
  fx.add(arcs, 'front')
  let acc = 0
  await fx.during(900, (dt) => {
    const h = fx.ninja.hand()
    acc += dt
    if (acc > 40) {
      acc = 0
      arcs.clear()
      arcs.circle(h.x, h.y, 5 + Math.random() * 2).fill({ color: 0x9fe8ff, alpha: 0.5 })
      for (let i = 0; i < 4; i++) {
        const a = rand(0, Math.PI * 2)
        drawBolt(arcs, h.x, h.y, h.x + Math.cos(a) * rand(10, 22), h.y + Math.sin(a) * rand(8, 18), { segs: 4, jitter: 3, width: 1, branches: 0 })
      }
      fx.p.emit({ x: h.x, y: h.y, count: 3, speed: 90, life: 150, size: 1, colors: PAL.elec, add: true, stretch: 0.05 })
    }
  })
  // 冲刺
  fx.ninja.play('dash', 500)
  fx.sfx.play('whoosh')
  const startX = fx.ninja.x
  const endX = fx.dummy.x - 26
  await fx.tween(220, (t) => {
    fx.ninja.x = startX + (endX - startX) * t
    const h = fx.ninja.hand()
    arcs.clear()
    drawBolt(arcs, h.x - 30, h.y, h.x, h.y, { segs: 5, jitter: 4, width: 1, branches: 1 })
    fx.p.emit({ x: fx.ninja.x, y: fx.ninja.y - 20, count: 3, spreadY: 16, speed: 20, life: 200, size: 2, colors: PAL.elec, add: true, vx: -80 })
  }, ease.inQuad)
  fx.remove(arcs)
  fx.sfx.play('thunder')
  fx.cam.flash(0xffffff, 0.8, 140)
  fx.cam.shake(7, 400)
  fx.cam.slowmo(0.3, 300, fx.realNow)
  const c = fx.dummy.center()
  fx.p.emit({ x: c.x, y: c.y, count: 50, speed: 180, life: 350, size: 1, colors: PAL.elec, add: true, stretch: 0.04 })
  for (let i = 0; i < 4; i++) boltFlash(fx, c, { x: c.x + rand(-60, 60), y: c.y + rand(-50, 40) }, 220, { segs: 6, jitter: 6 })
  fx.hit(1, { knock: 2.5 })
  await fx.wait(500)
  // 归位
  fx.ninja.play('jump', 400)
  await fx.tween(300, (t) => {
    fx.ninja.x = endX + (fx.ninja.baseX - endX) * t
    fx.ninja.y = fx.ninja.baseY - Math.sin(t * Math.PI) * 30
  })
  fx.ninja.x = fx.ninja.baseX
  fx.ninja.y = fx.ninja.baseY
  await fx.wait(200)
}

/** 雷遁·落雷：从天而降的雷击 */
const thunder: EffectFn = async (fx) => {
  fx.ninja.play('success', 1200)
  fx.stage.setStorm(true)
  fx.sfx.play('rumble')
  await fx.wait(500)
  const c = fx.dummy.center()
  for (let i = 0; i < 2; i++) {
    fx.sfx.play('thunder')
    fx.cam.flash(0xdff9ff, 0.7, 120)
    boltFlash(fx, { x: c.x + rand(-20, 20), y: -10 }, { x: c.x, y: c.y }, 260, { segs: 14, jitter: 12, width: 3, branches: 4 })
    fx.p.emit({ x: c.x, y: fx.GY - 2, count: 30, angle: -Math.PI / 2, arc: 2, speed: 140, life: 300, size: 1, colors: PAL.elec, add: true, stretch: 0.04 })
    fx.cam.shake(5, 250)
    fx.hit(0.5, { knock: 0.4 })
    await fx.wait(260)
  }
  fx.stage.scorch(fx.dummy.x, 30)
  await fx.wait(500)
  fx.stage.setStorm(false)
}

/** 雷网：电网罩住目标 */
const thundernet: EffectFn = async (fx) => {
  fx.ninja.play('cast', 1600)
  fx.sfx.play('zap')
  const h = fx.ninja.hand()
  const c = fx.dummy.center()
  const net = new Graphics()
  net.blendMode = 'add'
  fx.add(net, 'front')
  let acc = 99
  await fx.during(1300, (dt, t) => {
    acc += dt
    if (acc < 50) return
    acc = 0
    net.clear()
    const k = Math.min(1, t * 2.5)
    const tx = h.x + (c.x - h.x) * k
    for (let i = -2; i <= 2; i++) {
      drawBolt(net, h.x, h.y, tx, c.y + i * 12 * k, { segs: 6, jitter: 4, width: 1, branches: 0, alpha: 0.9 })
    }
    if (k >= 1) {
      // 网格
      for (let i = -2; i <= 2; i++) {
        drawBolt(net, c.x - 22, c.y + i * 12, c.x + 22, c.y + i * 12, { segs: 5, jitter: 2, width: 1, branches: 0 })
        drawBolt(net, c.x + i * 10, c.y - 32, c.x + i * 10, c.y + 32, { segs: 5, jitter: 2, width: 1, branches: 0 })
      }
      if (Math.random() < 0.4) {
        fx.sfx.play('zap')
        fx.hit(0.12, { knock: 0.1 })
      }
    }
  })
  fx.remove(net)
  fx.hit(0.3)
  fx.cam.flash(0x9fe8ff, 0.3, 120)
  await fx.wait(400)
}

/** 麒麟：乌云聚集 → 雷兽降临 */
const kirin: EffectFn = async (fx) => {
  fx.cam.letterbox(true)
  fx.cam.darken(0.75, 0x03040c)
  fx.stage.setStorm(true)
  fx.ninja.play('success', 2600)
  fx.sfx.play('rumble')
  // 远处闪电预兆
  for (let i = 0; i < 3; i++) {
    await fx.wait(380)
    fx.sfx.play('zap')
    boltFlash(fx, { x: rand(40, fx.W - 40), y: -5 }, { x: rand(40, fx.W - 40), y: rand(30, 70) }, 150, { segs: 8, jitter: 10, width: 1 })
    fx.cam.flash(0x9fe8ff, 0.15, 100)
  }
  await fx.wait(300)
  const c = fx.dummy.center()
  fx.cam.zoomTo(1.25, c.x, c.y - 30)
  fx.cam.slowmo(0.25, 900, fx.realNow)
  fx.sfx.play('thunder')
  fx.sfx.play('bigExplode')
  fx.cam.flash(0xffffff, 1, 400)
  // 雷兽：多条粗雷柱 + 兽形轮廓
  const beast = new Graphics()
  beast.blendMode = 'add'
  fx.add(beast, 'front')
  let acc = 99
  await fx.during(900, (dt, t) => {
    acc += dt
    if (acc < 40) return
    acc = 0
    beast.clear()
    const a = 1 - t * 0.6
    for (let i = 0; i < 3; i++) drawBolt(beast, c.x + rand(-30, 30), -20, c.x + rand(-6, 6), fx.GY - 4, { segs: 16, jitter: 14, width: 4, branches: 5, alpha: a })
    // 兽头
    const hx = c.x - 10, hy = c.y - 90 + t * 60
    beast.poly([hx - 40, hy, hx, hy - 18, hx + 40, hy - 6, hx + 20, hy + 16, hx - 20, hy + 20]).fill({ color: 0x9fe8ff, alpha: 0.35 * a })
    beast.poly([hx + 20, hy - 12, hx + 34, hy - 34, hx + 28, hy - 8]).fill({ color: 0xdff9ff, alpha: 0.6 * a })
    fx.p.emit({ x: c.x, y: fx.GY - 4, count: 20, angle: -Math.PI / 2, arc: 2.6, speed: 200, life: 400, size: 1, colors: PAL.elec, add: true, stretch: 0.05 })
    fx.cam.shake(10, 120)
  })
  fx.remove(beast)
  fx.hit(1, { knock: 3, lift: 2.5 })
  fx.p.emit({ x: c.x, y: c.y, count: 120, speed: 260, life: 500, size: 1, colors: PAL.elec, add: true, stretch: 0.04 })
  fx.stage.scorch(fx.dummy.x, 120)
  fx.stage.crack(fx.dummy.x - 60, fx.dummy.x + 60)
  fx.cam.zoomTo(1)
  await fx.wait(1100)
  fx.stage.setStorm(false)
}

export const LIGHTNING_FX: Record<string, EffectFn> = { chidori, thunder, thundernet, kirin }
