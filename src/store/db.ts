import Dexie, { type Table } from 'dexie'
import type { SealId } from '../gesture/seals'

export interface SealSample {
  id?: number
  seal: SealId
  feature: number[]
  createdAt: number
}

export interface JutsuRecord {
  jutsuId: string
  bestTime: number
  casts: number
  lastTime: number
}

class NinjaDB extends Dexie {
  samples!: Table<SealSample, number>
  records!: Table<JutsuRecord, string>

  constructor() {
    super('ninja-seal')
    this.version(1).stores({
      samples: '++id, seal',
      records: 'jutsuId',
    })
  }
}

export const db = new NinjaDB()

/** localStorage 仅用于个人偏好，读写都容错 */
export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`ninja-seal:${key}`)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function savePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(`ninja-seal:${key}`, JSON.stringify(value))
  } catch {
    /* 隐私模式下忽略 */
  }
}
