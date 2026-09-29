import { Graphics } from 'pixi.js'
import type { EffectFn } from '../game/VFXManager'
import { PAL, dust, ease, rand, rocks } from './common'

function rockBlock(g: Graphics, x: number, y: number, w: number, h: number): void {
  g.rect(x, y, w, h).fill(0x7a6b5a)
  g.rect(x, y, w, 3).fill(0x9b8b78)
  g.rect(x + w - 3, y + 3, 3, h - 3).fill(0x5c4f42)
  for (let i = 0; i < h / 8; i++) g.rect(x + 3 + ((i * 7) % Math.max(1, w - 8)), y + 6 + i * 8, 4, 1).fill(0x5c4f42)
}

/** 土流壁：地面升起土墙，之后崩塌砸向前方 */
const earthwall: EffectFn = async (fx) => {
  fx.ninja.play('charge', 1600)
  fx.sfx.play('rumble')
  const wx = fx.ninja.x + 50
  const wall = new Graphics()
  fx.add(wall, 'back')
  await fx.tween(700, (t) => {
    const h = 70 * t
    wall.clear()
    rockBlock(wall, wx - 18, fx.GY - h, 36, h)
    dust(fx, wx + rand(-18, 18), fx.GY, 0.3)
    fx.cam.shake(2, 60)
  }, ease.outQuad)
  fx.stage.crack(wx - 24, wx + 24)
  await fx.wait(500)
  // 墙体倒塌产生碎石冲击
  fx.sfx.play('rock')
  await fx.tween(300, (t) => {
    wall.alpha = 1 - t
  })
  fx.remove(wall)
  rocks(fx, wx, fx.GY - 20, 1.2)
  await fx.during(400, (_dt, t) => {
    const x = wx + (fx.dummy.x - wx) * t
    rocks(fx, x, fx.GY - 2, 0.15)
  })
  fx.hit(1, { knock: 1 })
  fx.cam.shake(4, 250)
  await fx.wait(400)
}

/** 岩柱：目标脚下突起石柱击飞 */
const rockpillar: EffectFn = async (fx) => {
  fx.ninja.play('cast', 1400)
  fx.sfx.play('rumble')
  const x = fx.dummy.x
  // 预兆裂缝
  await fx.during(400, () => {
    fx.p.emit({ x: x + rand(-14, 14), y: fx.GY, count: 1, angle: -Math.PI / 2, arc: 0.6, speed: 40, gravity: 200, life: 400, size: 2, colors: PAL.dust })
    fx.cam.shake(1.5, 60)
  })
  fx.stage.crack(x - 30, x + 30)
  fx.sfx.play('rock')
  const pillar = new Graphics()
  fx.add(pillar, 'back')
  fx.hit(1, { lift: 4 })
  rocks(fx, x, fx.GY, 1.2)
  fx.cam.shake(6, 350)
  await fx.tween(700, (t) => {
    const h = t < 0.2 ? (t / 0.2) * 90 : t > 0.75 ? 90 * (1 - (t - 0.75) / 0.25) : 90
    pillar.clear()
    pillar.poly([x - 16, fx.GY, x - 10, fx.GY - h, x + 10, fx.GY - h - 6, x + 16, fx.GY]).fill(0x7a6b5a)
    pillar.poly([x + 4, fx.GY - h - 4, x + 10, fx.GY - h - 6, x + 16, fx.GY, x + 8, fx.GY]).fill(0x5c4f42)
  })
  fx.remove(pillar)
  await fx.wait(600)
}

/** 土龙弹：土龙从地里冲出，喷射泥弹 */
const earthdragon: EffectFn = async (fx) => {
  fx.cam.darken(0.4)
  fx.ninja.play('ult', 2200)
  fx.sfx.play('rumble')
  const hx = fx.ninja.x + 60
  const head = new Graphics()
  fx.add(head, 'back')
  await fx.tween(700, (t) => {
    const h = 60 * ease.outBack(t)
    head.clear()
    head.rect(hx - 12, fx.GY - h, 24, h).fill(0x7a5a3a)
    head.rect(hx - 12, fx.GY - h, 30, 16).fill(0x8c6a44)
    head.rect(hx + 10, fx.GY - h + 10, 10, 4).fill(0x4a321e)
    head.rect(hx + 2, fx.GY - h + 3, 4, 3).fill(0xffd23f)
    head.rect(hx - 10, fx.GY - h - 4, 4, 4).fill(0x5c4f42)
    dust(fx, hx + rand(-14, 14), fx.GY, 0.4)
    fx.cam.shake(3, 80)
  })
  fx.stage.crack(hx - 30, hx + 30)
  const mouth = { x: hx + 18, y: fx.GY - 48 }
  const c = fx.dummy.center()
  for (let i = 0; i < 5; i++) {
    fx.sfx.play('rock')
    const g = new Graphics()
    g.rect(-4, -4, 8, 8).fill(0x6b4a2a)
    g.rect(-4, -4, 8, 2).fill(0x8c6a44)
    g.position.set(mouth.x, mouth.y)
    const ty = c.y + rand(-15, 15)
    fx.add(g, 'front')
    fx.tween(400, (t) => {
      g.position.set(Math.round(mouth.x + (c.x - mouth.x) * t), Math.round(mouth.y + (ty - mouth.y) * t - Math.sin(t * Math.PI) * 20))
      g.rotation += 0.2
    }).then(() => {
      fx.remove(g)
      rocks(fx, c.x, ty, 0.5)
      fx.hit(0.2, { knock: 0.5 })
      fx.cam.shake(3, 120)
    })
    await fx.wait(170)
  }
  await fx.wait(500)
  await fx.tween(400, (t) => {
    head.alpha = 1 - t
  })
  fx.remove(head)
  await fx.wait(200)
}

export const EARTH_FX: Record<string, EffectFn> = { earthwall, rockpillar, earthdragon }
