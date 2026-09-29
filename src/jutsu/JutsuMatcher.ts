import type { SealId } from '../gesture/seals'
import type { JutsuDef } from './types'

export interface Candidate {
  jutsu: JutsuDef
  matched: number
  progress: number
}

/** 前缀匹配：每完成一个印立即搜索可能的忍术 */
export class JutsuMatcher {
  private list: JutsuDef[]

  constructor(list: JutsuDef[]) {
    this.list = list
  }

  candidates(seq: SealId[]): Candidate[] {
    if (seq.length === 0) return []
    const out: Candidate[] = []
    for (const j of this.list) {
      if (j.seals.length < seq.length) continue
      let ok = true
      for (let i = 0; i < seq.length; i++) {
        if (j.seals[i] !== seq[i]) { ok = false; break }
      }
      if (ok) out.push({ jutsu: j, matched: seq.length, progress: seq.length / j.seals.length })
    }
    return out.sort((a, b) => b.progress - a.progress || a.jutsu.seals.length - b.jutsu.seals.length)
  }

  exact(seq: SealId[]): JutsuDef | undefined {
    return this.candidates(seq).find((c) => c.jutsu.seals.length === seq.length)?.jutsu
  }

  /** 当前序列无匹配时，找出能继续匹配的最长后缀（错印后自动从新起点开始） */
  recover(seq: SealId[]): SealId[] {
    for (let start = 1; start < seq.length; start++) {
      const tail = seq.slice(start)
      if (this.candidates(tail).length) return tail
    }
    return []
  }
}
