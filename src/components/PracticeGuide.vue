<script setup lang="ts">
import { computed, ref } from 'vue'
import { SEAL_GUIDE } from '../gesture/sealGuide'
import { SEAL_MAP } from '../gesture/seals'
import { JUTSU_MAP } from '../jutsu/types'
import { state } from '../store/game'
import SealGuide from './SealGuide.vue'

const open = ref(true)
const jutsu = computed(() => JUTSU_MAP[state.practiceId])
const idx = computed(() => {
  const n = state.seq.length
  return n < jutsu.value.seals.length ? n : 0
})
const seal = computed(() => jutsu.value.seals[idx.value])
const guide = computed(() => SEAL_GUIDE[seal.value])
</script>

<template>
  <div class="guide-card">
    <header>
      <span>下一印 <b>{{ idx + 1 }}/{{ jutsu.seals.length }}</b></span>
      <button class="btn sm ghost" @click="open = !open">{{ open ? '收起图解' : '展开图解' }}</button>
    </header>
    <template v-if="open">
      <div class="main">
        <SealGuide :key="seal + idx" class="pop" :seal="seal" :size="132" />
        <div class="info">
          <div class="name">
            <b>{{ SEAL_MAP[seal].zh }}</b>
            <span>{{ SEAL_MAP[seal].animal }}印</span>
            <kbd>{{ SEAL_MAP[seal].key.toUpperCase() }}</kbd>
          </div>
          <ol>
            <li v-for="(s, i) in guide.steps" :key="i">{{ s }}</li>
          </ol>
        </div>
      </div>
      <p class="tip">💡 {{ guide.tip }}</p>
      <div class="thumbs">
        <div v-for="(s, i) in jutsu.seals" :key="i" class="thumb" :class="{ done: i < state.seq.length, cur: i === idx }">
          <SealGuide :seal="s" :size="44" />
          <span>{{ SEAL_MAP[s].zh }}</span>
        </div>
      </div>
      <p class="note">实拍示例来自 NARUTO-HandSignDetection · 请按画面中的手势结印</p>
    </template>
  </div>
</template>

<style scoped>
.guide-card {
  width: 300px;
  background: var(--panel);
  border: 3px solid var(--line);
  box-shadow: 0 0 0 2px #000, 4px 4px 0 #000;
  padding: 6px 8px;
  font-size: 12px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--muted);
}
header b {
  color: #ffe066;
  font-family: var(--mono);
}
.main {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.name b {
  font-size: 28px;
  line-height: 1;
  color: #ffe066;
  text-shadow: 2px 2px 0 #000;
}
kbd {
  font-family: var(--mono);
  font-size: 10px;
  border: 1px solid var(--line);
  background: #0b0d1c;
  padding: 0 4px;
}
ol {
  margin: 4px 0 0;
  padding-left: 16px;
  line-height: 1.45;
  color: #d6d9ee;
}
.tip {
  margin: 4px 0;
  color: #ffd27a;
}
.thumbs {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}
.thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 11px;
  opacity: 0.55;
}
.thumb.done {
  opacity: 0.9;
  filter: saturate(0.4);
}
.thumb.done span {
  color: #4fc3ff;
}
.thumb.cur {
  opacity: 1;
}
.thumb.cur :deep(.seal-image) {
  border-color: #ffe066;
}
.note {
  margin: 4px 0 0;
  font-size: 10px;
  color: var(--muted);
}
.pop {
  animation: pop 0.2s steps(3);
}
@keyframes pop {
  from { transform: scale(1.15); }
}
</style>
