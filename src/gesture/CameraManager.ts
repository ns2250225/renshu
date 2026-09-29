export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported' | 'error'

export class CameraManager {
  readonly video: HTMLVideoElement
  private stream: MediaStream | null = null

  constructor() {
    this.video = document.createElement('video')
    this.video.muted = true
    this.video.playsInline = true
    this.video.autoplay = true
  }

  get ready(): boolean {
    return !!this.stream && this.video.readyState >= 2 && this.video.videoWidth > 0
  }

  async start(deviceId?: string): Promise<CameraStatus> {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'
    this.stop()
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 960 },
          height: { ideal: 540 },
          frameRate: { ideal: 30 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
        },
      })
      this.video.srcObject = this.stream
      await this.video.play()
      await new Promise<void>((resolve) => {
        if (this.video.videoWidth > 0) return resolve()
        this.video.onloadeddata = () => resolve()
      })
      return 'ready'
    } catch (e) {
      const name = (e as DOMException)?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
      console.error('[camera]', e)
      return 'error'
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video.srcObject = null
  }

  static async listDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return []
    const all = await navigator.mediaDevices.enumerateDevices()
    return all.filter((d) => d.kind === 'videoinput')
  }
}
