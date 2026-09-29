<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { CameraManager } from '../gesture/CameraManager'
import type { RecognitionPipeline } from '../gesture/RecognitionPipeline'
import { SEALS, SEAL_MAP, type SealId } from '../gesture/seals'
import { SEAL_GUIDE } from '../gesture/sealGuide'
import { DEFAULT_SETTINGS, RECOG_PRESETS, applyPreset, state, type RecogPreset } from '../store/game'
import SealGuide from './SealGuide.vue'

const props = defineProps<{ pipeline: RecognitionPipeline }>()
const emit = defineEmits<{ close: [] }>()

const tab = ref<'recog' | 'train'>(state.ui.training ? 'train' : 'recog')
const devices = ref<MediaDeviceInfo[]>([])
const presetIds = Object.keys(RECOG_PRESETS) as RecogPreset[]
function presetOn(id: RecogPreset): boolean {
  const p = RECOG_PRESETS[id]
  const s = state.settings
  return s.scoreTh === p.scoreTh && s.windowSize === p.windowSize && s.ratio === p.ratio && s.holdMs === p.holdMs && s.hintAssist === p.hintAssist
}
const deviceId = ref('')

// ---------- 训练 ----------
const counts = ref<Partial<Record<SealId, number>>>({})
const trainSeal = ref<SealId>('rat')
const capturing = ref(false)
const countdown = ref(0)
const progress = ref(0)
const msg = ref('')
let raf = 0

async function refreshCounts(): Promise<void> {
  counts.value = await props.pipeline.personal.counts()
}

onMounted(async () => {
  devices.value = await CameraManager.listDevices()
  refreshCounts()
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  props.pipeline.cancelCapture()
  props.pipeline.suspendInput = false
})

async function capture(): Promise<void> {
  if (capturing.value) return
  if (state.status.hands !== 'ready' || state.status.camera !== 'ready') {
    msg.value = '需要摄像头与手部骨架模型均已就绪'
    return
  }
  capturing.value = true
  props.pipeline.suspendInput = true
  msg.value = ''
  for (let n = 3; n >= 1; n--) {
    countdown.value = n
    await new Promise((r) => setTimeout(r, 700))
  }
  countdown.value = 0
  const tick = () => {
    progress.value = props.pipeline.captureProgress
    raf = requestAnimationFrame(tick)
  }
  tick()
  const got = await props.pipeline.captureSamples(trainSeal.value, 40)
  cancelAnimationFrame(raf)
  progress.value = 0
  capturing.value = false
  props.pipeline.suspendInput = false
  msg.value = got ? `已采集「${SEAL_MAP[trainSeal.value].zh}」${got} 帧样本` : '已取消'
  refreshCounts()
}

async function clearSeal(seal?: SealId): Promise<void> {
  await props.pipeline.personal.clear(seal)
  refreshCounts()
}

function reset(): void {
  Object.assign(state.settings, DEFAULT_SETTINGS)
}

function switchCamera(): void {
  props.pipeline.restartCamera(deviceId.value || undefined)
}
</script>

<template>
  <div class="modal" @click.self="emit('close')">
    <div class="panel settings">
      <header>
        <nav class="tabs">
          <button :class="{ on: tab === 'recog' }" @click="tab = 'recog'">识别设置</button>
          <button :class="{ on: tab === 'train' }" @click="tab = 'train'">手印训练</button>
        </nav>
        <button class="btn" @click="emit('close')">关闭 ✕</button>
      </header>

      <section v-if="tab === 'recog'" class="form">
        <div class="preset">
          <span>识别宽松度</span>
          <button v-for="id in presetIds" :key="id" class="btn sm" :class="{ on: presetOn(id) }" @click="applyPreset(id)">
            {{ RECOG_PRESETS[id].name }}
          </button>
          <small class="muted">总识别不出来就选「宽松」；误识别多就选「严格」</small>
        </div>
        <label>
          <span>识别阈值 <b>{{ state.settings.scoreTh.toFixed(2) }}</b></span>
          <input v-model.number="state.settings.scoreTh" type="range" min="0.2" max="0.9" step="0.01" />
        </label>
        <label>
          <span>稳定窗口 <b>{{ state.settings.windowSize }} 帧</b></span>
          <input v-model.number="state.settings.windowSize" type="range" min="4" max="20" step="1" />
        </label>
        <label>
          <span>稳定占比 <b>{{ Math.round(state.settings.ratio * 100) }}%</b></span>
          <input v-model.number="state.settings.ratio" type="range" min="0.4" max="0.95" step="0.05" />
        </label>
        <label>
          <span>保持时间 <b>{{ state.settings.holdMs }} ms</b></span>
          <input v-model.number="state.settings.holdMs" type="range" min="0" max="800" step="50" />
        </label>
        <label>
          <span>识别帧率 <b>{{ state.settings.targetFps }} fps</b></span>
          <input v-model.number="state.settings.targetFps" type="range" min="8" max="30" step="1" />
        </label>
        <label>
          <span>序列超时 <b>{{ (state.settings.seqTimeoutMs / 1000).toFixed(1) }} s</b></span>
          <input v-model.number="state.settings.seqTimeoutMs" type="range" min="2000" max="10000" step="500" />
        </label>
        <label>
          <span>音量 <b>{{ Math.round(state.settings.volume * 100) }}%</b></span>
          <input v-model.number="state.settings.volume" type="range" min="0" max="1" step="0.05" />
        </label>
        <div class="checks">
          <label class="ck"><input v-model="state.settings.showSkeleton" type="checkbox" /> 显示骨架</label>
          <label class="ck"><input v-model="state.settings.showBox" type="checkbox" /> 显示识别框</label>
          <label class="ck"><input v-model="state.settings.mirror" type="checkbox" /> 镜像画面</label>
          <label class="ck" title="练习 / 挑战的下一印、自由模式可接续的印只需摆得差不多即可确认"><input v-model="state.settings.hintAssist" type="checkbox" /> 宽松辅助（期望的印降低门槛）</label>
          <label class="ck"><input v-model="state.settings.usePersonal" type="checkbox" /> 启用个人模型</label>
          <label class="ck"><input v-model="state.settings.preferPersonal" type="checkbox" /> 个人模型优先</label>
        </div>
        <label v-if="devices.length > 1">
          <span>摄像头</span>
          <select v-model="deviceId" @change="switchCamera">
            <option value="">默认</option>
            <option v-for="d in devices" :key="d.deviceId" :value="d.deviceId">{{ d.label || d.deviceId.slice(0, 8) }}</option>
          </select>
        </label>
        <div class="meta">
          推理后端：{{ state.status.backend || '—' }} · 手印模型：{{ state.status.classifier }} · 骨架：{{ state.status.hands }}
        </div>
        <button class="btn ghost" @click="reset">恢复默认</button>
      </section>

      <section v-else class="train">
        <p class="tip">
          对着摄像头摆出手印，点击「采集」后保持姿势约 2 秒。样本保存在本机浏览器（IndexedDB），
          用于在内置模型识别不稳定时进行个性化 KNN 识别。建议每个手印采集 2~3 次、稍微变换角度。
        </p>
        <div class="seal-grid">
          <button
            v-for="s in SEALS"
            :key="s.id"
            class="seal-btn"
            :class="{ on: trainSeal === s.id }"
            :disabled="capturing"
            @click="trainSeal = s.id"
          >
            <b>{{ s.zh }}</b>
            <small>{{ s.animal }} · {{ counts[s.id] ?? 0 }}</small>
          </button>
        </div>
        <div class="train-guide">
          <SealGuide :seal="trainSeal" :size="120" />
          <div>
            <b>{{ SEAL_MAP[trainSeal].zh }} · {{ SEAL_MAP[trainSeal].animal }}印</b>
            <ol>
              <li v-for="(t, i) in SEAL_GUIDE[trainSeal].steps" :key="i">{{ t }}</li>
            </ol>
            <small>💡 {{ SEAL_GUIDE[trainSeal].tip }}</small>
          </div>
        </div>
        <div class="cap-row">
          <button class="btn" :disabled="capturing" @click="capture">
            {{ capturing ? (countdown ? `准备 ${countdown}` : '采集中…') : `采集「${SEAL_MAP[trainSeal].zh}」` }}
          </button>
          <div class="cap-bar"><i :style="{ width: progress * 100 + '%' }" /></div>
          <button class="btn ghost sm" :disabled="capturing" @click="clearSeal(trainSeal)">清除此印</button>
          <button class="btn ghost sm" :disabled="capturing" @click="clearSeal()">清除全部</button>
        </div>
        <p class="msg">{{ msg }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings {
  width: min(560px, 94vw);
  max-height: 88vh;
  overflow: auto;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.tabs {
  display: flex;
  gap: 4px;
}
.tabs button {
  background: #0b0d1c;
  color: var(--text);
  border: 2px solid var(--line);
  padding: 4px 10px;
  font: inherit;
  cursor: pointer;
}
.tabs button.on {
  border-color: #ffe066;
  color: #ffe066;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form label {
  display: grid;
  grid-template-columns: 160px 1fr;
  align-items: center;
  font-size: 13px;
}
.form label b {
  color: #ffe066;
  font-family: var(--mono);
}
.preset {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.preset > span {
  width: 154px;
}
.preset .btn.on {
  border-color: #ffe066;
  color: #ffe066;
}
.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
}
.form .ck {
  display: flex;
  gap: 4px;
  font-size: 13px;
}
select {
  background: #0b0d1c;
  color: var(--text);
  border: 2px solid var(--line);
  font: inherit;
  padding: 2px;
}
input[type='range'] {
  accent-color: #ffe066;
}
.meta {
  font-size: 11px;
  color: var(--muted);
}
.tip {
  font-size: 12px;
  color: #b8bcd8;
  line-height: 1.6;
  margin-top: 0;
}
.seal-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 5px;
}
.seal-btn {
  background: #0b0d1c;
  color: var(--text);
  border: 2px solid var(--line);
  padding: 5px 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  font: inherit;
}
.seal-btn b {
  font-size: 20px;
}
.seal-btn small {
  font-size: 10px;
  color: var(--muted);
}
.seal-btn.on {
  border-color: #ffe066;
  background: #2a2410;
}
.train-guide {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  font-size: 12px;
}
.train-guide b {
  color: #ffe066;
  font-size: 14px;
}
.train-guide ol {
  margin: 4px 0;
  padding-left: 16px;
  line-height: 1.5;
}
.train-guide small {
  color: #ffd27a;
}
.cap-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.cap-bar {
  flex: 1;
  height: 8px;
  background: #0b0d1c;
  border: 1px solid var(--line);
}
.cap-bar i {
  display: block;
  height: 100%;
  background: #7fe07a;
}
.msg {
  color: #7fe07a;
  font-size: 12px;
  min-height: 1em;
}
</style>
