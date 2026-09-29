import type { EffectFn, FxContext } from '../game/VFXManager'
import { EARTH_FX } from './Earth'
import { FIRE_FX } from './Fire'
import { LIGHTNING_FX } from './Lightning'
import { MISC_FX } from './Misc'
import { WATER_FX } from './Water'
import { WIND_FX } from './Wind'
import { PAL, bigText } from './common'

export const EFFECTS: Record<string, EffectFn> = {
  ...FIRE_FX, ...WATER_FX, ...LIGHTNING_FX, ...WIND_FX, ...EARTH_FX, ...MISC_FX,
}

const RANK_COLOR: Record<string, number> = { D: 0xc8c8d0, C: 0x7fe07a, B: 0x6fb8ff, A: 0xffb13b, S: 0xff4d6d }

/** 按等级的开场演出：术名 + 查克拉爆发 */
export async function rankIntro(fx: FxContext): Promise<void> {
  const { j } = fx
  const n = fx.ninja
  const color = RANK_COLOR[j.rank]
  bigText(fx, j.name, fx.W / 2, 46, color, j.rank === 'S' ? 18 : j.rank === 'A' ? 16 : 13, 1300)
  fx.p.emit({ x: n.x, y: n.y - 4, count: 12 + 'DCBAS'.indexOf(j.rank) * 10, spreadX: 10, angle: -Math.PI / 2, arc: 1, speed: 70, life: 500, size: 2, colors: PAL.chakra, add: true })
  if (j.rank === 'A' || j.rank === 'S') {
    fx.cam.flash(color, 0.25, 200)
    fx.cam.shake(2, 200)
    await fx.wait(250)
  }
}

export function rankOutro(fx: FxContext): void {
  if (fx.j.rank === 'S') fx.cam.flash(0xffffff, 0.3, 300)
}
