import type { SealId } from '../gesture/seals'
import raw from './jutsu.json'

export type Element =
  | 'fire' | 'water' | 'lightning' | 'wind' | 'earth'
  | 'wood' | 'clone' | 'taijutsu' | 'spacetime' | 'special'

export type Rank = 'D' | 'C' | 'B' | 'A' | 'S'

export interface JutsuDef {
  id: string
  name: string
  short: string
  element: Element
  rank: Rank
  seals: SealId[]
  animation: string
  damage: number
  chakra: number
  effects: string[]
  desc: string
}

export const JUTSU_LIST = raw as JutsuDef[]
export const JUTSU_MAP: Record<string, JutsuDef> = Object.fromEntries(JUTSU_LIST.map((j) => [j.id, j]))

export const ELEMENTS: { id: Element; name: string; icon: string; color: string }[] = [
  { id: 'fire', name: '火遁', icon: '🔥', color: '#ff7a1a' },
  { id: 'water', name: '水遁', icon: '💧', color: '#3aa0ff' },
  { id: 'lightning', name: '雷遁', icon: '⚡', color: '#9fe8ff' },
  { id: 'wind', name: '风遁', icon: '🌪', color: '#b7f0c0' },
  { id: 'earth', name: '土遁', icon: '🪨', color: '#c8964f' },
  { id: 'wood', name: '木遁', icon: '🌿', color: '#5fcf5a' },
  { id: 'clone', name: '分身', icon: '👤', color: '#e6e6e6' },
  { id: 'taijutsu', name: '体术', icon: '💥', color: '#ff5d73' },
  { id: 'spacetime', name: '时空间', icon: '🌀', color: '#c78bff' },
  { id: 'special', name: '特殊', icon: '🌑', color: '#8a7bff' },
]

export const ELEMENT_MAP = Object.fromEntries(ELEMENTS.map((e) => [e.id, e])) as Record<
  Element,
  (typeof ELEMENTS)[number]
>
