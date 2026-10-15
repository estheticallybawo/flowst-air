<script setup lang="ts">
import { inject } from 'vue'
import { FLOWST_AGENTS, type FlowstAgentId } from '~/shared/agents'
import { normalizeAgentPresentation, type AgentPresentation } from '~/shared/agentPresentation'
import { getAgentAppearanceAssets, skinToneFilter, hairColorFilter, eyeColorFilter } from '~/shared/agentAppearanceAssets'
import { AGENT_PRESENTATION_KEY } from '~/composables/useAgentPresentation'

const props = withDefaults(defineProps<{
  agent: FlowstAgentId | 'MISU'
  presentation?: AgentPresentation
  avatar?: boolean
  fit?: 'contain' | 'cover'
  alt?: string
}>(), { avatar: false, fit: 'contain' })
const provided = inject(AGENT_PRESENTATION_KEY, undefined)
const account = provided ? undefined : useAgentPresentation()
const failed = ref(false)
const id = computed(() => props.agent === 'MISU' ? 'MIRO' : props.agent)
const identity = computed(() => FLOWST_AGENTS[id.value])
const customizable = computed(() => id.value === 'MIRO' || id.value === 'AMIRA' || id.value === 'KAI')
const appearance = computed(() => {
  const presentation = normalizeAgentPresentation(props.presentation || provided?.value || account?.presentation.value)
  return presentation.agents[id.value as keyof AgentPresentation['agents']]
})
const assets = computed(() => customizable.value ? getAgentAppearanceAssets(id.value as 'MIRO' | 'AMIRA' | 'KAI') : undefined)
const eyeColor = computed(() => appearance.value && 'eyeColor' in appearance.value ? appearance.value.eyeColor : 'original')
const customized = computed(() => customizable.value && (appearance.value.skinTone !== 'original' || appearance.value.hairColor !== 'original' || eyeColor.value !== 'original'))
const framing = computed(() => props.avatar && (customized.value || identity.value.avatar === identity.value.portrait) ? {
  transform: id.value === 'AMIRA' ? 'scale(2.2)' : id.value === 'MIRO' ? 'scale(2.1)' : 'scale(1.6)',
  transformOrigin: id.value === 'AMIRA' ? '50% 15%' : id.value === 'MIRO' ? '50% 9%' : '50% 0%',
  '--portrait-position': id.value === 'AMIRA' ? 'center' : '50% 0%',
} : {})
const imageSource = computed(() => customized.value ? assets.value?.portrait : props.avatar ? identity.value.avatar : identity.value.portrait)
const skinStyle = computed(() => ({
  maskImage: `url("${assets.value?.skinMask}")`, WebkitMaskImage: `url("${assets.value?.skinMask}")`,
  filter: skinToneFilter(id.value as 'MIRO' | 'AMIRA' | 'KAI', appearance.value.skinTone),
}))
const hairStyle = computed(() => ({
  maskImage: `url("${assets.value?.hairMask}")`, WebkitMaskImage: `url("${assets.value?.hairMask}")`,
  filter: hairColorFilter(id.value as 'MIRO' | 'AMIRA' | 'KAI', appearance.value.hairColor),
}))
const eyeStyle = computed(() => ({
  maskImage: `url("${assets.value?.eyeMask}")`, WebkitMaskImage: `url("${assets.value?.eyeMask}")`,
  filter: eyeColorFilter(eyeColor.value),
}))
watch(imageSource, () => { failed.value = false })
</script>

<template>
  <span class="agent-portrait" :style="{ '--portrait-fit': fit }" :data-agent="id">
    <template v-if="imageSource && !failed">
      <span class="agent-portrait__frame" :style="framing">
      <img class="agent-portrait__base" :src="imageSource" :alt="alt ?? identity.name" decoding="async" @error="failed = true" />
      <img v-if="customized && appearance.skinTone !== 'original'" class="agent-portrait__layer" :src="imageSource" alt="" aria-hidden="true" :style="skinStyle" decoding="async" />
      <img v-if="customized && appearance.hairColor !== 'original'" class="agent-portrait__layer" :src="imageSource" alt="" aria-hidden="true" :style="hairStyle" decoding="async" />
      <img v-if="customized && eyeColor !== 'original' && assets?.eyeMask" class="agent-portrait__layer agent-portrait__eyes" :src="imageSource" alt="" aria-hidden="true" :style="eyeStyle" decoding="async" />
      </span>
    </template>
    <span v-else class="agent-portrait__fallback" :role="alt === '' ? undefined : 'img'" :aria-label="alt === '' ? undefined : alt ?? identity.name">{{ identity.name[0] }}</span>
  </span>
</template>

<style scoped>
.agent-portrait { position: relative; display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow:hidden; }
.agent-portrait__frame{position:relative;display:block;width:100%;height:100%}
.agent-portrait img { display: block; width: 100%; height: 100%; object-fit: var(--portrait-fit); object-position: var(--portrait-position, center); }
.agent-portrait__layer { position: absolute; inset: 0; pointer-events: none; mask-repeat: no-repeat; mask-position: var(--portrait-position, center); mask-size: var(--portrait-fit); -webkit-mask-repeat: no-repeat; -webkit-mask-position: var(--portrait-position, center); -webkit-mask-size: var(--portrait-fit); }
.agent-portrait__fallback { display: grid; width: 100%; height: 100%; place-items: center; }
</style>
