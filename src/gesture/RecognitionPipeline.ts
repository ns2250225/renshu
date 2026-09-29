import { CameraManager, type CameraStatus } from './CameraManager'
import { HandClassifier, type SealPrediction } from './HandClassifier'
import { HandDetector, handsFeature, type HandsResult } from './HandDetector'
import { GestureStabilizer, type StabilizerState } from './GestureStabilizer'
import { PersonalClassifier } from './PersonalClassifier'
import { SealStateMachine, type SealPhase } from './SealStateMachine'
import type { SealId } from './seals'

export interface RecognitionSettings {
  scoreTh: number
  windowSize: number
  ratio: number
  holdMs: number
  targetFps: number
  usePersonal: boolean
  preferPersonal: boolean
  /** 宽松辅助：当前期望的手印只需达到较低得分即可确认 */
  hintAssist: boolean
}

/** 期望手印的得分只需达到识别阈值的这一比例 */
const HINT_FACTOR = 0.45

export interface FrameResult {
  now: number
  hands: HandsResult
  yolo: SealPrediction
  personal: { seal: SealId | null; score: number }
  /** 融合后的本帧结果 */
  seal: SealId | null
  score: number
  source: 'model' | 'personal' | 'none'
  stab: StabilizerState
  phase: SealPhase
  fps: number
  inferMs: number
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'failed'

export interface PipelineStatus {
  camera: CameraStatus
  classifier: LoadStatus
  hands: LoadStatus
  backend: string
  error: string
}

export class RecognitionPipeline {
  readonly camera = new CameraManager()
  readonly detector = new HandDetector()
  readonly classifier = new HandClassifier()
  readonly personal = new PersonalClassifier()
  readonly stabilizer: GestureStabilizer
  readonly machine: SealStateMachine
  settings: RecognitionSettings
  status: PipelineStatus = { camera: 'idle', classifier: 'idle', hands: 'idle', backend: '', error: '' }

  onSeal: (seal: SealId) => void = () => {}
  onFrame: (r: FrameResult) => void = () => {}
  onStatus: (s: PipelineStatus) => void = () => {}
  /** 当前「期望」的下一个手印（练习 / 挑战的下一印、自由模式可接续的印） */
  hints: () => SealId[] = () => []

  private running = false
  private timer = 0
  private fpsTimes: number[] = []
  private capture: { seal: SealId; target: number; buf: Float32Array[]; resolve: (n: number) => void } | null = null
  /** 暂停向状态机输入（例如采样训练时） */
  suspendInput = false

  constructor(settings: RecognitionSettings) {
    this.settings = { ...settings }
    this.stabilizer = new GestureStabilizer({
      windowSize: settings.windowSize,
      ratio: settings.ratio,
      holdMs: settings.holdMs,
    })
    this.machine = new SealStateMachine((s) => {
      if (!this.suspendInput) this.onSeal(s)
    })
  }

  applySettings(s: Partial<RecognitionSettings>): void {
    Object.assign(this.settings, s)
    this.stabilizer.opts = {
      windowSize: this.settings.windowSize,
      ratio: this.settings.ratio,
      holdMs: this.settings.holdMs,
    }
  }

  private setStatus(patch: Partial<PipelineStatus>): void {
    Object.assign(this.status, patch)
    this.onStatus({ ...this.status })
  }

  /** 加载模型并启动摄像头；任何一步失败都不抛出，交由界面降级为键盘模式 */
  async start(): Promise<void> {
    this.setStatus({ camera: 'requesting', classifier: 'loading', hands: 'loading', error: '' })
    const camP = this.camera.start().then((c) => this.setStatus({ camera: c }))
    const clsP = this.classifier
      .load()
      .then(() => this.setStatus({ classifier: 'ready', backend: this.classifier.backend }))
      .catch((e) => {
        console.error('[classifier]', e)
        this.setStatus({ classifier: 'failed', error: `手印模型加载失败：${e?.message ?? e}` })
      })
    const handP = this.detector
      .load()
      .then(() => this.setStatus({ hands: 'ready' }))
      .catch((e) => {
        console.error('[hands]', e)
        this.setStatus({ hands: 'failed' })
      })
    const perP = this.personal.reload().catch(() => {})
    await Promise.all([camP, clsP, handP, perP])
    if (this.status.camera === 'ready' && (this.classifier.loaded || this.detector.loaded)) {
      this.running = true
      this.loop()
    }
  }

  async restartCamera(deviceId?: string): Promise<void> {
    this.setStatus({ camera: 'requesting' })
    const c = await this.camera.start(deviceId)
    this.setStatus({ camera: c })
    if (c === 'ready' && !this.running && (this.classifier.loaded || this.detector.loaded)) {
      this.running = true
      this.loop()
    }
  }

  stop(): void {
    this.running = false
    clearTimeout(this.timer)
    this.camera.stop()
  }

  /** 采集当前手势的关键点特征，用于个性化训练 */
  captureSamples(seal: SealId, target: number): Promise<number> {
    return new Promise((resolve) => {
      this.capture = { seal, target, buf: [], resolve }
    })
  }

  cancelCapture(): void {
    if (this.capture) {
      this.capture.resolve(0)
      this.capture = null
    }
  }

  get captureProgress(): number {
    return this.capture ? this.capture.buf.length / this.capture.target : 0
  }

  private async loop(): Promise<void> {
    if (!this.running) return
    const start = performance.now()
    try {
      if (this.camera.ready) await this.step(start)
    } catch (e) {
      console.error('[pipeline]', e)
    }
    const interval = 1000 / this.settings.targetFps
    const spent = performance.now() - start
    this.timer = window.setTimeout(() => this.loop(), Math.max(0, interval - spent))
  }

  private async step(now: number): Promise<void> {
    const video = this.camera.video
    const t0 = performance.now()
    const hands = this.detector.loaded ? this.detector.detect(video, now) : { hands: [], handedness: [] }
    const yolo = this.classifier.loaded
      ? await this.classifier.predict(video, this.settings.scoreTh)
      : { seal: null, score: 0, bbox: null, scores: {} }
    const inferMs = performance.now() - t0

    const feature = hands.hands.length ? handsFeature(hands.hands) : null
    if (this.capture && feature) {
      this.capture.buf.push(feature)
      if (this.capture.buf.length >= this.capture.target) {
        const c = this.capture
        this.capture = null
        this.personal.addSamples(c.seal, c.buf).then(() => c.resolve(c.buf.length))
      }
    }

    const personal = this.settings.usePersonal && this.personal.size
      ? this.personal.predict(feature)
      : { seal: null, score: 0 }

    let seal: SealId | null = yolo.seal
    let score = yolo.score
    let source: FrameResult['source'] = yolo.seal ? 'model' : 'none'
    const hints = this.settings.hintAssist ? this.hints() : []
    if (personal.seal && personal.score >= (hints.includes(personal.seal) ? 0.4 : 0.6) && (this.settings.preferPersonal || !yolo.seal)) {
      seal = personal.seal
      score = personal.score
      source = 'personal'
    }
    // 摆得「差不多」即可：期望的手印得分达到较低门槛，且不明显弱于最高分时，按期望手印处理
    if (hints.length && !(seal && hints.includes(seal))) {
      let hs = 0
      let hseal: SealId | null = null
      for (const h of hints) {
        const v = yolo.scores[h] ?? 0
        if (v > hs) { hs = v; hseal = h }
      }
      // 模型已确信是别的印（如仍保持着上一印）时，期望印需接近其得分才可替换，避免误触
      const floor = seal ? Math.max(score * 0.7, this.settings.scoreTh * HINT_FACTOR) : this.settings.scoreTh * HINT_FACTOR
      if (hseal && hs >= floor) {
        seal = hseal
        score = hs
        source = 'model'
      }
    }

    const handsPresent = this.detector.loaded ? hands.hands.length > 0 || !!yolo.seal : !!yolo.seal
    const stab = this.stabilizer.push(seal, now)
    const phase = this.machine.update(stab, handsPresent, now)

    this.fpsTimes.push(now)
    while (this.fpsTimes.length && now - this.fpsTimes[0] > 1000) this.fpsTimes.shift()

    this.onFrame({
      now, hands, yolo, personal, seal, score, source, stab, phase,
      fps: this.fpsTimes.length, inferMs,
    })
  }
}
