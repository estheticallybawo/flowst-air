<script setup lang="ts">
import { AGENT_PRESENTATION_KEY } from '~/composables/useAgentPresentation'
import { skinToneFilter, hairColorFilter } from '~/shared/agentAppearanceAssets'
import { normalizeAgentPresentation } from '~/shared/agentPresentation'
import { FLOWST_AGENTS } from '~/shared/agents'

const props = withDefaults(defineProps<{
  state: 'idle' | 'listening' | 'thinking' | 'speaking'
  active?: boolean
  compact?: boolean
  dark?: boolean
  expression?: 'auto' | 'celebrate' | 'wave'
}>(), {
  active: true,
  compact: false,
  dark: false,
  expression: 'auto',
})
const atlas = '/mascots/amina-expression-atlas-v1.png'
const originalPortrait = FLOWST_AGENTS.AMIRA.portrait
const provided = inject(AGENT_PRESENTATION_KEY, undefined)
const account = provided ? undefined : useAgentPresentation()
const presentation = computed(() => normalizeAgentPresentation(provided?.value || account?.presentation.value))
const appearance = computed(() => presentation.value.agents.AMIRA)
const layers = computed(() => [
  { id: 'skin', source: '/mascots/appearance-interaction-v1/amina-skin.png', selected: appearance.value.skinTone !== 'original', filter: skinToneFilter('AMIRA', appearance.value.skinTone) },
  { id: 'hair', source: '/mascots/appearance-interaction-v1/amina-hair.png', selected: appearance.value.hairColor !== 'original', filter: hairColorFilter('AMIRA', appearance.value.hairColor) },
].filter(layer => layer.selected))
const customized = computed(() => layers.value.length > 0)
const assetSources = computed(() => [atlas, ...layers.value.map(layer => layer.source)])
const rootElement = ref<HTMLElement | null>(null)
const loadedAssets = ref<Record<string, { width: number; height: number; failed: boolean }>>({})
const maskSupported = ref(true)
const assetReady = (source: string) => {
  const image = loadedAssets.value[source]
  return Boolean(image && !image.failed && image.width === 1448 && image.height === 1086)
}
const atlasReady = computed(() => assetReady(atlas))
const artworkReady = computed(() => atlasReady.value && (!customized.value || maskSupported.value) && layers.value.every(layer => assetReady(layer.source)))
const unavailable = computed(() => (customized.value && !maskSupported.value) || assetSources.value.some(source => {
  const image = loadedAssets.value[source]
  return Boolean(image && !assetReady(source))
}))
const artworkLabel = computed(() => {
  const state = props.expression === 'auto' ? props.state : props.expression === 'wave' ? 'greeting' : 'celebration'
  const label = `Amina · ${state} illustration sample${state === 'speaking' ? ', not live lip sync' : ''}`
  return customized.value && !artworkReady.value ? `${label}. Original colors preview.` : label
})
const notice = computed(() => {
  if (!atlasReady.value) return unavailable.value ? 'Animation unavailable · original portrait preview' : 'Loading animation · original portrait preview'
  if (customized.value && !artworkReady.value) return unavailable.value ? 'Chosen colors unavailable · original colors shown' : 'Loading chosen colors · original colors preview'
  return ''
})

function layerStyle(source: string, filter: string) {
  return { maskImage: `url("${source}")`, WebkitMaskImage: `url("${source}")`, filter }
}

function recordAsset(source: string, image: HTMLImageElement) {
  loadedAssets.value = { ...loadedAssets.value, [source]: { width: image.naturalWidth, height: image.naturalHeight, failed: !image.naturalWidth || !image.naturalHeight } }
}

function markAssetReady(source: string, event: Event) {
  recordAsset(source, event.target as HTMLImageElement)
}

function markAssetUnavailable(source: string) {
  loadedAssets.value = { ...loadedAssets.value, [source]: { width: 0, height: 0, failed: true } }
}

function reconcileProbeImages() {
  rootElement.value?.querySelectorAll<HTMLImageElement>('.amina-demo-avatar__probe').forEach(image => {
    const source = image.getAttribute('src')
    if (source && assetSources.value.includes(source) && image.complete) recordAsset(source, image)
  })
}

watch(assetSources, () => { void nextTick(reconcileProbeImages) }, { flush: 'post' })
onMounted(() => {
  maskSupported.value = CSS.supports('mask-image', 'linear-gradient(#000, #000)') || CSS.supports('-webkit-mask-image', 'linear-gradient(#000, #000)')
  reconcileProbeImages()
})
</script>

<template>
  <div
    ref="rootElement"
    class="amina-demo-avatar"
    data-framing="half-body"
    :data-state="state"
    :data-active="active"
    :data-compact="compact"
    :data-dark="dark"
    :data-expression="expression"
    :data-ready="artworkReady"
    :data-customized="customized"
    :data-atlas-ready="atlasReady"
  >
    <img v-for="source in assetSources" :key="source" class="amina-demo-avatar__probe" :src="source" alt="" aria-hidden="true" @load="markAssetReady(source, $event)" @error="markAssetUnavailable(source)" />
    <div class="amina-demo-avatar__presence" aria-hidden="true" />
    <div class="amina-demo-avatar__shadow" aria-hidden="true" />
    <div class="amina-demo-avatar__character">
      <div class="amina-demo-avatar__artwork" role="img" :aria-label="artworkLabel">
        <template v-if="atlasReady">
          <span class="amina-demo-avatar__sprite" aria-hidden="true" />
          <span v-for="layer in artworkReady ? layers : []" :key="layer.id" class="amina-demo-avatar__layer" :data-layer="layer.id" :style="layerStyle(layer.source, layer.filter)" aria-hidden="true" />
        </template>
        <img v-else class="amina-demo-avatar__fallback" :src="originalPortrait" alt="" aria-hidden="true" />
      </div>
    </div>
    <div v-if="state === 'speaking' && active && !compact" class="amina-demo-avatar__waveform" aria-hidden="true">
      <span v-for="bar in 7" :key="bar" :style="{ '--amina-bar': bar }" />
    </div>
    <div v-else-if="state === 'thinking' && active && !compact" class="amina-demo-avatar__thoughts" aria-hidden="true">
      <span v-for="dot in 3" :key="dot" :style="{ '--amina-dot': dot }" />
    </div>
    <span v-if="notice" class="amina-demo-avatar__notice" role="status">{{ notice }}</span>
  </div>
</template>

<style scoped>
.amina-demo-avatar {
  --amina-frame-x: 0%;
  --amina-frame-y: 0%;
  --amina-presence-color: rgb(87 145 168 / 12%);
  --amina-indicator-color: #376d88;
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  isolation: isolate;
  overflow: hidden;
  pointer-events: none;
}

.amina-demo-avatar[data-dark="true"] {
  --amina-presence-color: rgb(151 208 229 / 12%);
  --amina-indicator-color: #c1e5f5;
}

.amina-demo-avatar__presence {
  position: absolute;
  inset: 17% 12% 6%;
  border: 1px solid var(--amina-presence-color);
  border-radius: 50%;
  opacity: .7;
  transform: scale(.97);
  transition: opacity 240ms ease, transform 240ms cubic-bezier(.645, .045, .355, 1);
}

.amina-demo-avatar[data-state="listening"] .amina-demo-avatar__presence {
  opacity: 1;
  transform: scale(1.03);
}

.amina-demo-avatar__shadow {
  position: absolute;
  right: 22%;
  bottom: 1%;
  left: 22%;
  height: 5%;
  border-radius: 50%;
  background: rgb(30 48 58 / 9%);
  filter: blur(8px);
}

.amina-demo-avatar__character {
  position: absolute;
  inset: 3% 5% 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  container-type: size;
  transform-origin: bottom center;
  animation: amina-demo-avatar-breathe 5.6s ease-in-out infinite;
}

.amina-demo-avatar__artwork {
  position: relative;
  display: block;
  width: min(100cqw, calc(100cqh * 2 / 3));
  height: min(100cqh, calc(100cqw * 1.5));
  aspect-ratio: 2 / 3;
  user-select: none;
}
.amina-demo-avatar__sprite,
.amina-demo-avatar__layer {
  position: absolute;
  inset: 0;
  display: block;
  background-image: url('/mascots/amina-expression-atlas-v1.png');
  background-repeat: no-repeat;
  background-size: 400% 200%;
  background-position: var(--amina-frame-x) var(--amina-frame-y);
  animation-play-state: inherit;
}

.amina-demo-avatar__layer {
  pointer-events: none;
  mask-repeat: no-repeat;
  mask-size: 400% 200%;
  mask-position: var(--amina-frame-x) var(--amina-frame-y);
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: 400% 200%;
  -webkit-mask-position: var(--amina-frame-x) var(--amina-frame-y);
}

.amina-demo-avatar__fallback { display: block; width: 100%; height: 100%; object-fit: contain; }
.amina-demo-avatar__probe { display: none; }
.amina-demo-avatar__notice { position: absolute; right: 8%; bottom: 7%; left: 8%; padding: 6px 9px; border: 1px solid #d5e4ee; border-radius: 6px; color: #35566b; background: #fff; font: 12px/1.4 'Albert Sans', sans-serif; text-align: center; }

.amina-demo-avatar[data-state="listening"] { --amina-frame-x: 0%; --amina-frame-y: 100%; }
.amina-demo-avatar[data-state="thinking"] { --amina-frame-x: 33.333333%; --amina-frame-y: 100%; }
.amina-demo-avatar[data-expression="celebrate"] { --amina-frame-x: 66.666667%; --amina-frame-y: 100%; }
.amina-demo-avatar[data-expression="wave"] { --amina-frame-x: 100%; --amina-frame-y: 100%; }
.amina-demo-avatar[data-state="speaking"][data-expression="auto"] .amina-demo-avatar__artwork { animation: amina-demo-mouth 780ms steps(1, end) infinite; animation-play-state: paused; }
.amina-demo-avatar[data-state="speaking"][data-expression="auto"][data-active="true"][data-atlas-ready="true"] .amina-demo-avatar__artwork { animation-play-state: running; }

@keyframes amina-demo-mouth {
  0%, 100% { --amina-frame-x: 0%; --amina-frame-y: 0%; }
  20%, 80% { --amina-frame-x: 33.333333%; --amina-frame-y: 0%; }
  40% { --amina-frame-x: 66.666667%; --amina-frame-y: 0%; }
  60% { --amina-frame-x: 100%; --amina-frame-y: 0%; }
}

.amina-demo-avatar[data-state="listening"] .amina-demo-avatar__character {
  animation: amina-demo-avatar-listen 4.8s ease-in-out infinite;
}

.amina-demo-avatar[data-state="thinking"] .amina-demo-avatar__character {
  animation: amina-demo-avatar-think 5s ease-in-out infinite;
}

.amina-demo-avatar[data-state="speaking"] .amina-demo-avatar__character {
  animation: amina-demo-avatar-speak 2.4s ease-in-out infinite;
}

.amina-demo-avatar__waveform,
.amina-demo-avatar__thoughts {
  position: absolute;
  right: 8%;
  bottom: 17%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 58px;
  height: 36px;
  color: var(--amina-indicator-color);
}

.amina-demo-avatar__waveform span {
  width: 3px;
  height: 22px;
  border-radius: 4px;
  background: currentColor;
  transform: scaleY(.3);
  animation: amina-demo-avatar-wave 920ms ease-in-out infinite;
  animation-delay: calc(var(--amina-bar) * -130ms);
}

.amina-demo-avatar__waveform span:nth-child(2n) {
  height: 15px;
  animation-duration: 760ms;
}

.amina-demo-avatar__thoughts span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: amina-demo-avatar-thought 1.4s ease-in-out infinite;
  animation-delay: calc(var(--amina-dot) * 160ms);
}

.amina-demo-avatar[data-compact="true"] .amina-demo-avatar__presence,
.amina-demo-avatar[data-compact="true"] .amina-demo-avatar__shadow {
  display: none;
}

.amina-demo-avatar[data-compact="true"] .amina-demo-avatar__character {
  inset: 1% 2% 0;
}

.amina-demo-avatar[data-active="false"] .amina-demo-avatar__character,
.amina-demo-avatar[data-atlas-ready="false"] .amina-demo-avatar__character {
  animation-play-state: paused;
}
.amina-demo-avatar[data-active="false"] .amina-demo-avatar__artwork { animation-play-state: paused; }

.amina-demo-avatar[data-active="false"] .amina-demo-avatar__presence {
  opacity: .35;
  transform: none;
}

@keyframes amina-demo-avatar-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-2px) scale(1.008); }
}

@keyframes amina-demo-avatar-listen {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  35% { transform: rotate(-.8deg) translateY(1px); }
  55% { transform: rotate(-.5deg) translateY(-1px); }
  75% { transform: rotate(.3deg) translateY(0); }
}

@keyframes amina-demo-avatar-think {
  0%, 100% { transform: rotate(0deg); }
  40%, 65% { transform: rotate(1deg) translateY(-1px); }
}

@keyframes amina-demo-avatar-speak {
  0%, 100% { transform: rotate(-.35deg) translateY(0) scale(1); }
  30% { transform: rotate(.4deg) translateY(-2px) scale(1.006); }
  65% { transform: rotate(-.2deg) translateY(-1px) scale(1.002); }
}

@keyframes amina-demo-avatar-wave {
  0%, 100% { transform: scaleY(.3); opacity: .55; }
  50% { transform: scaleY(1); opacity: 1; }
}

@keyframes amina-demo-avatar-thought {
  0%, 70%, 100% { transform: translateY(0); opacity: .4; }
  35% { transform: translateY(-3px); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .amina-demo-avatar *,
  .amina-demo-avatar *::before,
  .amina-demo-avatar *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
