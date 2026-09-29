import type { SealId } from '../gesture/seals'
import { db } from '../store/db'
import { persistProfile, state, type CastResult, type Rating } from '../store/game'
import { JutsuMatcher } from './JutsuMatcher'
import { JUTSU_LIST, JUTSU_MAP, type JutsuDef, type Rank } from './types'

export interface GameHooks {
  onSeal(seal: SealId, count: number, rating: Rating): void
  onSealError(seal: SealId): void
  onSequenceClear(): void
  cast(j: JutsuDef): Promise<void>
  onCountdown(n: number): void
}

/** 前缀有更长忍术时，等待下一印的宽限时间 */
const PREFIX_GRACE_MS = 900

export class JutsuManager {
  readonly matcher = new JutsuMatcher(JUTSU_LIST)
  private hooks: GameHooks
  private queue: { j: JutsuDef; result: CastResult }[] = []
  private graceTimer = 0
  private resultTimer = 0
  private ratingKey = 0
  private firstSealAt = 0
  private lastSealAt = 0
  private streakFast = 0

  constructor(hooks: GameHooks) {
    this.hooks = hooks
    window.setInterval(() => this.checkTimeout(), 200)
  }

  async loadRecords(): Promise<void> {
    try {
      const rows = await db.records.toArray()
      for (const r of rows) state.records[r.jutsuId] = r
    } catch (e) {
      console.warn('[records]', e)
    }
  }

  get practiceTarget(): JutsuDef | null {
    if (state.mode === 'practice') return JUTSU_MAP[state.practiceId] ?? null
    if (state.mode === 'challenge') return JUTSU_MAP[state.challenge.target] ?? null
    return null
  }

  /** 当前期望的下一个手印，供识别端做宽松判定 */
  expectedSeals(): SealId[] {
    const seq = state.seq.map((s) => s.seal)
    const target = this.practiceTarget
    if (target) {
      if (state.mode === 'challenge' && state.challenge.phase !== 'active') return []
      const next = target.seals[seq.length]
      return next ? [next] : []
    }
    if (!seq.length) return []
    const out = new Set<SealId>()
    for (const c of this.matcher.candidates(seq)) {
      const n = c.jutsu.seals[seq.length]
      if (n) out.add(n)
    }
    return [...out]
  }

  setMode(mode: typeof state.mode): void {
    state.mode = mode
    this.clearSequence()
    state.challenge.phase = 'idle'
    state.chain = []
    if (mode === 'challenge') {
      state.challenge.round = 0
      state.challenge.score = 0
    }
  }

  clearSequence(): void {
    clearTimeout(this.graceTimer)
    state.seq = []
    state.candidates = []
    state.errors = 0
    state.pendingCast = null
    this.firstSealAt = 0
    this.streakFast = 0
    state.fastSeal = 0
    this.hooks.onSequenceClear()
  }

  private checkTimeout(): void {
    if (!state.seq.length || state.pendingCast) return
    if (state.mode === 'challenge') return
    if (performance.now() - this.lastSealAt > state.settings.seqTimeoutMs) this.clearSequence()
  }

  private rate(now: number): Rating {
    if (!this.lastSealAt || !state.seq.length) return 'GOOD'
    const dt = now - this.lastSealAt
    if (dt < 700) return 'PERFECT'
    if (dt < 1200) return 'GREAT'
    return 'GOOD'
  }

  private pushRating(text: string): void {
    state.lastRating = { text, key: ++this.ratingKey }
  }

  /** 识别确认的一个印 */
  input(seal: SealId): void {
    if (state.mode === 'challenge' && state.challenge.phase !== 'active') return
    const now = performance.now()
    if (state.mode === 'practice' || state.mode === 'challenge') this.inputGuided(seal, now)
    else this.inputFree(seal, now)
  }

  private accept(seal: SealId, now: number): void {
    const rating = this.rate(now)
    const fast = this.lastSealAt && now - this.lastSealAt < 800 && state.seq.length > 0
    this.streakFast = fast ? this.streakFast + 1 : 0
    state.fastSeal = this.streakFast + (fast ? 1 : 0)
    if (!state.seq.length) this.firstSealAt = now
    state.seq.push({ seal, t: now, rating, ok: true })
    this.lastSealAt = now
    state.combo++
    state.maxCombo = Math.max(state.maxCombo, state.combo)
    this.pushRating(state.fastSeal >= 3 ? `FAST SEAL ×${state.fastSeal}` : rating)
    state.recog.flash = 'ok'
    state.recog.flashKey++
    this.hooks.onSeal(seal, state.seq.length, rating)
  }

  private reject(seal: SealId, now: number): void {
    state.errors++
    state.combo = 0
    this.streakFast = 0
    state.fastSeal = 0
    void now
    state.recog.flash = 'fail'
    state.recog.flashKey++
    this.pushRating('MISS')
    this.hooks.onSealError(seal)
  }

  private inputFree(seal: SealId, now: number): void {
    clearTimeout(this.graceTimer)
    const pending = state.pendingCast
    state.pendingCast = null
    const next = [...state.seq.map((s) => s.seal), seal]

    if (!this.matcher.candidates(next).length) {
      if (pending) {
        // 宽限期内输入了不相干的印：先释放已匹配的忍术，再以此印为新起点
        this.fire(JUTSU_MAP[pending])
        if (!this.matcher.candidates([seal]).length) return
      } else {
        if (state.seq.length) this.reject(seal, now)
        // 保留仍能继续匹配的最长后缀
        const tail = this.matcher.recover(next)
        if (!tail.length) {
          if (!state.seq.length) this.reject(seal, now)
          state.seq = []
          state.candidates = []
          return
        }
        state.seq = state.seq.slice(state.seq.length - (tail.length - 1))
        if (!state.seq.length) this.firstSealAt = 0
      }
    }

    this.accept(seal, now)
    this.updateCandidates()
    this.evaluate()
  }

  private evaluate(): void {
    const seq = state.seq.map((s) => s.seal)
    const exact = this.matcher.exact(seq)
    if (!exact) return
    const longer = this.matcher.candidates(seq).some((c) => c.jutsu.seals.length > seq.length)
    if (longer) {
      state.pendingCast = exact.id
      this.graceTimer = window.setTimeout(() => {
        state.pendingCast = null
        this.fire(exact)
      }, PREFIX_GRACE_MS)
    } else {
      this.fire(exact)
    }
  }

  private inputGuided(seal: SealId, now: number): void {
    const target = this.practiceTarget
    if (!target) return
    const idx = state.seq.length
    if (target.seals[idx] === seal) {
      this.accept(seal, now)
      this.updateCandidates()
      if (state.seq.length === target.seals.length) this.fire(target)
    } else if (idx > 0 && state.seq[idx - 1].seal === seal) {
      // 同一印的重复确认，忽略
    } else {
      this.reject(seal, now)
      if (state.mode === 'practice' && target.seals[0] === seal && idx > 0) {
        state.seq = []
        this.accept(seal, now)
        this.updateCandidates()
      }
    }
  }

  private updateCandidates(): void {
    const seq = state.seq.map((s) => s.seal)
    const target = this.practiceTarget
    const list = target
      ? [{ jutsu: target, matched: seq.length, progress: seq.length / target.seals.length }]
      : this.matcher.candidates(seq)
    state.candidates = list.slice(0, 4).map((c) => ({
      id: c.jutsu.id,
      short: c.jutsu.short,
      element: c.jutsu.element,
      matched: c.matched,
      total: c.jutsu.seals.length,
      progress: c.progress,
    }))
  }

  /** 忍术匹配成功：计算成绩并排队释放 */
  private fire(j: JutsuDef): void {
    const now = performance.now()
    const startAt = state.mode === 'challenge' ? state.challenge.startAt : this.firstSealAt
    const time = Math.max(0.1, (this.lastSealAt - startAt) / 1000)
    const total = j.seals.length
    const accuracy = total / (total + state.errors)
    const avg = time / total
    const prev = state.records[j.id]
    const best = prev?.bestTime ?? null
    const newRecord = best === null || time < best
    const result: CastResult = {
      jutsuId: j.id,
      sealsDone: total,
      sealsTotal: total,
      errors: state.errors,
      accuracy,
      time,
      avg,
      best: newRecord ? time : best,
      newRecord: newRecord && best !== null,
      rank: j.rank,
      grade: state.mode === 'challenge' ? grade(accuracy, avg) : null,
    }
    const record = {
      jutsuId: j.id,
      bestTime: newRecord ? time : best!,
      casts: (prev?.casts ?? 0) + 1,
      lastTime: time,
    }
    state.records[j.id] = record
    db.records.put(record).catch(() => {})
    state.profile.xp += j.damage + (state.mode === 'challenge' ? 30 : 0)
    state.profile.casts++
    persistProfile()

    // 序列交给结印条展示完成动画，立即开始接受下一轮结印
    state.castSeq = { seals: state.seq.map((s) => s.seal), jutsuId: j.id, key: now }
    state.seq = []
    state.candidates = []
    state.errors = 0
    this.firstSealAt = 0
    this.streakFast = 0
    this.queue.push({ j, result })
    if (!state.casting) void this.drain()
    if (state.mode === 'challenge') {
      state.challenge.phase = 'done'
      state.challenge.score += scoreOf(result)
    }
  }

  private async drain(): Promise<void> {
    state.casting = true
    while (this.queue.length) {
      const { j, result } = this.queue.shift()!
      state.banner = { jutsuId: j.id, key: Date.now() }
      state.chain = [...state.chain, j.element].slice(-6)
      await this.hooks.cast(j)
      clearTimeout(this.resultTimer)
      state.result = result
      this.resultTimer = window.setTimeout(() => (state.result = null), 4200)
    }
    state.casting = false
  }

  /** 直接施放（图鉴预览） */
  preview(id: string): Promise<void> {
    const j = JUTSU_MAP[id]
    if (!j || state.casting) return Promise.resolve()
    state.banner = { jutsuId: j.id, key: Date.now() }
    state.casting = true
    return this.hooks.cast(j).finally(() => (state.casting = false))
  }

  /** 随机挑战：3-2-1-START */
  async startChallenge(): Promise<void> {
    if (state.challenge.phase === 'countdown') return
    this.clearSequence()
    state.result = null
    const pool = JUTSU_LIST.filter((j) => j.id !== state.challenge.target)
    state.challenge.target = pool[Math.floor(Math.random() * pool.length)].id
    state.challenge.phase = 'countdown'
    state.challenge.round++
    for (let n = 3; n >= 1; n--) {
      state.challenge.count = n
      this.hooks.onCountdown(n)
      await sleep(800)
      if (state.mode !== 'challenge') return
    }
    state.challenge.count = 0
    this.hooks.onCountdown(0)
    state.challenge.phase = 'active'
    state.challenge.startAt = performance.now()
    this.lastSealAt = state.challenge.startAt
    this.updateCandidates()
  }
}

function grade(accuracy: number, avg: number): string {
  if (accuracy >= 0.95 && avg <= 0.9) return 'S'
  if (accuracy >= 0.85 && avg <= 1.4) return 'A'
  if (accuracy >= 0.7 && avg <= 2.2) return 'B'
  return 'C'
}

const RANK_BONUS: Record<Rank, number> = { D: 1, C: 1.3, B: 1.7, A: 2.2, S: 3 }

function scoreOf(r: CastResult): number {
  const g = { S: 1000, A: 750, B: 500, C: 300 }[r.grade ?? 'C'] ?? 300
  return Math.round(g * RANK_BONUS[r.rank as Rank] * r.accuracy)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
