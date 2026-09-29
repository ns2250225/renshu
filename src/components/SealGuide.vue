<script setup lang="ts">
import { computed } from 'vue'
import { SEAL_GUIDE, type GuidePart } from '../gesture/sealGuide'
import { SEAL_MAP, type SealId } from '../gesture/seals'

const props = withDefaults(defineProps<{ seal: SealId; size?: number; label?: boolean }>(), { size: 120, label: false })

const SKIN = { L: '#f7d2a4', R: '#e0a06e' }
const SLEEVE = { L: '#3a5fb0', R: '#8c2a3a' }
const LINE = '#2a1a10'

const parts = computed(() => SEAL_GUIDE[props.seal].parts)

function pts(p: [number, number][]): string {
  return p.map((q) => q.join(',')).join(' ')
}

/** 拳头 / 平掌上的指缝线 */
function gaps(p: Extract<GuidePart, { k: 'block' }>): { x1: number; y1: number; x2: number; y2: number }[] {
  const n = p.n ?? 4
  const out = []
  for (let i = 1; i < n; i++) {
    if (p.lines === 'v') {
      const x = p.x + (p.w * i) / n
      out.push({ x1: x, y1: p.y + 2, x2: x, y2: p.y + p.hgt * 0.45 })
    } else {
      const y = p.y + (p.hgt * i) / n
      out.push({ x1: p.x + p.w * 0.55, y1: y, x2: p.x + p.w - 2, y2: y })
    }
  }
  return p.lines ? out : []
}
</script>

<template>
  <figure class="seal-guide" :style="{ width: size + 'px' }">
    <svg :width="size" :height="(size * 100) / 120" viewBox="0 0 120 100" role="img" :aria-label="SEAL_MAP[seal].zh + '印示意图'">
      <rect x="0" y="0" width="120" height="100" rx="6" fill="#0b0d1c" />
      <g stroke-linecap="round" stroke-linejoin="round">
        <template v-for="(p, i) in parts" :key="i">
          <template v-if="p.k === 'arm'">
            <line :x1="p.from[0]" :y1="p.from[1]" :x2="p.to[0]" :y2="p.to[1]" :stroke="LINE" stroke-width="17" />
            <line :x1="p.from[0]" :y1="p.from[1]" :x2="p.to[0]" :y2="p.to[1]" :stroke="SLEEVE[p.h]" stroke-width="14" />
          </template>
          <ellipse v-else-if="p.k === 'palm'" :cx="p.cx" :cy="p.cy" :rx="p.rx" :ry="p.ry" :fill="SKIN[p.h]" :stroke="LINE" stroke-width="1.6" />
          <g v-else-if="p.k === 'block'">
            <rect :x="p.x" :y="p.y" :width="p.w" :height="p.hgt" rx="6" :fill="SKIN[p.h]" :stroke="LINE" stroke-width="1.6" />
            <line v-for="(g, j) in gaps(p)" :key="j" v-bind="g" :stroke="LINE" stroke-width="1" opacity="0.6" />
          </g>
          <template v-else-if="p.k === 'finger'">
            <polyline :points="pts(p.pts)" fill="none" :stroke="LINE" :stroke-width="(p.w ?? 6) + 3.2" />
            <polyline :points="pts(p.pts)" fill="none" :stroke="SKIN[p.h]" :stroke-width="p.w ?? 6" />
          </template>
          <circle v-else-if="p.k === 'dot'" :cx="p.x" :cy="p.y" :r="p.r ?? 4" :fill="SKIN[p.h]" :stroke="LINE" stroke-width="1.6" />
        </template>
      </g>
      <text x="5" y="96" class="hand-label" :fill="SLEEVE.L">左</text>
      <text x="115" y="96" class="hand-label" text-anchor="end" :fill="SLEEVE.R">右</text>
    </svg>
    <figcaption v-if="label">
      <b>{{ SEAL_MAP[seal].zh }}</b> {{ SEAL_MAP[seal].animal }} <kbd>{{ SEAL_MAP[seal].key.toUpperCase() }}</kbd>
    </figcaption>
  </figure>
</template>

<style scoped>
.seal-guide {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
svg {
  display: block;
  border: 2px solid var(--line);
}
.hand-label {
  font-size: 9px;
  font-weight: 900;
  paint-order: stroke;
  stroke: #0b0d1c;
  stroke-width: 2px;
}
figcaption {
  font-size: 12px;
  margin-top: 2px;
}
figcaption b {
  font-size: 15px;
}
kbd {
  font-family: var(--mono);
  font-size: 10px;
  border: 1px solid var(--line);
  padding: 0 3px;
  color: var(--muted);
}
</style>
