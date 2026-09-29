import { reactive } from 'vue'
import type { SealId } from '../gesture/seals'
import type { PipelineStatus, RecognitionSettings } from '../gesture/RecognitionPipeline'
import type { SealPhase } from '../gesture/SealStateMachine'
import type { Element, Rank } from '../jutsu/types'
import type { JutsuRecord } from './db'
import { loadPref, savePref } from './db'

export type Mode = 'free' | 'practice' | 'challenge' | 'continuous'
export type Rating = 'GOOD' | 'GREAT' | 'PERFECT'

export interface SealEntry {
  seal: SealId
  t: number
  rating: Rating
  ok: boolean
}

export interface CandidateView {
  id: string
  short: string
  element: Element
  matched: number
  total: number
  progress: number
}

export interface CastResult {
  jutsuId: string
  sealsDone: number
  sealsTotal: number
  errors: number
  accuracy: number
  time: number
  avg: number
  best: number | null
  newRecord: boolean
  rank: Rank | 'S' | null
  grade: string | null
}

export interface Settings extends RecognitionSettings {
  showSkeleton: boolean
  showBox: boolean
  volume: number
  seqTimeoutMs: number
  mirror: boolean
  ver?: number
}

export const DEFAULT_SETTINGS: Settings = {
  scoreTh: 0.4,
  windowSize: 8,
  ratio: 0.6,
  holdMs: 150,
  targetFps: 24,
  usePersonal: true,
  preferPersonal: false,
  hintAssist: true,
  showSkeleton: true,
  showBox: true,
  volume: 0.7,
  seqTimeoutMs: 4500,
  mirror: true,
}

/** 识别参数预设 */
export const RECOG_PRESETS = {
  loose: { name: '宽松', scoreTh: 0.3, windowSize: 6, ratio: 0.5, holdMs: 100, hintAssist: true },
  normal: { name: '标准', scoreTh: 0.4, windowSize: 8, ratio: 0.6, holdMs: 150, hintAssist: true },
  strict: { name: '严格', scoreTh: 0.55, windowSize: 10, ratio: 0.7, holdMs: 250, hintAssist: false },
} as const
export type RecogPreset = keyof typeof RECOG_PRESETS

export function applyPreset(id: RecogPreset): void {
  const { name: _name, ...p } = RECOG_PRESETS[id]
  Object.assign(state.settings, p)
}

/** 设置版本：识别默认值调整后，旧的严格参数迁移为新默认值 */
const SETTINGS_VER = 2
function loadSettings(): Settings {
  const s = loadPref('settings', DEFAULT_SETTINGS) as Settings
  if ((s.ver ?? 1) < SETTINGS_VER) {
    const { name: _name, ...p } = RECOG_PRESETS.normal
    Object.assign(s, p)
  }
  s.ver = SETTINGS_VER
  return s
}

const savedProfile = loadPref('profile', { xp: 0, casts: 0 })

export const state = reactive({
  mode: 'free' as Mode,
  practiceId: 'fireball',
  seq: [] as SealEntry[],
  candidates: [] as CandidateView[],
  combo: 0,
  maxCombo: 0,
  fastSeal: 0,
  errors: 0,
  lastRating: null as { text: string; key: number } | null,
  pendingCast: null as string | null,
  castSeq: null as { seals: SealId[]; jutsuId: string; key: number } | null,
  recog: {
    seal: null as SealId | null,
    score: 0,
    phase: 'WAITING' as SealPhase,
    progress: 0,
    fps: 0,
    inferMs: 0,
    source: 'none' as 'model' | 'personal' | 'none',
    flash: null as 'ok' | 'fail' | null,
    flashKey: 0,
    hands: 0,
  },
  status: { camera: 'idle', classifier: 'idle', hands: 'idle', backend: '', error: '' } as PipelineStatus,
  keyboardMode: false,
  started: false,
  banner: null as { jutsuId: string; key: number } | null,
  result: null as CastResult | null,
  challenge: {
    phase: 'idle' as 'idle' | 'countdown' | 'active' | 'done',
    target: '' as string,
    count: 3,
    startAt: 0,
    round: 0,
    score: 0,
  },
  chain: [] as Element[],
  reaction: null as { text: string; color: string; key: number } | null,
  profile: savedProfile as { xp: number; casts: number },
  records: {} as Record<string, JutsuRecord>,
  settings: loadSettings(),
  ui: { book: false, settings: false, training: false },
  casting: false,
})

export function persistProfile(): void {
  savePref('profile', state.profile)
}

export function persistSettings(): void {
  savePref('settings', state.settings)
}

export function levelOf(xp: number): number {
  return Math.floor(Math.sqrt(xp / 40)) + 1
}

export function titleOf(level: number): string {
  if (level >= 40) return '影级'
  if (level >= 25) return '上忍'
  if (level >= 12) return '中忍'
  if (level >= 5) return '下忍'
  return '忍者学员'
}
