import { Graphics } from 'pixi.js'
import { Ninja } from '../game/Ninja'
import type { EffectFn, FxContext } from '../game/VFXManager'
import { PAL, bigText, dust, ease, explosion, poof, rand, rocks, sealCircle } from './common'

function spawnClone(fx: FxContext, x: number, y: number): Ninja {
  const n = new Ninja()
  n.position.set(x, y)
  n.baseX = x
  n.baseY = y
  n.alpha = 0.95
  fx.add(n, 'front', (dt) => {
    n.update(dt)
  })
  poof(fx, x, y - 20, 0.8)
  return n
}

/** 木遁·树界降诞：藤蔓缠绕 + 巨木 */
const wood: EffectFn = async (fx) => {
  fx.cam.letterbox(true)
  fx.cam.darken(0.45, 0x06140a)
  fx.ninja.play('ult', 2600)
  fx.sfx.play('rumble')
  fx.sfx.play('wood')
  const vines = new Graphics()
  fx.add(vines, 'front')
  const c = fx.dummy.center()
  const roots = Array.from({ length: 6 }, (_, i) => ({ x: fx.ninja.x + 40 + i * 44 + rand(-8, 8), ph: rand(0, 6) }))
  await fx.tween(1400, (t) => {
    vines.clear()
    for (const r of roots) {
      const len = t * 1.2
      let px = r.x, py = fx.GY
      vines.moveTo(px, py)
      for (let k = 0; k < 16 * Math.min(1, len); k++) {
        const kt = k / 16
        const tx = r.x + (c.x - r.x) * kt
        const ty = fx.GY - Math.sin(kt * Math.PI) * 60 + (c.y - fx.GY) * kt
        px = tx + Math.sin(kt * 8 + r.ph) * 6
        py = ty
        vines.lineTo(Math.round(px), Math.round(py))
      }
      vines.stroke({ width: 4, color: 0x6b4226 })
      vines.moveTo(r.x, fx.GY)
      vines.stroke({ width: 1, color: 0x8a5a34 })
      if (Math.random() < 0.3) fx.p.emit({ x: px, y: py, count: 1, speed: 30, life: 900, size: 2, colors: PAL.leaf, gravity: 30, wobble: 3 })
    }
    fx.cam.shake(2, 60)
    if (Math.random() < 0.1) fx.sfx.play('wood')
  })
  // 缠绕
  fx.hit(0.6, { status: ['stunned'], statusMs: 3000 })
  const wrap = new Graphics()
  fx.add(wrap, 'front')
  for (let i = 0; i < 5; i++) wrap.rect(c.x - 14, c.y - 22 + i * 10, 28, 3).fill(0x6b4226)
  fx.cam.shake(6, 400)
  fx.sfx.play('rock')
  rocks(fx, fx.dummy.x, fx.GY, 1)
  await fx.wait(600)
  // 巨木冲天
  const tree = new Graphics()
  fx.add(tree, 'back')
  await fx.tween(500, (t) => {
    const h = 200 * ease.outCubic(t)
    tree.clear()
    tree.rect(c.x - 16, fx.GY - h, 32, h).fill(0x6b4226)
    tree.rect(c.x + 8, fx.GY - h, 8, h).fill(0x4a2c18)
    tree.circle(c.x, fx.GY - h, 30 * t).fill(0x2f7d34)
    tree.circle(c.x - 16, fx.GY - h + 10, 18 * t).fill(0x4fae3f)
  })
  fx.hit(0.4, { lift: 3 })
  fx.p.emit({ x: c.x, y: 40, count: 60, spreadX: 50, speed: 60, gravity: 40, life: 1800, size: 2, colors: PAL.leaf, wobble: 4 })
  await fx.wait(900)
  await fx.tween(400, (t) => {
    tree.alpha = 1 - t
    vines.alpha = 1 - t
    wrap.alpha = 1 - t
  })
}

/** 分身术：两侧出现分身 */
const clone: EffectFn = async (fx) => {
  fx.ninja.play('seal', 400, 'success')
  await fx.wait(250)
  const clones = [spawnClone(fx, fx.ninja.x - 26, fx.ninja.y), spawnClone(fx, fx.ninja.x + 26, fx.ninja.y)]
  clones.forEach((c) => c.play('success', 900))
  await fx.wait(900)
  // 分身冲出轻击
  for (const c of clones) {
    c.play('dash', 400)
    const sx = c.x
    fx.tween(300, (t) => {
      c.x = sx + (fx.dummy.x - 20 - sx) * t
    }, ease.inQuad).then(() => {
      fx.sfx.play('hit')
      fx.hit(0.5, { knock: 0.5 })
      poof(fx, c.x, c.y - 20, 0.7)
      c.visible = false
    })
    await fx.wait(160)
  }
  await fx.wait(600)
}

/** 影分身之术：大量分身连续攻击 */
const shadowclone: EffectFn = async (fx) => {
  fx.cam.darken(0.3)
  fx.ninja.play('seal', 500, 'success')
  await fx.wait(300)
  const clones: Ninja[] = []
  const spots = [[-30, 0], [30, 0], [-14, -26], [16, -26], [56, 0], [80, -18], [110, 0], [140, -12]]
  for (const [dx, dy] of spots) {
    clones.push(spawnClone(fx, fx.ninja.x + dx, fx.ninja.y + dy))
    await fx.wait(60)
  }
  for (const c of clones) {
    if (c.y < fx.GY) {
      const y0 = c.y
      fx.tween(200, (t) => { c.y = y0 + (fx.GY - y0) * t })
    }
  }
  await fx.wait(500)
  let combo = 0
  const c0 = fx.dummy.center()
  for (let round = 0; round < 2; round++) {
    for (const c of clones) {
      c.play(Math.random() < 0.5 ? 'kick' : 'attack', 300)
      const sx = c.baseX
      const tx = fx.dummy.x + (Math.random() < 0.5 ? -22 : 22)
      c.facing = tx > fx.dummy.x ? -1 : 1
      c.y = fx.GY
      fx.sfx.play('whoosh')
      await fx.tween(110, (t) => { c.x = sx + (tx - sx) * t })
      fx.sfx.play('hit')
      combo++
      fx.hit(1 / 16, { knock: c.facing * 0.4, lift: combo > 12 ? 1.2 : 0 })
      fx.p.emit({ x: c0.x + rand(-8, 8), y: c0.y + rand(-16, 16), count: 8, speed: 80, life: 180, size: 2, colors: [0xffffff, 0xffe066], add: true })
      bigText(fx, `${combo} HIT`, fx.dummy.x, fx.GY - 110, 0xffe066, 10, 350)
      fx.cam.shake(2, 80)
      await fx.tween(80, (t) => { c.x = tx + (sx - tx) * t })
      c.facing = 1
    }
  }
  for (const c of clones) {
    poof(fx, c.x, c.y - 20, 0.8)
    c.visible = false
    await fx.wait(40)
  }
  await fx.wait(400)
}

/** 起爆符：投掷苦无 → 爆炸 */
const explosivetag: EffectFn = async (fx) => {
  fx.ninja.play('attack', 500)
  fx.sfx.play('whoosh')
  const h = fx.ninja.hand()
  const c = fx.dummy.center()
  const kunai = new Graphics()
  kunai.rect(-6, -1, 10, 2).fill(0x8a8aa0)
  kunai.poly([4, -3, 9, 0, 4, 3]).fill(0xd5dce8)
  kunai.rect(-12, -3, 6, 6).fill(0xf5e6b0)
  kunai.rect(-11, -2, 4, 4).fill(0xd8323c)
  fx.add(kunai, 'front')
  await fx.tween(300, (t) => {
    kunai.position.set(Math.round(h.x + (c.x - 6 - h.x) * t), Math.round(h.y + (c.y - h.y) * t))
  })
  fx.sfx.play('hit')
  fx.hit(0.1)
  // 火花嘶嘶燃烧
  await fx.during(700, () => {
    fx.p.emit({ x: kunai.x - 12, y: kunai.y, count: 2, speed: 50, life: 200, size: 1, colors: [0xffffff, 0xffd23f], add: true, gravity: 100 })
  })
  fx.remove(kunai)
  fx.sfx.play('bigExplode')
  explosion(fx, c.x, c.y, 1.8)
  fx.cam.flash(0xffffff, 0.6, 180)
  fx.cam.shake(7, 450)
  fx.hit(0.9, { knock: 2, lift: 1.5 })
  fx.stage.scorch(fx.dummy.x, 60)
  await fx.wait(800)
}

/** 表莲华：踢飞 → 空中抓住 → 回旋坠地 */
const lotus: EffectFn = async (fx) => {
  fx.ninja.play('dash', 300)
  fx.sfx.play('whoosh')
  const sx = fx.ninja.x
  const tx = fx.dummy.x - 22
  await fx.tween(200, (t) => { fx.ninja.x = sx + (tx - sx) * t }, ease.inQuad)
  fx.ninja.play('kick', 400)
  fx.sfx.play('hit')
  fx.hit(0.3, { lift: 5 })
  fx.cam.shake(4, 200)
  dust(fx, fx.dummy.x, fx.GY, 0.8)
  await fx.wait(150)
  // 跳跃追上
  fx.ninja.play('jump', 600)
  await fx.tween(450, (t) => {
    fx.ninja.x = tx + 10 * t
    fx.ninja.y = fx.ninja.baseY - ease.outQuad(t) * 130
    fx.p.emit({ x: fx.ninja.x, y: fx.ninja.y, count: 1, speed: 10, life: 200, size: 2, colors: PAL.whiteSmoke, alpha: 0.5 })
  })
  fx.cam.zoomTo(1.3, fx.dummy.x, fx.GY - 120)
  fx.cam.slowmo(0.4, 500, fx.realNow)
  bigText(fx, '表莲华!', fx.dummy.x - 10, fx.GY - 170, 0xff5d73, 14, 800)
  await fx.wait(250)
  // 回旋下坠
  fx.sfx.play('wind')
  const y0 = fx.ninja.y
  await fx.tween(380, (t) => {
    fx.ninja.y = y0 + (fx.ninja.baseY - y0) * ease.inQuad(t)
    fx.ninja.facing = Math.floor(t * 10) % 2 ? 1 : -1
    fx.p.emit({ x: fx.ninja.x + rand(-12, 12), y: fx.ninja.y - 20, count: 3, speed: 50, life: 250, size: 1, colors: PAL.wind, aspect: 5 })
  })
  fx.ninja.facing = 1
  fx.cam.zoomTo(1)
  fx.sfx.play('bigExplode')
  fx.hit(0.7, { knock: 1.5 })
  fx.cam.shake(9, 500)
  fx.cam.flash(0xffffff, 0.5, 140)
  rocks(fx, fx.dummy.x, fx.GY, 1.5)
  dust(fx, fx.dummy.x, fx.GY, 2)
  fx.stage.crack(fx.dummy.x - 40, fx.dummy.x + 40)
  await fx.wait(400)
  fx.ninja.play('jump', 400)
  const ex = fx.ninja.x
  await fx.tween(350, (t) => {
    fx.ninja.x = ex + (fx.ninja.baseX - ex) * t
    fx.ninja.y = fx.ninja.baseY - Math.sin(t * Math.PI) * 30
  })
  fx.ninja.position.set(fx.ninja.baseX, fx.ninja.baseY)
}

/** 通灵术：法阵 + 巨蛤蟆落地 */
const summoning: EffectFn = async (fx) => {
  fx.cam.darken(0.4)
  fx.ninja.play('charge', 700, 'cast')
  fx.sfx.play('cast')
  const cx = fx.ninja.x + 110
  sealCircle(fx, cx, fx.GY + 2, 50, 0xc78bff, 1800)
  await fx.wait(700)
  fx.sfx.play('poof')
  fx.p.emit({ x: cx, y: fx.GY - 40, count: 60, spreadX: 30, spreadY: 30, speed: 60, drag: 2, life: 1100, size: 10, endSize: 20, colors: PAL.whiteSmoke, alpha: 0.9 })
  fx.cam.shake(6, 400)
  const toad = new Graphics()
  const draw = (sq: number) => {
    toad.clear()
    const w = 80, h = 56 * sq
    const top = fx.GY - h
    toad.ellipse(cx, fx.GY - h / 2, w / 2, h / 2).fill(0xd06a2a)
    toad.ellipse(cx, fx.GY - h / 2 + 8, w / 2 - 6, h / 2 - 10).fill(0xe8a060)
    toad.circle(cx - 18, top + 6, 9).fill(0xd06a2a)
    toad.circle(cx + 18, top + 6, 9).fill(0xd06a2a)
    toad.rect(cx - 22, top + 3, 8, 6).fill(0xfff1a8)
    toad.rect(cx + 14, top + 3, 8, 6).fill(0xfff1a8)
    toad.rect(cx - 20, top + 5, 4, 3).fill(0x15121f)
    toad.rect(cx + 16, top + 5, 4, 3).fill(0x15121f)
    toad.rect(cx - 30, top + 22, 60, 2).fill(0x7a3a1a)
    toad.rect(cx - 36, fx.GY - 6, 14, 6).fill(0xb05a22)
    toad.rect(cx + 22, fx.GY - 6, 14, 6).fill(0xb05a22)
  }
  fx.add(toad, 'back')
  await fx.tween(400, (t) => draw(0.6 + ease.outBack(t) * 0.4))
  fx.sfx.play('rumble')
  await fx.wait(400)
  // 蛤蟆跳压
  const dxTo = fx.dummy.x - cx
  await fx.tween(500, (t) => {
    toad.x = dxTo * t
    toad.y = -Math.sin(t * Math.PI) * 60
  })
  fx.sfx.play('bigExplode')
  fx.hit(1, { knock: 2 })
  fx.cam.shake(10, 600)
  dust(fx, fx.dummy.x, fx.GY, 2.5)
  rocks(fx, fx.dummy.x, fx.GY, 1.5)
  fx.stage.crack(fx.dummy.x - 60, fx.dummy.x + 60)
  await fx.wait(600)
  poof(fx, fx.dummy.x, fx.GY - 30, 2)
  toad.visible = false
  await fx.wait(500)
}

/** 替身术：原地变成木桩，瞬移到稻草人身后 */
const substitution: EffectFn = async (fx) => {
  const n = fx.ninja
  poof(fx, n.x, n.y - 20, 1)
  const log = new Graphics()
  log.rect(n.x - 6, n.y - 30, 12, 30).fill(0x8a5a34)
  log.rect(n.x - 6, n.y - 30, 12, 3).fill(0xc79a6a)
  log.rect(n.x + 2, n.y - 27, 3, 27).fill(0x6b4226)
  fx.add(log, 'back')
  n.visible = false
  await fx.wait(450)
  n.position.set(fx.dummy.x + 30, n.baseY)
  n.facing = -1
  n.visible = true
  poof(fx, n.x, n.y - 20, 0.8)
  n.play('attack', 400)
  await fx.wait(200)
  fx.sfx.play('hit')
  fx.hit(1, { knock: -1.5 })
  fx.cam.shake(3, 200)
  await fx.wait(600)
  poof(fx, n.x, n.y - 20, 0.8)
  n.position.set(n.baseX, n.baseY)
  n.facing = 1
  poof(fx, n.x, n.y - 20, 0.8)
  fx.remove(log)
  await fx.wait(300)
}

/** 尸鬼封尽：死神浮现，抽出灵魂 */
const reaper: EffectFn = async (fx) => {
  fx.cam.letterbox(true)
  fx.cam.darken(0.85, 0x0a0214)
  fx.sfx.play('dark')
  fx.ninja.play('seal', 3600, 'tired')
  await fx.wait(600)
  const ghost = new Graphics()
  ghost.blendMode = 'add'
  fx.add(ghost, 'front')
  const gx = fx.ninja.x + 10
  const gy = fx.ninja.y - 90
  await fx.tween(900, (t) => {
    const a = t
    ghost.clear()
    // 死神轮廓
    ghost.poly([gx - 40, gy + 70, gx - 26, gy - 10, gx, gy - 30, gx + 26, gy - 10, gx + 40, gy + 70]).fill({ color: 0x40287a, alpha: 0.5 * a })
    ghost.circle(gx, gy - 24, 16).fill({ color: 0x7a4fd8, alpha: 0.5 * a })
    ghost.poly([gx - 14, gy - 40, gx - 22, gy - 58, gx - 6, gy - 44]).fill({ color: 0xe6d0ff, alpha: 0.6 * a })
    ghost.poly([gx + 14, gy - 40, gx + 22, gy - 58, gx + 6, gy - 44]).fill({ color: 0xe6d0ff, alpha: 0.6 * a })
    ghost.rect(gx - 9, gy - 28, 5, 3).fill({ color: 0xffffff, alpha: a })
    ghost.rect(gx + 4, gy - 28, 5, 3).fill({ color: 0xffffff, alpha: a })
    ghost.rect(gx - 8, gy - 18, 16, 2).fill({ color: 0xe6d0ff, alpha: a })
    fx.p.emit({ x: gx + rand(-30, 30), y: gy + rand(-20, 60), count: 1, speed: 15, angle: -Math.PI / 2, life: 800, size: 3, endSize: 6, colors: PAL.purple, add: true, alpha: 0.6 })
  })
  fx.cam.zoomTo(1.2, (gx + fx.dummy.x) / 2, gy + 20)
  fx.cam.slowmo(0.4, 1500, fx.realNow)
  fx.sfx.play('dark')
  // 死神之手伸向稻草人
  const arm = new Graphics()
  arm.blendMode = 'add'
  fx.add(arm, 'front')
  const c = fx.dummy.center()
  await fx.tween(700, (t) => {
    arm.clear()
    const ex = gx + 26 + (c.x - gx - 26) * ease.outQuad(t)
    const ey = gy + 10 + (c.y - gy - 10) * ease.outQuad(t)
    arm.moveTo(gx + 26, gy + 10).lineTo(ex, ey).stroke({ width: 4, color: 0x7a4fd8, alpha: 0.7 })
    arm.circle(ex, ey, 5).fill({ color: 0xe6d0ff, alpha: 0.8 })
  })
  // 抽出灵魂
  fx.cam.flash(0xb48cff, 0.6, 300)
  fx.sfx.play('bigExplode')
  const soul = new Graphics()
  soul.blendMode = 'add'
  fx.add(soul, 'front')
  await fx.tween(900, (t) => {
    soul.clear()
    const sx = c.x + (gx - c.x) * ease.inQuad(t)
    const sy = c.y + (gy - c.y) * ease.inQuad(t)
    soul.circle(sx, sy, 8 - t * 4).fill({ color: 0xffffff, alpha: 0.9 })
    soul.circle(sx, sy, 12 - t * 4).fill({ color: 0xb48cff, alpha: 0.4 })
    fx.p.emit({ x: sx, y: sy, count: 2, speed: 20, life: 400, size: 2, colors: PAL.purple, add: true })
    if (t < 0.1) fx.hit(0.1)
  })
  fx.hit(0.9, { status: ['stunned'], statusMs: 2500 })
  fx.cam.shake(8, 600)
  fx.cam.zoomTo(1)
  await fx.tween(600, (t) => {
    ghost.alpha = 1 - t
    arm.alpha = 1 - t
    soul.alpha = 1 - t
  })
  fx.ninja.play('tired', 1200)
  await fx.wait(600)
}

export const MISC_FX: Record<string, EffectFn> = {
  wood, clone, shadowclone, explosivetag, lotus, summoning, substitution, reaper,
}
