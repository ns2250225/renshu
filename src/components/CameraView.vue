<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { FrameResult } from '../gesture/RecognitionPipeline'
import { HAND_CONNECTIONS } from '../gesture/HandDetector'
import { SEAL_MAP } from '../gesture/seals'
import { state } from '../store/game'

const props = defineProps<{ video: HTMLVideoElement }>()

const host = ref<HTMLDivElement>()
const overlay = ref<HTMLCanvasElement>()
const flashCls = ref('')
let flashTimer = 0

const VW = 240
const VH = 180

onMounted(() => {
  const v = props.video
  v.classList.add('cam-video')
  host.value!.prepend(v)
})

watch(
  () => state.recog.flashKey,
  () => {
    flashCls.value = ''
    requestAnimationFrame(() => {
      flashCls.value = state.recog.flash === 'fail' ? 'flash-fail' : 'flash-ok'
    })
    clearTimeout(flashTimer)
    flashTimer = window.setTimeout(() => (flashCls.value = ''), 450)
  },
)

/** 视频以 cover 方式铺满 240×180，返回视频像素 → 画布坐标映射 */
function mapper(): { sx: number; ox: number; oy: number } {
  const v = props.video
  const vw = v.videoWidth || 640
  const vh = v.videoHeight || 480
  const s = Math.max(VW / vw, VH / vh)
  return { sx: s, ox: (VW - vw * s) / 2, oy: (VH - vh * s) / 2 }
}

function draw(f: FrameResult): void {
  const c = overlay.value
  if (!c) return
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, VW, VH)
  const { sx, ox, oy } = mapper()
  const v = props.video
  const vw = v.videoWidth || 640
  const vh = v.videoHeight || 480
  const mirror = state.settings.mirror
  const X = (x: number) => {
    const px = ox + x * sx
    return mirror ? VW - px : px
  }
  const Y = (y: number) => oy + y * sx

  if (state.settings.showSkeleton) {
    for (const hand of f.hands.hands) {
      ctx.strokeStyle = 'rgba(111,208,255,0.9)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(X(hand[a].x * vw), Y(hand[a].y * vh))
        ctx.lineTo(X(hand[b].x * vw), Y(hand[b].y * vh))
      }
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      for (const p of hand) ctx.fillRect(Math.round(X(p.x * vw)) - 1, Math.round(Y(p.y * vh)) - 1, 2, 2)
    }
  }
  if (state.settings.showBox && f.yolo.bbox) {
    const [x1, y1, x2, y2] = f.yolo.bbox
    const l = Math.min(X(x1), X(x2))
    const r = Math.max(X(x1), X(x2))
    ctx.strokeStyle = f.stab.stable ? '#ffe066' : '#6fd0ff'
    ctx.lineWidth = 2
    ctx.strokeRect(l, Y(y1), r - l, Y(y2) - Y(y1))
    if (f.yolo.seal) {
      const label = `${SEAL_MAP[f.yolo.seal].zh} ${(f.yolo.score * 100).toFixed(0)}%`
      ctx.font = 'bold 11px sans-serif'
      const w = ctx.measureText(label).width + 6
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillRect(l, Y(y1) - 14, w, 14)
      ctx.fillStyle = '#fff'
      ctx.fillText(label, l + 3, Y(y1) - 3)
    }
  }
}

defineExpose({ draw })

const phaseColor: Record<string, string> = {
  WAITING: '#8890b0',
  DETECTING: '#6fd0ff',
  CONFIRMED: '#7fe07a',
  LOCKED: '#ffe066',
  RELEASE: '#ff9a1f',
}
</script>

<template>
  <div class="cam-wrap" :class="flashCls">
    <div ref="host" class="cam-host" :class="{ mirror: state.settings.mirror }">
      <canvas ref="overlay" class="cam-overlay" :width="VW" :height="VH" />
      <div v-if="state.status.camera !== 'ready'" class="cam-empty">
        <template v-if="state.status.camera === 'requesting'">正在打开摄像头…</template>
        <template v-else-if="state.status.camera === 'denied'">摄像头权限被拒绝<br />已切换键盘模式</template>
        <template v-else-if="state.status.camera === 'unsupported'">浏览器不支持摄像头<br />已切换键盘模式</template>
        <template v-else-if="state.status.camera === 'error'">未找到摄像头<br />已切换键盘模式</template>
        <template v-else>摄像头未启动</template>
      </div>
    </div>
    <div class="cam-info">
      <div class="cam-row">
        <span class="seal-now">{{ state.recog.seal ? SEAL_MAP[state.recog.seal].zh : '—' }}</span>
        <span class="phase" :style="{ color: phaseColor[state.recog.phase] }">{{ state.recog.phase }}</span>
        <span class="fps">{{ state.recog.fps }}fps · {{ state.recog.inferMs.toFixed(0) }}ms</span>
      </div>
      <div class="bar"><div class="bar-fill conf" :style="{ width: state.recog.score * 100 + '%' }" /></div>
      <div class="bar"><div class="bar-fill hold" :style="{ width: state.recog.progress * 100 + '%' }" /></div>
      <div class="cam-row small">
        <span>置信度 {{ (state.recog.score * 100).toFixed(0) }}%</span>
        <span>{{ state.recog.source === 'personal' ? '个人模型' : state.recog.source === 'model' ? '手印模型' : '' }}</span>
        <span>手 ×{{ state.recog.hands }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cam-wrap {
  width: 240px;
  background: var(--panel);
  border: 3px solid var(--line);
  box-shadow: 0 0 0 2px #000, 4px 4px 0 #000;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.cam-wrap.flash-ok {
  border-color: #4fc3ff;
  box-shadow: 0 0 0 2px #000, 0 0 18px #4fc3ff;
}
.cam-wrap.flash-fail {
  border-color: #ff4d4d;
  box-shadow: 0 0 0 2px #000, 0 0 18px #ff4d4d;
  animation: shake 0.3s;
}
.cam-host {
  position: relative;
  width: 240px;
  height: 180px;
  overflow: hidden;
  background: #05060f;
}
.cam-host :deep(.cam-video) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cam-host.mirror :deep(.cam-video) {
  transform: scaleX(-1);
}
.cam-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.cam-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}
.cam-info {
  padding: 4px 6px 5px;
  font-size: 11px;
}
.cam-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.cam-row.small {
  color: var(--muted);
  font-size: 10px;
  margin-top: 2px;
}
.seal-now {
  font-size: 18px;
  font-weight: 900;
  color: #fff;
  min-width: 22px;
}
.phase {
  font-family: var(--mono);
  font-weight: 700;
  font-size: 10px;
}
.fps {
  font-family: var(--mono);
  color: var(--muted);
  font-size: 10px;
}
.bar {
  height: 4px;
  background: #0b0d1c;
  margin-top: 3px;
}
.bar-fill {
  height: 100%;
  transition: width 0.08s linear;
}
.bar-fill.conf {
  background: #6fd0ff;
}
.bar-fill.hold {
  background: #ffe066;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
</style>
