import * as ort from 'onnxruntime-web/wasm'
// wasm 二进制交给 Vite 管理（开发时由 dev server 提供，构建时输出到 assets），JS 胶水代码已内置在 bundle 中
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { MODEL_CLASS_COUNT, SEAL_BY_CLASS, type SealId } from './seals'

export interface SealPrediction {
  seal: SealId | null
  score: number
  /** 视频像素坐标 [x1, y1, x2, y2] */
  bbox: [number, number, number, number] | null
  /** 每个手印在所有检测框中的最高得分，用于「期望手印」的宽松判定 */
  scores: Partial<Record<SealId, number>>
}

const BASE = import.meta.env.BASE_URL
const INPUT = 416
const STRIDES = [8, 16, 32]

/**
 * NARUTO-HandSignDetection 的 YOLOX-nano 手印检测模型（onnxruntime-web / WASM）。
 * 前处理与原项目一致：BGR、0~255、左上角对齐 letterbox、填充 114。
 */
export class HandClassifier {
  private session: ort.InferenceSession | null = null
  private canvas: OffscreenCanvas | HTMLCanvasElement
  private ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
  private input = new Float32Array(3 * INPUT * INPUT)
  private grids: Float32Array
  busy = false
  backend = ''

  constructor() {
    this.canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(INPUT, INPUT)
      : Object.assign(document.createElement('canvas'), { width: INPUT, height: INPUT })
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
    this.grids = buildGrids()
  }

  get loaded(): boolean {
    return !!this.session
  }

  async load(): Promise<void> {
    ort.env.wasm.wasmPaths = { wasm: ortWasmUrl }
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1
    this.session = await ort.InferenceSession.create(`${BASE}models/yolox_nano.onnx`, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    })
    this.backend = `wasm×${ort.env.wasm.numThreads}`
  }

  async predict(source: HTMLVideoElement, scoreTh: number): Promise<SealPrediction> {
    if (!this.session || this.busy) return { seal: null, score: 0, bbox: null, scores: {} }
    this.busy = true
    try {
      const vw = source.videoWidth, vh = source.videoHeight
      const ratio = Math.min(INPUT / vw, INPUT / vh)
      const w = Math.floor(vw * ratio), h = Math.floor(vh * ratio)
      const ctx = this.ctx
      ctx.fillStyle = 'rgb(114,114,114)'
      ctx.fillRect(0, 0, INPUT, INPUT)
      ctx.drawImage(source, 0, 0, w, h)
      const px = ctx.getImageData(0, 0, INPUT, INPUT).data
      const plane = INPUT * INPUT
      const inp = this.input
      for (let i = 0, j = 0; i < plane; i++, j += 4) {
        inp[i] = px[j + 2] // B
        inp[i + plane] = px[j + 1] // G
        inp[i + 2 * plane] = px[j] // R
      }
      const feeds = { images: new ort.Tensor('float32', inp, [1, 3, INPUT, INPUT]) }
      const out = await this.session.run(feeds)
      const data = out.output.data as Float32Array
      return this.decode(data, ratio, vw, vh, scoreTh)
    } finally {
      this.busy = false
    }
  }

  /** 解码 YOLOX 输出，只取得分最高的检测框（结印只需要一个结果） */
  private decode(d: Float32Array, ratio: number, vw: number, vh: number, scoreTh: number): SealPrediction {
    const stride = 5 + MODEL_CLASS_COUNT
    const n = d.length / stride
    let best = -1, bestScore = 0, bestCls = -1
    const scores: Partial<Record<SealId, number>> = {}
    for (let i = 0; i < n; i++) {
      const o = i * stride
      const obj = d[o + 4]
      if (obj < 0.1) continue
      let cls = 0, cs = d[o + 5]
      for (let c = 0; c < MODEL_CLASS_COUNT; c++) {
        const v = d[o + 5 + c]
        if (v > cs) { cs = v; cls = c }
        const id = SEAL_BY_CLASS[c]?.id
        if (id && obj * v > (scores[id] ?? 0)) scores[id] = obj * v
      }
      const s = obj * cs
      if (s > bestScore) { bestScore = s; best = i; bestCls = cls }
    }
    if (best < 0 || bestScore < scoreTh) return { seal: null, score: bestScore, bbox: null, scores }
    const o = best * stride
    const gx = this.grids[best * 3], gy = this.grids[best * 3 + 1], st = this.grids[best * 3 + 2]
    const cx = (d[o] + gx) * st, cy = (d[o + 1] + gy) * st
    const bw = Math.exp(d[o + 2]) * st, bh = Math.exp(d[o + 3]) * st
    const bbox: [number, number, number, number] = [
      Math.max(0, (cx - bw / 2) / ratio),
      Math.max(0, (cy - bh / 2) / ratio),
      Math.min(vw, (cx + bw / 2) / ratio),
      Math.min(vh, (cy + bh / 2) / ratio),
    ]
    const seal = SEAL_BY_CLASS[bestCls]?.id ?? null
    return { seal, score: bestScore, bbox, scores }
  }
}

function buildGrids(): Float32Array {
  const cells: number[] = []
  for (const s of STRIDES) {
    const n = INPUT / s
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells.push(x, y, s)
  }
  return new Float32Array(cells)
}
