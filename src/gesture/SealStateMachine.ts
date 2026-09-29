import type { StabilizerState } from './GestureStabilizer'
import type { SealId } from './seals'

export type SealPhase = 'WAITING' | 'DETECTING' | 'CONFIRMED' | 'LOCKED' | 'RELEASE'

/**
 * 防重复输入状态机：
 * WAITING → DETECTING → CONFIRMED → LOCKED → RELEASE → WAITING
 * 保持同一手印只记录一次；只有换手势或双手离开才解除 LOCK。
 */
export class SealStateMachine {
  phase: SealPhase = 'WAITING'
  locked: SealId | null = null
  private emptySince = 0
  /** 双手离开多久视为释放 */
  releaseMs = 250

  private onConfirm: (seal: SealId) => void

  constructor(onConfirm: (seal: SealId) => void) {
    this.onConfirm = onConfirm
  }

  reset(): void {
    this.phase = 'WAITING'
    this.locked = null
  }

  update(s: StabilizerState, handsPresent: boolean, now: number): SealPhase {
    const empty = !handsPresent || s.emptyRatio >= 0.7
    if (empty) {
      if (!this.emptySince) this.emptySince = now
    } else {
      this.emptySince = 0
    }
    const handsGone = empty && now - this.emptySince >= this.releaseMs

    switch (this.phase) {
      case 'WAITING':
      case 'RELEASE':
        if (s.stable) this.confirm(s.stable)
        else this.phase = s.dominant ? 'DETECTING' : 'WAITING'
        break
      case 'DETECTING':
        if (s.stable) this.confirm(s.stable)
        else if (!s.dominant) this.phase = 'WAITING'
        break
      case 'CONFIRMED':
        this.phase = 'LOCKED'
        break
      case 'LOCKED':
        if (s.stable && s.stable !== this.locked) {
          // 换了新手势：先释放再确认新印
          this.phase = 'RELEASE'
          this.confirm(s.stable)
        } else if (handsGone) {
          this.phase = 'RELEASE'
          this.locked = null
        }
        break
    }
    return this.phase
  }

  private confirm(seal: SealId): void {
    this.phase = 'CONFIRMED'
    this.locked = seal
    this.onConfirm(seal)
  }
}
