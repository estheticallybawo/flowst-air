<script setup lang="ts">
import type { FlowstAgentId } from '~/shared/agents'
import { FLOWST_AGENTS } from '~/shared/agents'

const props = withDefaults(defineProps<{
  agent: FlowstAgentId | 'MISU'
  size?: 'compact' | 'standard' | 'large'
  labelled?: boolean
  portrait?: boolean
}>(), {
  size: 'standard',
  labelled: true,
  portrait: false,
})

const failed = ref(false)
const identity = computed(() => FLOWST_AGENTS[props.agent === 'MISU' ? 'MIRO' : props.agent])
const accessibleLabel = computed(() => props.labelled ? undefined : identity.value.name)
const imageSource = computed(() => props.portrait ? identity.value.portrait : identity.value.avatar)
</script>

<template>
  <span
    class="agent-avatar-image"
    :class="`agent-avatar-${size}`"
    :style="{ '--agent-color': identity.color }"
    :role="labelled ? undefined : 'img'"
    :aria-label="accessibleLabel"
    data-agent-avatar
  >
    <img
      v-if="imageSource && !failed"
      :src="imageSource"
      alt=""
      loading="lazy"
      decoding="async"
      @error="failed = true"
    >
    <span v-else aria-hidden="true">{{ identity.name[0] }}</span>
  </span>
</template>

<style scoped>
.agent-avatar-image{width:40px;height:40px;display:inline-grid;flex:0 0 auto;overflow:hidden;place-items:center;border:2px solid rgba(255,255,255,.88);border-radius:50%;color:#111827;background:color-mix(in srgb,var(--agent-color) 32%,white);box-shadow:0 8px 22px color-mix(in srgb,var(--agent-color) 22%,transparent);font:750 .72rem 'Unbounded',sans-serif}.agent-avatar-image img{width:100%;height:100%;display:block;object-fit:cover}.agent-avatar-compact{width:28px;height:28px;border-width:1px;font-size:.58rem}.agent-avatar-large{width:58px;height:58px;font-size:.86rem}
</style>
