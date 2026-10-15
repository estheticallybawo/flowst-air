<script setup lang="ts">
import AgentPortrait from '~/components/AgentPortrait.vue'
import { AGENT_PRESENTATION_KEY } from '~/composables/useAgentPresentation'
import { skinToneFilter, hairColorFilter, eyeColorFilter } from '~/shared/agentAppearanceAssets'
import { normalizeAgentPresentation } from '~/shared/agentPresentation'
import { getCompanionMotion, getCompanionMotionAgent, COMPANION_MOTION_COLUMNS, COMPANION_MOTION_ROWS, type CompanionMotionAgentId, type CompanionMotionStateId } from '~/shared/companionMotion'
import { COMPANION_MOTION_FRAME_ATLASES } from '~/shared/companionMotionFrames.generated'

const props = withDefaults(defineProps<{
  agent: CompanionMotionAgentId
  state: CompanionMotionStateId
  active?: boolean
  thumbnail?: boolean
  durationMs?: number
  label?: string
}>(), { active: true, thumbnail: false })
const provided = inject(AGENT_PRESENTATION_KEY, undefined)
const account = provided ? undefined : useAgentPresentation()
const presentation = computed(() => normalizeAgentPresentation(provided?.value || account?.presentation.value))
const identity = computed(() => getCompanionMotionAgent(props.agent))
const motion = computed(() => getCompanionMotion(props.state))
const atlasFraming = computed(() => COMPANION_MOTION_FRAME_ATLASES[props.agent])
const frames = computed(() => atlasFraming.value.frames.slice(motion.value.row * COMPANION_MOTION_COLUMNS, (motion.value.row + 1) * COMPANION_MOTION_COLUMNS).map((frame, column) => ({
  column,
  style: {
    '--companion-frame-size': `${atlasFraming.value.width / frame.width * 100}% ${atlasFraming.value.height / frame.height * 100}%`,
    '--companion-frame-x': `${frame.x / (atlasFraming.value.width - frame.width) * 100}%`,
    '--companion-frame-y': `${frame.y / (atlasFraming.value.height - frame.height) * 100}%`,
    '--companion-frame-ratio': String(frame.width / frame.height),
    '--companion-frame-opacity': `var(--companion-frame-${column}-opacity)`,
  },
})))
const appearance = computed(() => presentation.value.agents[props.agent])
const eyeColor = computed(() => 'eyeColor' in appearance.value ? appearance.value.eyeColor : 'original')
const names = { AMIRA: 'amina', MIRO: 'misu', KAI: 'kai' } as const
const layers = computed(() => {
  const prefix = `/mascots/appearance-motion-v1/${names[props.agent]}`
  return [
    { id: 'skin', source: `${prefix}-skin.png`, selected: appearance.value.skinTone !== 'original', filter: skinToneFilter(props.agent, appearance.value.skinTone) },
    { id: 'hair', source: `${prefix}-hair.png`, selected: appearance.value.hairColor !== 'original', filter: hairColorFilter(props.agent, appearance.value.hairColor) },
    { id: 'iris', source: `${prefix}-eyes.png`, selected: props.agent !== 'AMIRA' && eyeColor.value !== 'original', filter: eyeColorFilter(eyeColor.value) },
  ].filter(layer => layer.selected)
})
const customized = computed(() => layers.value.length > 0)
const assetSources = computed(() => [identity.value.atlas, ...layers.value.map(layer => layer.source)])
const rootElement = ref<HTMLElement | null>(null)
const loadedAssets = ref<Record<string, { width: number; height: number; failed: boolean }>>({})
const maskSupported = ref(true)
const atlasDimensions = computed(() => loadedAssets.value[identity.value.atlas])
const atlasValid = computed(() => {
  const atlas = atlasDimensions.value
  return Boolean(atlas && !atlas.failed && atlas.width === atlasFraming.value.width && atlas.height === atlasFraming.value.height && atlasFraming.value.frames.length === COMPANION_MOTION_COLUMNS * COMPANION_MOTION_ROWS && atlas.width > 0 && atlas.width % COMPANION_MOTION_COLUMNS === 0 && atlas.height % COMPANION_MOTION_ROWS === 0 && atlas.width / COMPANION_MOTION_COLUMNS === atlas.height / COMPANION_MOTION_ROWS)
})
const artworkReady = computed(() => atlasValid.value && (!customized.value || maskSupported.value) && layers.value.every(layer => {
  const asset = loadedAssets.value[layer.source]
  return asset && !asset.failed && asset.width === atlasDimensions.value!.width && asset.height === atlasDimensions.value!.height
}))
const unavailable = computed(() => (customized.value && !maskSupported.value) || assetSources.value.some(source => {
  const asset = loadedAssets.value[source]
  if (!asset) return false
  if (asset.failed) return true
  if (source === identity.value.atlas) return !atlasValid.value
  return Boolean(atlasDimensions.value && (asset.width !== atlasDimensions.value.width || asset.height !== atlasDimensions.value.height))
}))
const faceLabel = computed(() => props.label || `${identity.value.name} · ${motion.value.label} illustration`)
const motionStyle = computed(() => ({
  '--companion-atlas': `url("${identity.value.atlas}")`,
  '--motion-duration': `${Number.isFinite(props.durationMs) && props.durationMs! > 0 ? props.durationMs : motion.value.durationMs}ms`,
}))

function layerStyle(source: string, filter: string) {
  return { maskImage: `url("${source}")`, WebkitMaskImage: `url("${source}")`, filter }
}

function markAssetReady(source: string, event: Event) {
  recordAsset(source, event.target as HTMLImageElement)
}

function recordAsset(source: string, image: HTMLImageElement) {
  loadedAssets.value = { ...loadedAssets.value, [source]: { width: image.naturalWidth, height: image.naturalHeight, failed: !image.naturalWidth || !image.naturalHeight } }
}

function markAssetUnavailable(source: string) {
  loadedAssets.value = { ...loadedAssets.value, [source]: { width: 0, height: 0, failed: true } }
}

function reconcileProbeImages() {
  rootElement.value?.querySelectorAll<HTMLImageElement>('.companion-motion__probe').forEach(image => {
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
  <span
    ref="rootElement"
    class="companion-motion companion-motion-avatar"
    :style="motionStyle"
    :data-agent="agent"
    :data-state="state"
    :data-active="active"
    :data-thumbnail="thumbnail"
    :data-customized="customized"
    :data-ready="artworkReady"
  >
    <img v-for="source in assetSources" :key="source" class="companion-motion__probe" :src="source" alt="" aria-hidden="true" @load="markAssetReady(source, $event)" @error="markAssetUnavailable(source)" />
    <span class="companion-motion__face" role="img" :aria-label="artworkReady ? faceLabel : `${identity.name} face portrait preview`">
      <template v-if="artworkReady">
        <span
          v-for="frame in frames"
          :key="frame.column"
          class="companion-motion__frame"
          :data-frame="frame.column"
          :style="frame.style"
          aria-hidden="true"
        >
          <span class="companion-motion__atlas companion-motion-avatar__sprite" />
          <span
            v-for="layer in layers"
            :key="layer.id"
            class="companion-motion__layer"
            :data-layer="layer.id"
            :style="layerStyle(layer.source, layer.filter)"
          />
        </span>
      </template>
      <AgentPortrait v-else :agent="agent" :presentation="presentation" avatar alt="" />
    </span>
    <span v-if="!artworkReady && !thumbnail" class="companion-motion__notice">{{ unavailable ? 'Animation unavailable · portrait preview' : 'Loading animation · portrait preview' }}</span>
  </span>
</template>

<style scoped>
.companion-motion {
  --companion-frame-0-opacity: 1;
  --companion-frame-1-opacity: 0;
  --companion-frame-2-opacity: 0;
  --companion-frame-3-opacity: 0;
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  container-type: size;
  place-items: center;
  animation: companion-frames var(--motion-duration) steps(1, end) infinite;
  animation-play-state: paused;
}

.companion-motion[data-ready="true"][data-active="true"][data-thumbnail="false"] {
  animation-play-state: running;
}

.companion-motion__probe {
  display: none;
}

.companion-motion__face {
  position: relative;
  display: grid;
  width: min(100cqw, 100cqh);
  height: min(100cqw, 100cqh);
  aspect-ratio: 1;
  container-type: size;
  place-items: center;
  animation-play-state: inherit;
}

.companion-motion__frame {
  position: relative;
  grid-area: 1 / 1;
  width: min(100cqw, calc(100cqh * var(--companion-frame-ratio)));
  height: min(100cqh, calc(100cqw / var(--companion-frame-ratio)));
  opacity: var(--companion-frame-opacity);
  animation-play-state: inherit;
}

.companion-motion__atlas,
.companion-motion__layer {
  position: absolute;
  inset: 0;
  display: block;
  background-image: var(--companion-atlas);
  background-repeat: no-repeat;
  background-size: var(--companion-frame-size);
  background-position: var(--companion-frame-x) var(--companion-frame-y);
  animation-play-state: inherit;
  user-select: none;
}

.companion-motion__layer {
  pointer-events: none;
  mask-repeat: no-repeat;
  mask-size: var(--companion-frame-size);
  mask-position: var(--companion-frame-x) var(--companion-frame-y);
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: var(--companion-frame-size);
  -webkit-mask-position: var(--companion-frame-x) var(--companion-frame-y);
}

.companion-motion__notice {
  position: absolute;
  bottom: 4px;
  left: 50%;
  max-width: calc(100% - 16px);
  padding: 4px 8px;
  border: 1px solid #d5e4ee;
  border-radius: 6px;
  color: #35566b;
  background: #fff;
  font: 12px/1.4 'Albert Sans', sans-serif;
  text-align: center;
  transform: translateX(-50%);
}

@keyframes companion-frames {
  0%, 100% { --companion-frame-0-opacity: 1; --companion-frame-1-opacity: 0; --companion-frame-2-opacity: 0; --companion-frame-3-opacity: 0; }
  25% { --companion-frame-0-opacity: 0; --companion-frame-1-opacity: 1; --companion-frame-2-opacity: 0; --companion-frame-3-opacity: 0; }
  50% { --companion-frame-0-opacity: 0; --companion-frame-1-opacity: 0; --companion-frame-2-opacity: 1; --companion-frame-3-opacity: 0; }
  75% { --companion-frame-0-opacity: 0; --companion-frame-1-opacity: 0; --companion-frame-2-opacity: 0; --companion-frame-3-opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .companion-motion[data-ready="true"][data-active="true"][data-thumbnail="false"] {
    animation-play-state: paused;
  }
}
</style>
