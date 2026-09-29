export type SealId =
  | 'rat' | 'ox' | 'tiger' | 'hare' | 'dragon' | 'snake'
  | 'horse' | 'ram' | 'monkey' | 'bird' | 'dog' | 'boar'

export interface SealDef {
  id: SealId
  zh: string
  animal: string
  en: string
  key: string
  /** yolox_nano.onnx 输出的类别下标 */
  classIndex: number
}

// 类别下标来自 NARUTO-HandSignDetection 的 setting/labels.csv（class_id + 1 对应 labels 行号）
export const SEALS: SealDef[] = [
  { id: 'rat', zh: '子', animal: '鼠', en: 'Rat', key: '1', classIndex: 0 },
  { id: 'ox', zh: '丑', animal: '牛', en: 'Ox', key: '2', classIndex: 1 },
  { id: 'tiger', zh: '寅', animal: '虎', en: 'Tiger', key: '3', classIndex: 2 },
  { id: 'hare', zh: '卯', animal: '兔', en: 'Hare', key: '4', classIndex: 3 },
  { id: 'dragon', zh: '辰', animal: '龙', en: 'Dragon', key: '5', classIndex: 4 },
  { id: 'snake', zh: '巳', animal: '蛇', en: 'Snake', key: '6', classIndex: 5 },
  { id: 'horse', zh: '午', animal: '马', en: 'Horse', key: '7', classIndex: 6 },
  { id: 'ram', zh: '未', animal: '羊', en: 'Ram', key: '8', classIndex: 7 },
  { id: 'monkey', zh: '申', animal: '猴', en: 'Monkey', key: '9', classIndex: 8 },
  { id: 'bird', zh: '酉', animal: '鸡', en: 'Bird', key: '0', classIndex: 9 },
  { id: 'dog', zh: '戌', animal: '狗', en: 'Dog', key: 'q', classIndex: 10 },
  { id: 'boar', zh: '亥', animal: '猪', en: 'Boar', key: 'w', classIndex: 11 },
]

/** 模型类别总数（额外的 祈 / 謎 / 壬 等类别不参与 V1 结印） */
export const MODEL_CLASS_COUNT = 16

export const SEAL_MAP = Object.fromEntries(SEALS.map((s) => [s.id, s])) as Record<SealId, SealDef>

export const SEAL_BY_CLASS: (SealDef | undefined)[] = []
for (const s of SEALS) SEAL_BY_CLASS[s.classIndex] = s

export const SEAL_BY_KEY: Record<string, SealDef> = Object.fromEntries(SEALS.map((s) => [s.key, s]))

export function sealZh(id: SealId): string {
  return SEAL_MAP[id].zh
}
