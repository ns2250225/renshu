<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SEAL_MAP, type SealId } from '../gesture/seals'
import { ELEMENT_MAP, JUTSU_MAP } from '../jutsu/types'
import { state } from '../store/game'

/** 施法完成后短暂展示的整串手印 */
const done = ref<{ seals: SealId[]; name: string } | null>(null)
let doneTimer = 0
watch(
  () => state.castSeq?.key,
  () => {
    const c = state.castSeq
    if (!c) return
    done.value = { seals: c.seals, name: JUTSU_MAP[c.jutsuId]?.name ?? '' }
    clearTimeout(doneTimer)
    doneTimer = window.setTimeout(() => (done.value = null), 1300)
  },
)

const target = computed(() => {
  if (state.mode === 'practice') return JUTSU_MAP[state.practiceId]
  if (state.mode === 'challenge' && state.challenge.phase !== 'idle') return JUTSU_MAP[state.challenge.target]
  return null
})

/** 练习 / 挑战模式下显示完整目标序列；自由模式显示已结印 */
const slots = computed(() => {
  if (done.value && !state.seq.length) return done.value.seals.map((s) => ({ seal: s, state: 'done' as const }))
  const t = target.value
  if (t) {
    return t.seals.map((s, i) => ({
      seal: s,
      state: i < state.seq.length ? ('ok' as const) : i === state.seq.length ? ('next' as const) : ('todo' as const),
    }))
  }
  return state.seq.map((s) => ({ seal: s.seal, state: 'ok' as const }))
})

const ratingCls = computed(() => {
  const t = state.lastRating?.text ?? ''
  if (t === 'MISS') return 'miss'
  if (t.startsWith('FAST')) return 'fast'
  return t.toLowerCase()
})
</script>

<template>
  <div class="sealbar">
    <div class="seq">
      <div v-if="!slots.length" class="hint">
        结印开始 · 键盘 <kbd>1</kbd>~<kbd>0</kbd> <kbd>Q</kbd> <kbd>W</kbd> 对应 子~亥，<kbd>空格</kbd> 清空
      </div>
      <TransitionGroup name="pop">
        <div
          v-for="(s, i) in slots"
          :key="i + s.seal + (done ? 'd' : '')"
          class="slot"
          :class="s.state"
        >
          <span class="zh">{{ SEAL_MAP[s.seal].zh }}</span>
          <span class="an">{{ SEAL_MAP[s.seal].animal }}</span>
        </div>
      </TransitionGroup>
      <div v-if="state.pendingCast" class="pending">▶ {{ JUTSU_MAP[state.pendingCast].short }}</div>
      <div v-if="done && !state.seq.length" class="done-name">{{ done.name }}</div>
    </div>

    <div class="side">
      <Transition name="rate" mode="out-in">
        <div v-if="state.lastRating" :key="state.lastRating.key" class="rating" :class="ratingCls">
          {{ state.lastRating.text }}
        </div>
      </Transition>
      <div class="combo" v-if="state.combo > 1">COMBO <b>{{ state.combo }}</b></div>
    </div>

    <div class="cands" v-if="state.candidates.length && state.mode !== 'challenge'">
      <div v-for="c in state.candidates" :key="c.id" class="cand">
        <span class="el" :style="{ color: ELEMENT_MAP[c.element].color }">{{ ELEMENT_MAP[c.element].icon }}</span>
        <span class="nm">{{ c.short }}</span>
        <span class="pg"><i :style="{ width: c.progress * 100 + '%', background: ELEMENT_MAP[c.element].color }" /></span>
        <span class="ct">{{ c.matched }}/{{ c.total }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sealbar {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 6px 12px;
  padding: 8px 12px;
  background: var(--panel);
  border: 3px solid var(--line);
  box-shadow: 0 0 0 2px #000, 4px 4px 0 #000;
  min-height: 72px;
}
.seq {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 52px;
}
.hint {
  color: var(--muted);
  font-size: 13px;
}
kbd {
  display: inline-block;
  padding: 0 4px;
  border: 1px solid var(--line);
  background: #0b0d1c;
  font-family: var(--mono);
  font-size: 11px;
}
.slot {
  width: 44px;
  height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--line);
  background: #0b0d1c;
  box-shadow: 2px 2px 0 #000;
}
.slot .zh {
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
}
.slot .an {
  font-size: 10px;
  color: var(--muted);
  margin-top: 3px;
}
.slot.ok {
  border-color: #4fc3ff;
  background: #10284a;
}
.slot.done {
  border-color: #ffe066;
  background: #3a2e10;
  animation: glow 0.6s ease-out;
}
.slot.next {
  border-color: #ffe066;
  animation: blink 0.8s steps(2) infinite;
}
.slot.todo {
  opacity: 0.45;
}
.pending {
  color: #ffe066;
  font-weight: 700;
  font-size: 13px;
  animation: blink 0.4s steps(2) infinite;
}
.done-name {
  color: #ffe066;
  font-weight: 900;
  font-size: 18px;
  margin-left: 8px;
  text-shadow: 2px 2px 0 #000;
}
.side {
  grid-row: 1 / span 2;
  grid-column: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  min-width: 130px;
}
.rating {
  font-family: var(--mono);
  font-weight: 900;
  font-size: 22px;
  text-shadow: 2px 2px 0 #000;
  letter-spacing: 1px;
}
.rating.good { color: #b0f0a0; }
.rating.great { color: #6fd0ff; }
.rating.perfect { color: #ffe066; }
.rating.fast { color: #ff9a1f; font-size: 18px; }
.rating.miss { color: #ff4d4d; }
.combo {
  font-family: var(--mono);
  color: var(--muted);
  font-size: 12px;
}
.combo b {
  color: #fff;
  font-size: 16px;
}
.cands {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.cand {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 2px 6px;
  background: #0b0d1c;
  border: 1px solid var(--line);
}
.cand .pg {
  width: 40px;
  height: 4px;
  background: #222640;
  display: inline-block;
}
.cand .pg i {
  display: block;
  height: 100%;
}
.cand .ct {
  font-family: var(--mono);
  color: var(--muted);
  font-size: 10px;
}
.pop-enter-active {
  animation: popin 0.18s steps(3);
}
.rate-enter-active {
  animation: popin 0.2s steps(3);
}
.rate-leave-active {
  transition: opacity 0.1s;
}
.rate-leave-to {
  opacity: 0;
}
@keyframes popin {
  from { transform: scale(1.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes blink {
  50% { opacity: 0.4; }
}
@keyframes glow {
  from { box-shadow: 0 0 16px #ffe066; }
}
</style>
