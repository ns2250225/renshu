<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { sfx } from './audio/Sfx'
import CameraView from './components/CameraView.vue'
import JutsuBook from './components/JutsuBook.vue'
import PracticeGuide from './components/PracticeGuide.vue'
import SealBar from './components/SealBar.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { Game } from './game/Game'
import { RecognitionPipeline } from './gesture/RecognitionPipeline'
import { SEAL_BY_KEY, SEAL_MAP } from './gesture/seals'
import { JutsuManager } from './jutsu/JutsuManager'
import { ELEMENT_MAP, JUTSU_LIST, JUTSU_MAP } from './jutsu/types'
import { levelOf, persistSettings, state, titleOf, type Mode } from './store/game'

const stageHost = ref<HTMLDivElement>()
const camView = ref<InstanceType<typeof CameraView>>()
const pipeline = new RecognitionPipeline(state.settings)
const game = new Game()
const manager = shallowRef<JutsuManager>()
const loading = ref(false)

sfx.volume = state.settings.volume

onMounted(async () => {
  await game.init(stageHost.value!)
  manager.value = new JutsuManager(game)
  manager.value.loadRecords()
})

onUnmounted(() => {
  pipeline.stop()
  game.destroy()
})

pipeline.onSeal = (s) => manager.value?.input(s)
pipeline.hints = () => manager.value?.expectedSeals() ?? []
pipeline.onStatus = (s) => {
  state.status = s
}
pipeline.onFrame = (f) => {
  const r = state.recog
  r.seal = f.seal
  r.score = f.score
  r.phase = f.phase
  r.progress = f.stab.progress
  r.fps = f.fps
  r.inferMs = f.inferMs
  r.source = f.source
  r.hands = f.hands.hands.length
  camView.value?.draw(f)
}

async function startCamera(): Promise<void> {
  sfx.unlock()
  loading.value = true
  state.started = true
  await pipeline.start()
  loading.value = false
  const s = state.status
  if (s.camera !== 'ready' || (s.classifier === 'failed' && s.hands === 'failed')) state.keyboardMode = true
}

function startKeyboard(): void {
  sfx.unlock()
  state.started = true
  state.keyboardMode = true
}

watch(
  () => ({ ...state.settings }),
  (s) => {
    persistSettings()
    pipeline.applySettings(s)
    sfx.volume = s.volume
  },
  { deep: true },
)

// ---------- 模式 ----------
const MODES: { id: Mode; name: string; tip: string }[] = [
  { id: 'free', name: '自由施法', tip: '任意结印，自动匹配忍术' },
  { id: 'practice', name: '忍术练习', tip: '按提示逐个结印' },
  { id: 'challenge', name: '随机挑战', tip: '限时结出随机忍术' },
  { id: 'continuous', name: '连续施法', tip: '元素交互 · 状态持续更久' },
]

function setMode(m: Mode): void {
  manager.value?.setMode(m)
  state.result = null
}

function practice(id: string): void {
  state.practiceId = id
  state.ui.book = false
  setMode('practice')
}

async function preview(id: string): Promise<void> {
  state.ui.book = false
  await manager.value?.preview(id)
}

function startChallenge(): void {
  state.result = null
  manager.value?.startChallenge()
}

// ---------- 键盘 ----------
function onKey(e: KeyboardEvent): void {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
  if (!state.started) {
    if (e.key === 'Enter') startKeyboard()
    return
  }
  if (e.repeat) return
  const k = e.key.toLowerCase()
  if (state.ui.book || state.ui.settings) {
    if (k === 'escape') state.ui.book = state.ui.settings = false
    return
  }
  const seal = SEAL_BY_KEY[k]
  if (seal) {
    sfx.unlock()
    manager.value?.input(seal.id)
    state.recog.seal = seal.id
    return
  }
  if (k === ' ') {
    e.preventDefault()
    manager.value?.clearSequence()
  } else if (k === 'enter' && state.mode === 'challenge' && state.challenge.phase !== 'countdown' && state.challenge.phase !== 'active') {
    startChallenge()
  } else if (k === 'b') state.ui.book = true
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

// ---------- 展示 ----------
const level = computed(() => levelOf(state.profile.xp))
const xpPct = computed(() => {
  const l = level.value
  const cur = 40 * (l - 1) ** 2
  const next = 40 * l ** 2
  return ((state.profile.xp - cur) / (next - cur)) * 100
})

const banner = ref<{ name: string; rank: string; color: string; key: number } | null>(null)
let bannerTimer = 0
watch(
  () => state.banner?.key,
  () => {
    const b = state.banner
    if (!b) return
    const j = JUTSU_MAP[b.jutsuId]
    banner.value = { name: j.name, rank: j.rank, color: ELEMENT_MAP[j.element].color, key: b.key }
    clearTimeout(bannerTimer)
    bannerTimer = window.setTimeout(() => (banner.value = null), 1800)
  },
)

const reaction = ref<{ text: string; color: string; key: number } | null>(null)
let reactTimer = 0
watch(
  () => state.reaction?.key,
  () => {
    reaction.value = state.reaction
    clearTimeout(reactTimer)
    reactTimer = window.setTimeout(() => (reaction.value = null), 1600)
  },
)

watch(
  () => state.result?.newRecord,
  (v) => {
    if (v) sfx.play('record')
  },
)

const result = computed(() => state.result)
const resultJutsu = computed(() => (state.result ? JUTSU_MAP[state.result.jutsuId] : null))
const practiceJutsu = computed(() => JUTSU_MAP[state.practiceId])
const challengeJutsu = computed(() => JUTSU_MAP[state.challenge.target])
const statusText = computed(() => {
  const s = state.status
  if (state.keyboardMode && s.camera !== 'ready') return '键盘模式'
  if (s.classifier === 'loading' || s.hands === 'loading') return '模型加载中…'
  if (s.classifier === 'failed') return '手印模型失败（仅个人模型 / 键盘）'
  return ''
})
</script>

<template>
  <div class="app">
    <div class="stage-box">
      <div ref="stageHost" class="stage-host" />

      <!-- 左上：玩家信息 + 模式 -->
      <div class="hud-left">
        <div class="profile">
          <div class="logo">忍印道场</div>
          <div class="lv">
            <span>Lv.{{ level }} {{ titleOf(level) }}</span>
            <span class="xpbar"><i :style="{ width: xpPct + '%' }" /></span>
            <span class="muted">施术 {{ state.profile.casts }}</span>
          </div>
        </div>
        <div class="modes">
          <button
            v-for="m in MODES"
            :key="m.id"
            class="mode"
            :class="{ on: state.mode === m.id }"
            :title="m.tip"
            @click="setMode(m.id)"
          >
            {{ m.name }}
          </button>
        </div>
        <div v-if="state.mode === 'practice'" class="sub">
          <select v-model="state.practiceId" @change="manager?.clearSequence()">
            <option v-for="j in JUTSU_LIST" :key="j.id" :value="j.id">
              [{{ j.rank }}] {{ j.name }}
            </option>
          </select>
          <span class="muted" v-if="state.records[practiceJutsu.id]">最佳 {{ state.records[practiceJutsu.id].bestTime.toFixed(2) }}s</span>
        </div>
        <div v-if="state.mode === 'challenge'" class="sub">
          <span>第 {{ state.challenge.round }} 题 · 得分 <b class="gold">{{ state.challenge.score }}</b></span>
        </div>
        <div v-if="state.mode === 'continuous' && state.chain.length" class="sub chain">
          <span v-for="(e, i) in state.chain" :key="i" :style="{ color: ELEMENT_MAP[e].color }">{{ ELEMENT_MAP[e].icon }}</span>
        </div>
        <div class="tools">
          <button class="btn sm" @click="state.ui.book = true">📖 图鉴</button>
          <button class="btn sm" @click="state.ui.training = false; state.ui.settings = true">⚙ 设置</button>
          <button class="btn sm" @click="state.ui.training = true; state.ui.settings = true">✋ 训练</button>
        </div>
        <div v-if="statusText" class="status">{{ statusText }}</div>
        <PracticeGuide v-if="state.mode === 'practice' && state.started" />
      </div>

      <!-- 右上：摄像头 -->
      <div class="hud-right">
        <CameraView ref="camView" :video="pipeline.camera.video" />
      </div>

      <!-- 中央：术名横幅 / 元素反应 -->
      <Transition name="banner">
        <div v-if="banner" :key="banner.key" class="banner" :class="'rk' + banner.rank" :style="{ '--c': banner.color }">
          <small>{{ banner.rank }} 级</small>
          <span>{{ banner.name }}</span>
        </div>
      </Transition>
      <Transition name="react">
        <div v-if="reaction" :key="reaction.key" class="reaction" :style="{ color: reaction.color }">
          ◆ {{ reaction.text }} ◆
        </div>
      </Transition>

      <!-- 挑战 -->
      <div v-if="state.mode === 'challenge' && state.started" class="challenge">
        <template v-if="state.challenge.phase === 'idle' || (state.challenge.phase === 'done' && !state.casting && !result)">
          <button class="btn big" @click="startChallenge">{{ state.challenge.round ? '下一题' : '开始挑战' }} <small>Enter</small></button>
        </template>
        <div v-else-if="state.challenge.phase === 'countdown'" :key="state.challenge.count" class="count">
          {{ state.challenge.count }}
        </div>
        <div v-else-if="state.challenge.phase === 'active'" class="target">
          <small>目标忍术</small>
          <b :style="{ color: ELEMENT_MAP[challengeJutsu.element].color }">{{ challengeJutsu.name }}</b>
          <span class="muted">{{ challengeJutsu.seals.map((s) => SEAL_MAP[s].zh).join(' · ') }}</span>
        </div>
      </div>

      <!-- 施法成绩 -->
      <Transition name="result">
        <div v-if="result && resultJutsu" class="result">
          <div class="r-title">
            <span>{{ resultJutsu.name }}</span>
            <span v-if="result.grade" class="grade" :class="'g' + result.grade">{{ result.grade }}</span>
          </div>
          <div class="r-grid">
            <span>结印时间</span><b>{{ result.time.toFixed(2) }}s</b>
            <span>平均每印</span><b>{{ result.avg.toFixed(2) }}s</b>
            <span>准确率</span><b>{{ Math.round(result.accuracy * 100) }}%</b>
            <span>个人最佳</span><b>{{ result.best?.toFixed(2) ?? '—' }}s</b>
          </div>
          <div v-if="result.newRecord" class="record">★ NEW RECORD ★</div>
          <button v-if="state.mode === 'challenge'" class="btn sm" @click="startChallenge">下一题 (Enter)</button>
        </div>
      </Transition>

      <!-- 底部：结印条 -->
      <div class="hud-bottom">
        <SealBar />
      </div>

      <!-- 开始界面 -->
      <div v-if="!state.started" class="start">
        <div class="start-card">
          <h1>忍印道场</h1>
          <p class="en">NINJA SEAL DOJO</p>
          <p>对着摄像头结出十二手印，释放 {{ JUTSU_LIST.length }} 种忍术。</p>
          <p class="muted">所有识别均在浏览器本地完成，画面不会上传。</p>
          <div class="start-btns">
            <button class="btn big" :disabled="loading" @click="startCamera">📷 开启摄像头</button>
            <button class="btn ghost" @click="startKeyboard">⌨ 键盘模式 (Enter)</button>
          </div>
          <p class="muted small">键盘：1 2 3 4 5 6 7 8 9 0 Q W → 子 丑 寅 卯 辰 巳 午 未 申 酉 戌 亥</p>
        </div>
      </div>
    </div>

    <JutsuBook v-if="state.ui.book" @close="state.ui.book = false" @practice="practice" @preview="preview" />
    <SettingsPanel v-if="state.ui.settings" :pipeline="pipeline" @close="state.ui.settings = false" />
  </div>
</template>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  display: grid;
  place-items: center;
  overflow: hidden;
}
.stage-box {
  position: relative;
  width: min(100vw, calc(100vh * 16 / 9));
  aspect-ratio: 16 / 9;
  background: #000;
}
.stage-host {
  position: absolute;
  inset: 0;
}
.stage-host :deep(canvas) {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  display: block;
}
.hud-left {
  position: absolute;
  left: 12px;
  top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.profile {
  background: var(--panel);
  border: 3px solid var(--line);
  box-shadow: 0 0 0 2px #000, 4px 4px 0 #000;
  padding: 6px 10px;
}
.logo {
  font-weight: 900;
  font-size: 20px;
  letter-spacing: 2px;
  color: #ffe066;
  text-shadow: 2px 2px 0 #9c1f2c;
}
.lv {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.xpbar {
  width: 80px;
  height: 6px;
  background: #0b0d1c;
  border: 1px solid var(--line);
}
.xpbar i {
  display: block;
  height: 100%;
  background: #6fd0ff;
}
.modes {
  display: flex;
  gap: 4px;
}
.mode {
  background: var(--panel);
  color: var(--text);
  border: 2px solid var(--line);
  box-shadow: 2px 2px 0 #000;
  padding: 4px 8px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.mode.on {
  background: #2a2410;
  border-color: #ffe066;
  color: #ffe066;
}
.sub {
  background: rgba(10, 12, 28, 0.8);
  border: 2px solid var(--line);
  padding: 3px 8px;
  font-size: 13px;
  display: flex;
  gap: 8px;
  align-items: center;
}
.sub select {
  background: #0b0d1c;
  color: var(--text);
  border: 1px solid var(--line);
  font: inherit;
}
.chain {
  font-size: 16px;
  gap: 4px;
}
.tools {
  display: flex;
  gap: 4px;
}
.status {
  font-size: 12px;
  color: #ffb13b;
  background: rgba(0, 0, 0, 0.6);
  padding: 2px 6px;
}
.hud-right {
  position: absolute;
  right: 12px;
  top: 12px;
}
.hud-bottom {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
}
.banner {
  position: absolute;
  left: 50%;
  top: 30%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
  white-space: nowrap;
}
.banner span {
  font-size: clamp(24px, 4vw, 52px);
  font-weight: 900;
  color: #fff;
  letter-spacing: 6px;
  text-shadow: 3px 3px 0 #000, 0 0 16px var(--c);
  -webkit-text-stroke: 1px var(--c);
}
.banner small {
  font-family: var(--mono);
  color: var(--c);
  font-weight: 900;
  text-shadow: 2px 2px 0 #000;
}
.banner.rkS span {
  font-size: clamp(30px, 5vw, 64px);
  color: #ffe066;
}
.banner.rkA span {
  font-size: clamp(28px, 4.5vw, 58px);
}
.reaction {
  position: absolute;
  left: 50%;
  top: 44%;
  transform: translateX(-50%);
  font-size: clamp(18px, 2.6vw, 32px);
  font-weight: 900;
  text-shadow: 3px 3px 0 #000;
  pointer-events: none;
  white-space: nowrap;
}
.challenge {
  position: absolute;
  left: 50%;
  top: 18%;
  transform: translateX(-50%);
  text-align: center;
}
.count {
  font-family: var(--mono);
  font-size: clamp(60px, 10vw, 120px);
  font-weight: 900;
  color: #ffe066;
  text-shadow: 5px 5px 0 #000;
  animation: countpop 0.8s steps(4);
}
.target {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(10, 12, 28, 0.85);
  border: 3px solid var(--line);
  padding: 6px 18px;
}
.target b {
  font-size: 26px;
  text-shadow: 2px 2px 0 #000;
}
.result {
  position: absolute;
  right: 12px;
  top: 250px;
  width: 240px;
  background: var(--panel);
  border: 3px solid #ffe066;
  box-shadow: 0 0 0 2px #000, 4px 4px 0 #000;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.r-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 900;
  font-size: 16px;
}
.grade {
  font-family: var(--mono);
  font-size: 30px;
  line-height: 1;
  text-shadow: 2px 2px 0 #000;
}
.gS { color: #ff4d6d; }
.gA { color: #ffb13b; }
.gB { color: #6fb8ff; }
.gC { color: #c8c8d0; }
.r-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 8px;
  font-size: 13px;
}
.r-grid span {
  color: var(--muted);
}
.r-grid b {
  font-family: var(--mono);
}
.record {
  color: #ffe066;
  font-weight: 900;
  text-align: center;
  animation: blink 0.5s steps(2) infinite;
}
.start {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(5, 6, 15, 0.72);
}
.start-card {
  background: var(--panel);
  border: 4px solid var(--line);
  box-shadow: 0 0 0 3px #000, 6px 6px 0 #000;
  padding: 20px 28px;
  text-align: center;
  max-width: 520px;
}
.start-card h1 {
  margin: 0;
  font-size: 44px;
  color: #ffe066;
  letter-spacing: 8px;
  text-shadow: 4px 4px 0 #9c1f2c;
}
.en {
  font-family: var(--mono);
  color: var(--muted);
  letter-spacing: 4px;
  margin-top: 2px;
}
.start-btns {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin: 16px 0 8px;
}
.small {
  font-size: 11px;
}
.gold {
  color: #ffe066;
}
.banner-enter-active {
  animation: bannerIn 0.35s steps(5);
}
.banner-leave-active {
  transition: opacity 0.3s;
}
.banner-leave-to {
  opacity: 0;
}
.react-enter-active {
  animation: bannerIn 0.3s steps(4);
}
.react-leave-active,
.result-leave-active {
  transition: opacity 0.3s;
}
.react-leave-to,
.result-leave-to {
  opacity: 0;
}
.result-enter-active {
  animation: slideIn 0.25s steps(4);
}
@keyframes bannerIn {
  from { transform: translateX(-50%) scale(2.2); opacity: 0; }
  to { transform: translateX(-50%) scale(1); opacity: 1; }
}
@keyframes slideIn {
  from { transform: translateX(40px); opacity: 0; }
}
@keyframes countpop {
  from { transform: scale(1.8); opacity: 0.2; }
  30% { transform: scale(1); opacity: 1; }
}
@keyframes blink {
  50% { opacity: 0.4; }
}
</style>
