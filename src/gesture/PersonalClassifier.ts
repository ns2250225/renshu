import { db, type SealSample } from '../store/db'
import type { SealId } from './seals'

/**
 * 参与距离计算的特征维度：跳过拇指（关键点 1~4）。
 * 摄像头视角下拇指多被手掌遮挡，MediaPipe 只能猜测其位置，抖动大，会干扰 KNN。
 * 特征本身仍保存全部关键点，已采集的样本无需重采。
 */
const DIMS: number[] = (() => {
  const out: number[] = []
  for (let h = 0; h < 2; h++)
    for (let i = 0; i < 21; i++) {
      if (i >= 1 && i <= 4) continue
      out.push((h * 21 + i) * 2, (h * 21 + i) * 2 + 1)
    }
  out.push(2 * 21 * 2)
  return out
})()

export interface PersonalPrediction {
  seal: SealId | null
  score: number
}

/** 基于玩家自采样本（IndexedDB）的 KNN 个性化手印识别 */
export class PersonalClassifier {
  private samples: { seal: SealId; f: Float32Array }[] = []
  k = 5
  /** 距离阈值：越小越严格 */
  maxDist = 0.9

  get size(): number {
    return this.samples.length
  }

  async reload(): Promise<void> {
    const rows = await db.samples.toArray()
    this.samples = rows.map((r) => ({ seal: r.seal, f: Float32Array.from(r.feature) }))
  }

  async addSamples(seal: SealId, features: Float32Array[]): Promise<void> {
    const now = Date.now()
    const rows: SealSample[] = features.map((f) => ({ seal, feature: Array.from(f), createdAt: now }))
    await db.samples.bulkAdd(rows)
    await this.reload()
  }

  async clear(seal?: SealId): Promise<void> {
    if (seal) await db.samples.where('seal').equals(seal).delete()
    else await db.samples.clear()
    await this.reload()
  }

  async counts(): Promise<Partial<Record<SealId, number>>> {
    const out: Partial<Record<SealId, number>> = {}
    for (const s of this.samples) out[s.seal] = (out[s.seal] ?? 0) + 1
    return out
  }

  predict(f: Float32Array | null): PersonalPrediction {
    if (!f || this.samples.length < this.k) return { seal: null, score: 0 }
    const dists: { seal: SealId; d: number }[] = []
    for (const s of this.samples) {
      let sum = 0
      for (const i of DIMS) {
        const diff = f[i] - s.f[i]
        sum += diff * diff
      }
      dists.push({ seal: s.seal, d: Math.sqrt(sum / DIMS.length) * 4 })
    }
    dists.sort((a, b) => a.d - b.d)
    const top = dists.slice(0, this.k)
    const votes = new Map<SealId, number>()
    for (const t of top) votes.set(t.seal, (votes.get(t.seal) ?? 0) + 1)
    let seal: SealId | null = null
    let best = 0
    for (const [k, v] of votes) if (v > best) { best = v; seal = k }
    const meanDist = top.filter((t) => t.seal === seal).reduce((a, t) => a + t.d, 0) / best
    if (meanDist > this.maxDist) return { seal: null, score: 0 }
    return { seal, score: (best / this.k) * (1 - meanDist / this.maxDist / 2) }
  }
}
