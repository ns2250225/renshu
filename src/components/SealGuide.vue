<script setup lang="ts">
import { computed } from 'vue'
import { SEAL_MAP, type SealId } from '../gesture/seals'

const props = withDefaults(defineProps<{ seal: SealId; size?: number; label?: boolean }>(), { size: 120, label: false })
const imageSrc = computed(() => `/seals/${props.seal}.jpg`)
</script>

<template>
  <figure class="seal-guide" :style="{ width: size + 'px' }">
    <img
      class="seal-image"
      :src="imageSrc"
      :width="size"
      :alt="SEAL_MAP[seal].zh + '印手势示例'"
      loading="lazy"
      decoding="async"
    />
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
.seal-image {
  display: block;
  width: 100%;
  height: auto;
  border: 2px solid var(--line);
  background: #0b0d1c;
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
