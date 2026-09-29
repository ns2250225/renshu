import type { SealId } from './seals'

export interface StabilizerOptions {
  windowSize: number
  /** 同一手印在窗口内的最低占比 */
  ratio: number
  /** 占比满足后需要持续的时间 */
  holdMs: number
}

export interface StabilizerState {
  /** 窗口中占比最高的手印（可能为 null，表示无手印） */
  dominant: SealId | null
  dominantRatio: number
  /** 已满足条件的稳定手印 */
  stable: SealId | null
  /** 0~1，距离确认的进度 */
  progress: number
  /** 窗口中“无手印”帧的占比 */
  emptyRatio: number
}

const MIN_FILL = 0.4

/** 滑动窗口手印稳定器：最近 N 帧的有效帧中同一手印 ≥ ratio 且持续 ≥ holdMs 才算稳定 */
export class GestureStabilizer {
  private frames: (SealId | null)[] = []
  private candidate: SealId | null = null
  private candidateSince = 0
  opts: StabilizerOptions

  constructor(opts: StabilizerOptions) {
    this.opts = { ...opts }
  }

  reset(): void {
    this.frames = []
    this.candidate = null
  }

  push(seal: SealId | null, now: number): StabilizerState {
    const { windowSize, ratio, holdMs } = this.opts
    this.frames.push(seal)
    while (this.frames.length > windowSize) this.frames.shift()

    const counts = new Map<SealId | null, number>()
    for (const f of this.frames) counts.set(f, (counts.get(f) ?? 0) + 1)
    let dominant: SealId | null = null
    let best = 0
    for (const [k, v] of counts) {
      if (k !== null && v > best) { best = v; dominant = k }
    }
    // 偶尔漏检的空帧不打断判定：占比按「有手印的帧」计算，但至少要占整个窗口的 40%
    const empty = counts.get(null) ?? 0
    const valid = this.frames.length - empty
    const dominantRatio = valid ? best / valid : 0
    const fill = best / windowSize
    const emptyRatio = empty / Math.max(1, this.frames.length)
    const ok = dominantRatio >= ratio && fill >= MIN_FILL

    if (dominant && ok) {
      if (this.candidate !== dominant) {
        this.candidate = dominant
        this.candidateSince = now
      }
    } else {
      this.candidate = null
    }

    const held = this.candidate ? now - this.candidateSince : 0
    const stable = this.candidate && held >= holdMs ? this.candidate : null
    const ratioProgress = Math.min(1, fill / MIN_FILL, dominantRatio / ratio)
    const progress = stable ? 1 : this.candidate ? 0.5 + 0.5 * Math.min(1, held / holdMs) : 0.5 * ratioProgress
    return { dominant, dominantRatio, stable, progress, emptyRatio }
  }
}
