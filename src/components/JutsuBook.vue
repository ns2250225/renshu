<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { SEAL_GUIDE } from '../gesture/sealGuide'
import { SEALS, SEAL_MAP, type SealId } from '../gesture/seals'
import { ELEMENTS, ELEMENT_MAP, JUTSU_LIST, type Element } from '../jutsu/types'
import { state } from '../store/game'
import SealGuide from './SealGuide.vue'

const emit = defineEmits<{ practice: [id: string]; preview: [id: string]; close: [] }>()

const filter = ref<Element | 'all' | 'seals'>('all')
const focusSeal = ref<SealId | null>(null)

async function showSeal(id: SealId): Promise<void> {
  filter.value = 'seals'
  focusSeal.value = id
  await nextTick()
  document.getElementById('seal-' + id)?.scrollIntoView({ block: 'center' })
}
const list = computed(() => (filter.value === 'all' ? JUTSU_LIST : JUTSU_LIST.filter((j) => j.element === filter.value)))

const learned = computed(() => JUTSU_LIST.filter((j) => state.records[j.id]).length)
</script>

<template>
  <div class="modal" @click.self="emit('close')">
    <div class="panel book">
      <header>
        <h2>忍术图鉴 <small>已掌握 {{ learned }} / {{ JUTSU_LIST.length }}</small></h2>
        <button class="btn" @click="emit('close')">关闭 ✕</button>
      </header>
      <nav class="tabs">
        <button :class="{ on: filter === 'all' }" @click="filter = 'all'">全部</button>
        <button
          v-for="e in ELEMENTS"
          :key="e.id"
          :class="{ on: filter === e.id }"
          :style="{ '--c': e.color }"
          @click="filter = e.id"
        >
          {{ e.icon }} {{ e.name }}
        </button>
        <button class="seals-tab" :class="{ on: filter === 'seals' }" @click="filter = 'seals'; focusSeal = null">✋ 十二手印</button>
      </nav>
      <div v-if="filter === 'seals'" class="grid seal-list">
        <article v-for="s in SEALS" :id="'seal-' + s.id" :key="s.id" class="card seal-card" :class="{ focus: focusSeal === s.id }">
          <SealGuide :seal="s.id" :size="140" />
          <div class="seal-info">
            <div class="top">
              <span class="seal-zh">{{ s.zh }}</span>
              <span class="name">{{ s.animal }}印 · {{ s.en }}</span>
              <kbd>{{ s.key.toUpperCase() }}</kbd>
            </div>
            <ol>
              <li v-for="(t, i) in SEAL_GUIDE[s.id].steps" :key="i">{{ t }}</li>
            </ol>
            <p class="tip">💡 {{ SEAL_GUIDE[s.id].tip }}</p>
          </div>
        </article>
        <p class="note">手势示例图来自 <a href="https://github.com/Kazuhito00/NARUTO-HandSignDetection" target="_blank" rel="noreferrer">NARUTO-HandSignDetection</a>。各流派手势略有差异，识别不稳时可在「训练」中录入自己的手势样本。</p>
      </div>
      <div v-else class="grid">
        <article v-for="j in list" :key="j.id" class="card" :class="{ locked: !state.records[j.id] }" :style="{ '--c': ELEMENT_MAP[j.element].color }">
          <div class="top">
            <span class="rank" :class="'r' + j.rank">{{ j.rank }}</span>
            <span class="name">{{ j.name }}</span>
            <span class="el">{{ ELEMENT_MAP[j.element].icon }}</span>
          </div>
          <div class="seals">
            <button v-for="(s, i) in j.seals" :key="i" class="s" :title="SEAL_GUIDE[s].steps.join('，')" @click="showSeal(s)">
              <SealGuide :seal="s" :size="30" />
              <span>{{ SEAL_MAP[s].zh }}<i>{{ SEAL_MAP[s].key.toUpperCase() }}</i></span>
            </button>
          </div>
          <p class="desc">{{ j.desc }}</p>
          <div class="stats">
            <span>伤害 {{ j.damage }}</span>
            <span>查克拉 {{ j.chakra }}</span>
            <span v-if="state.records[j.id]">最佳 {{ state.records[j.id].bestTime.toFixed(2) }}s · {{ state.records[j.id].casts }} 次</span>
            <span v-else class="muted">未施放</span>
          </div>
          <div class="acts">
            <button class="btn sm" @click="emit('practice', j.id)">练习</button>
            <button class="btn sm ghost" :disabled="state.casting" @click="emit('preview', j.id)">演示</button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.book {
  width: min(980px, 94vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 small {
  font-size: 12px;
  color: var(--muted);
  margin-left: 8px;
}
.tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.tabs button {
  background: #0b0d1c;
  color: var(--text);
  border: 2px solid var(--line);
  padding: 3px 8px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.tabs button.on {
  border-color: var(--c, #ffe066);
  color: var(--c, #ffe066);
}
.grid {
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
  padding-right: 4px;
}
.card {
  background: #0b0d1c;
  border: 2px solid var(--line);
  border-left: 4px solid var(--c);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.card.locked .name {
  color: var(--muted);
}
.top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.name {
  font-weight: 900;
  flex: 1;
}
.rank {
  font-family: var(--mono);
  font-weight: 900;
  width: 20px;
  text-align: center;
  border: 1px solid;
}
.rD { color: #c8c8d0; }
.rC { color: #7fe07a; }
.rB { color: #6fb8ff; }
.rA { color: #ffb13b; }
.rS { color: #ff4d6d; }
.seals {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}
.s {
  background: #161a33;
  color: var(--text);
  border: 1px solid var(--line);
  padding: 2px;
  font: inherit;
  font-weight: 700;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}
.s:hover {
  border-color: #ffe066;
}
.s :deep(.seal-image) {
  border-width: 1px;
}
.seals-tab.on {
  border-color: #ffe066;
  color: #ffe066;
}
.seal-list {
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}
.seal-card {
  flex-direction: row;
  border-left-color: #ffe066;
  gap: 10px;
}
.seal-card.focus {
  border-color: #ffe066;
  box-shadow: 0 0 12px rgba(255, 224, 102, 0.5);
}
.seal-info {
  flex: 1;
  min-width: 0;
}
.seal-zh {
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
  color: #ffe066;
  text-shadow: 2px 2px 0 #000;
}
kbd {
  font-family: var(--mono);
  font-size: 10px;
  border: 1px solid var(--line);
  padding: 0 4px;
  color: var(--muted);
}
ol {
  margin: 6px 0 0;
  padding-left: 16px;
  font-size: 12px;
  line-height: 1.5;
  color: #d6d9ee;
}
.tip {
  margin: 4px 0 0;
  font-size: 12px;
  color: #ffd27a;
}
.note {
  grid-column: 1 / -1;
  font-size: 11px;
  color: var(--muted);
  margin: 2px 0;
}
.note a {
  color: #6fb8ff;
}
.s i {
  font-style: normal;
  font-family: var(--mono);
  color: var(--muted);
  font-size: 9px;
  margin-left: 2px;
}
.desc {
  margin: 0;
  font-size: 12px;
  color: #b8bcd8;
  line-height: 1.5;
}
.stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--muted);
}
.acts {
  display: flex;
  gap: 6px;
}
</style>
