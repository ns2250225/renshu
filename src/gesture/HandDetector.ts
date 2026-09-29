import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export interface Landmark {
  x: number
  y: number
  z: number
}

export interface HandsResult {
  hands: Landmark[][]
  handedness: string[]
}

const BASE = import.meta.env.BASE_URL

/** MediaPipe Hand Landmarker：输出双手 21 点骨架，用于显示骨架、判断双手离开、个性化识别 */
export class HandDetector {
  private landmarker: HandLandmarker | null = null
  private lastTs = -1

  get loaded(): boolean {
    return !!this.landmarker
  }

  async load(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(`${BASE}wasm/mediapipe`)
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: `${BASE}models/hand_landmarker.task`, delegate },
      runningMode: 'VIDEO' as const,
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options('GPU'))
    } catch (e) {
      console.warn('[hands] GPU 初始化失败，回退 CPU', e)
      this.landmarker = await HandLandmarker.createFromOptions(fileset, options('CPU'))
    }
  }

  detect(video: HTMLVideoElement, now: number): HandsResult {
    if (!this.landmarker) return { hands: [], handedness: [] }
    const ts = Math.max(now, this.lastTs + 1)
    this.lastTs = ts
    const r = this.landmarker.detectForVideo(video, ts)
    return {
      hands: r.landmarks ?? [],
      handedness: (r.handedness ?? []).map((h) => h[0]?.categoryName ?? ''),
    }
  }

  dispose(): void {
    this.landmarker?.close()
    this.landmarker = null
  }
}

export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]

/** 把双手关键点编码为与位置、尺度无关的特征向量（用于个性化 KNN） */
export function handsFeature(hands: Landmark[][]): Float32Array | null {
  if (hands.length === 0) return null
  const sorted = [...hands].sort((a, b) => a[0].x - b[0].x).slice(0, 2)
  // 以所有点的中心为原点、以整体包围尺寸归一化，保留双手的相对位置关系
  const all = sorted.flat()
  let cx = 0, cy = 0
  for (const p of all) { cx += p.x; cy += p.y }
  cx /= all.length
  cy /= all.length
  let scale = 1e-6
  for (const p of all) scale = Math.max(scale, Math.hypot(p.x - cx, p.y - cy))
  const out = new Float32Array(2 * 21 * 2 + 1)
  sorted.forEach((hand, h) => {
    hand.forEach((p, i) => {
      out[(h * 21 + i) * 2] = (p.x - cx) / scale
      out[(h * 21 + i) * 2 + 1] = (p.y - cy) / scale
    })
  })
  out[out.length - 1] = sorted.length === 2 ? 1 : 0
  return out
}
