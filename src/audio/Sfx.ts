/** 纯 WebAudio 合成音效，无需外部音频资源 */
export type SfxName =
  | 'seal' | 'miss' | 'cast' | 'fire' | 'explode' | 'bigExplode' | 'water' | 'splash'
  | 'thunder' | 'zap' | 'chirp' | 'wind' | 'rumble' | 'rock' | 'poof' | 'hit' | 'whoosh'
  | 'countdown' | 'start' | 'record' | 'wood' | 'dark' | 'steam'

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  volume = 0.7

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
        this.master = this.ctx.createGain()
        this.master.connect(this.ctx.destination)
        const len = this.ctx.sampleRate * 2
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
        const d = this.noiseBuf.getChannelData(0)
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      } catch {
        return null
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.master!.gain.value = this.volume
    return this.ctx
  }

  unlock(): void {
    this.ensure()
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime + delay
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private noise(
    dur: number,
    vol: number,
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    delay = 0,
    q = 1,
  ): void {
    const ctx = this.ensure()
    if (!ctx || !this.noiseBuf) return
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const bf = ctx.createBiquadFilter()
    bf.type = filter
    bf.Q.value = q
    bf.frequency.setValueAtTime(f0, t)
    bf.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 4))
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(bf).connect(g).connect(this.master!)
    src.start(t, Math.random())
    src.stop(t + dur + 0.05)
  }

  play(name: SfxName, param = 0): void {
    switch (name) {
      case 'seal': {
        const f = 440 * Math.pow(2, Math.min(param, 12) / 12)
        this.tone('square', f, f * 1.5, 0.12, 0.12)
        this.tone('sine', f * 2, f * 2, 0.2, 0.08, 0.03)
        break
      }
      case 'miss':
        this.tone('square', 220, 110, 0.18, 0.1)
        break
      case 'cast':
        this.tone('sawtooth', 200, 900, 0.35, 0.08)
        this.noise(0.4, 0.15, 'bandpass', 400, 3000, 0, 2)
        break
      case 'fire':
        this.noise(0.6, 0.35, 'lowpass', 2500, 400)
        break
      case 'explode':
        this.noise(0.7, 0.6, 'lowpass', 1800, 80)
        this.tone('sine', 120, 40, 0.5, 0.4)
        break
      case 'bigExplode':
        this.noise(1.6, 0.8, 'lowpass', 2400, 50)
        this.tone('sine', 90, 25, 1.4, 0.6)
        break
      case 'water':
        this.noise(0.8, 0.3, 'bandpass', 600, 1800, 0, 1.5)
        break
      case 'splash':
        this.noise(0.5, 0.45, 'highpass', 3000, 600)
        this.tone('sine', 500, 150, 0.2, 0.15)
        break
      case 'thunder':
        this.noise(0.08, 0.7, 'highpass', 4000, 2000)
        this.noise(1.4, 0.6, 'lowpass', 1200, 60, 0.05)
        break
      case 'zap':
        for (let i = 0; i < 4; i++) this.tone('square', 1400 + Math.random() * 1200, 300, 0.05, 0.08, i * 0.04)
        break
      case 'chirp':
        for (let i = 0; i < 10; i++) this.noise(0.08, 0.25, 'bandpass', 5000, 7000, i * 0.07, 6)
        this.tone('sawtooth', 1800, 2400, 0.8, 0.05)
        break
      case 'wind':
        this.noise(1.2, 0.35, 'bandpass', 300, 1500, 0, 0.8)
        break
      case 'whoosh':
        this.noise(0.25, 0.3, 'bandpass', 800, 3000, 0, 1.2)
        break
      case 'rumble':
        this.noise(1.2, 0.5, 'lowpass', 300, 60)
        break
      case 'rock':
        this.noise(0.25, 0.5, 'lowpass', 1500, 200)
        this.tone('triangle', 160, 60, 0.2, 0.3)
        break
      case 'poof':
        this.noise(0.35, 0.4, 'lowpass', 3000, 300)
        break
      case 'hit':
        this.noise(0.12, 0.45, 'lowpass', 3000, 400)
        this.tone('square', 180, 80, 0.08, 0.15)
        break
      case 'countdown':
        this.tone('square', 660, 660, 0.12, 0.12)
        break
      case 'start':
        this.tone('square', 880, 1320, 0.3, 0.14)
        break
      case 'record':
        ;[523, 659, 784, 1046].forEach((f, i) => this.tone('square', f, f, 0.14, 0.1, i * 0.09))
        break
      case 'wood':
        this.noise(0.9, 0.4, 'lowpass', 600, 120)
        for (let i = 0; i < 5; i++) this.tone('triangle', 200 - i * 20, 90, 0.12, 0.2, i * 0.12)
        break
      case 'dark':
        this.tone('sawtooth', 110, 55, 1.4, 0.12)
        this.tone('sine', 55, 40, 1.6, 0.25)
        break
      case 'steam':
        this.noise(1.0, 0.35, 'highpass', 2000, 5000)
        break
    }
  }
}

export const sfx = new Sfx()
