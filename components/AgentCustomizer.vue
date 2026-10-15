<script setup lang="ts">
import { Check, Play, RotateCcw, Square } from 'lucide-vue-next'
import { FLOWST_AGENTS } from '~/shared/agents'
import { getAgentSkinTones, AGENT_HAIR_COLORS, AGENT_EYE_COLORS, DEFAULT_AGENT_PRESENTATION, normalizeAgentPresentation, type CustomizableAgentId } from '~/shared/agentPresentation'
import { AMINA_VOICES, AMINA_VOICE_SAMPLE_TEXT } from '~/shared/aminaVoices'
import { getAminaVoicePreview } from '~/shared/aminaVoiceAssets'

const props = withDefaults(defineProps<{ settings?: boolean }>(), { settings: false })
const emit = defineEmits<{ continue: [] }>()
const team = useAgentPresentation()
const selected = ref<CustomizableAgentId>('AMIRA')
const draft = ref(normalizeAgentPresentation(team.presentation.value))
const heading = ref<HTMLElement | null>(null)
const notice = ref('')
const previewState = ref<'idle' | 'loading' | 'playing'>('idle')
const previewError = ref('')
let audio: HTMLAudioElement | undefined, playbackRequest = 0
const agents: CustomizableAgentId[] = ['MIRO', 'AMIRA', 'KAI']
const voices = AMINA_VOICES.filter(voice => voice.available)
const identity = computed(() => FLOWST_AGENTS[selected.value])
const appearance = computed(() => draft.value.agents[selected.value])
const skinTones = computed(() => getAgentSkinTones(selected.value))
const eyeAppearance = computed(() => selected.value === 'AMIRA' ? undefined : draft.value.agents[selected.value])
const busy = computed(() => team.loading.value || team.saving.value)
const editable = computed(() => team.loaded.value && !busy.value)
const voiceUrl = computed(() => draft.value.agents.AMIRA.voiceId ? getAminaVoicePreview(draft.value.agents.AMIRA.voiceId) : undefined)
const selectedVoice = computed(() => AMINA_VOICES.find(voice => voice.id === draft.value.agents.AMIRA.voiceId))
const changed = computed(() => JSON.stringify(draft.value) !== JSON.stringify(team.presentation.value))

function stopPreview() {
  playbackRequest++
  if (audio) {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    audio = undefined
  }
  previewState.value = 'idle'
}
async function listen() {
  if (previewState.value !== 'idle') { stopPreview(); return }
  if (!voiceUrl.value) return
  stopPreview()
  const request = playbackRequest
  previewError.value = ''
  previewState.value = 'loading'
  const sample = new Audio(voiceUrl.value)
  audio = sample
  sample.onplaying = () => { if (request === playbackRequest) previewState.value = 'playing' }
  sample.onended = () => { if (request === playbackRequest) stopPreview() }
  sample.onerror = () => {
    if (request !== playbackRequest) return
    stopPreview()
    previewError.value = 'This sample could not play. Try again.'
  }
  try { await sample.play() }
  catch {
    if (request !== playbackRequest) return
    stopPreview()
    previewError.value = 'This sample could not play. Try again.'
  }
}
function resetAgent() {
  stopPreview()
  if (selected.value === 'AMIRA') draft.value.agents.AMIRA = { ...DEFAULT_AGENT_PRESENTATION.agents.AMIRA }
  else draft.value.agents[selected.value] = { ...DEFAULT_AGENT_PRESENTATION.agents[selected.value] }
  notice.value = `${identity.value.name} is back to the original choices. Save to keep them.`
}
async function saveChoices() {
  stopPreview()
  notice.value = ''
  if (!await team.save(draft.value)) return
  notice.value = 'Your team choices are saved for new sessions.'
  if (!props.settings) emit('continue')
}
async function keepCurrent() {
  stopPreview()
  if (!team.loaded.value || team.error.value) { emit('continue'); return }
  draft.value = normalizeAgentPresentation(team.presentation.value)
  if (team.revision.value || await team.save(draft.value)) emit('continue')
}
async function reload() {
  stopPreview()
  notice.value = ''
  if (await team.refresh(true)) draft.value = normalizeAgentPresentation(team.presentation.value)
}
function handleVisibility() { if (document.hidden) stopPreview() }
watch([team.revision, team.loaded, team.ownerId], () => {
  draft.value = normalizeAgentPresentation(team.presentation.value)
  notice.value = ''
  stopPreview()
})
watch([selected, () => draft.value.agents.AMIRA.voiceId], () => { stopPreview(); previewError.value = ''; notice.value = '' })
onMounted(() => { heading.value?.focus({ preventScroll: true }); document.addEventListener('visibilitychange', handleVisibility) })
onBeforeUnmount(() => { stopPreview(); document.removeEventListener('visibilitychange', handleVisibility) })
</script>

<template>
  <section class="team-customizer" aria-labelledby="team-customizer-title" :aria-busy="busy">
    <header class="team-customizer__header">
      <p class="team-customizer__eyebrow">{{ settings ? 'Your study companions' : 'Before you begin · optional' }}</p>
      <component :is="settings ? 'h2' : 'h1'" id="team-customizer-title" ref="heading" tabindex="-1">Make your team feel familiar.</component>
      <p>Choose skin tone and hair color, eye color for Misu and Kai, and Amina’s voice. Their faces and roles stay the same.</p>
    </header>
    <div v-if="team.loading.value" class="team-customizer__loading" role="status">Loading your team choices…</div>
    <div class="team-customizer__body">
      <div class="team-customizer__agents" role="group" aria-label="Choose an agent to customize">
        <button v-for="agent in agents" :key="agent" type="button" :aria-pressed="selected === agent" :aria-label="`Customize ${FLOWST_AGENTS[agent].name}`" @click="selected = agent">
          <span class="team-customizer__thumbnail"><AgentPortrait :agent="agent" :presentation="draft" avatar fit="cover" alt="" /></span>
          <span>{{ FLOWST_AGENTS[agent].name }}</span>
          <Check v-if="selected === agent" :size="15" aria-hidden="true" />
        </button>
      </div>
      <div class="team-customizer__editor">
        <figure class="team-customizer__portrait" :style="{ '--companion-accent': identity.color }">
          <div><AgentPortrait :agent="selected" :presentation="draft" :alt="`${identity.name} appearance preview`" /></div>
          <figcaption><strong>{{ identity.name }}</strong><span>{{ identity.role }}</span></figcaption>
        </figure>
        <div class="team-customizer__choices">
          <fieldset :disabled="!editable">
            <legend>Skin tone</legend>
            <div class="team-customizer__swatches">
              <label v-for="tone in skinTones" :key="tone.id" :class="{ 'is-selected': appearance.skinTone === tone.id }">
                <input v-model="appearance.skinTone" type="radio" :name="`${selected}-skin-tone`" :value="tone.id" :aria-label="`${tone.label} skin tone`" />
                <span class="team-customizer__swatch" :style="{ backgroundColor: tone.color }"><Check v-if="appearance.skinTone === tone.id" :size="16" aria-hidden="true" /></span>
                <span>{{ tone.label }}</span>
              </label>
            </div>
          </fieldset>
          <fieldset :disabled="!editable">
            <legend>Hair color</legend>
            <div class="team-customizer__swatches">
              <label v-for="color in AGENT_HAIR_COLORS" :key="color.id" :class="{ 'is-selected': appearance.hairColor === color.id }">
                <input v-model="appearance.hairColor" type="radio" :name="`${selected}-hair-color`" :value="color.id" :aria-label="`${color.label} hair color`" />
                <span class="team-customizer__swatch" :style="{ backgroundColor: color.color }"><Check v-if="appearance.hairColor === color.id" :size="16" aria-hidden="true" /></span>
                <span>{{ color.label }}</span>
              </label>
            </div>
          </fieldset>
          <fieldset v-if="eyeAppearance" :disabled="!editable">
            <legend>Eye color</legend>
            <div class="team-customizer__swatches">
              <label v-for="color in AGENT_EYE_COLORS" :key="color.id" :class="{ 'is-selected': eyeAppearance.eyeColor === color.id }">
                <input v-model="eyeAppearance.eyeColor" type="radio" :name="`${selected}-eye-color`" :value="color.id" :aria-label="`${color.label} eye color`" />
                <span class="team-customizer__swatch" :style="{ backgroundColor: color.color }"><Check v-if="eyeAppearance.eyeColor === color.id" :size="16" aria-hidden="true" /></span>
                <span>{{ color.label }}</span>
              </label>
            </div>
          </fieldset>
          <div v-if="selected === 'AMIRA'" class="team-customizer__voice">
            <label for="amina-voice-choice">Amina’s voice</label>
            <div class="team-customizer__voice-control">
              <select id="amina-voice-choice" v-model="draft.agents.AMIRA.voiceId" :disabled="!editable">
                <option :value="null">Original Amina voice</option>
                <option v-for="voice in voices" :key="voice.id" :value="voice.id">{{ voice.name }}</option>
              </select>
              <button type="button" class="team-customizer__listen" :disabled="!voiceUrl || busy" @click="listen">
                <Play v-if="previewState === 'idle'" :size="16" aria-hidden="true" /><Square v-else :size="15" aria-hidden="true" />
                {{ previewState === 'idle' ? 'Listen' : 'Stop sample' }}
              </button>
            </div>
            <p>{{ selectedVoice?.description || 'The original voice configured for Amina.' }}</p>
            <p v-if="!voiceUrl" class="team-customizer__sample-note">Choose a voice to hear its sample.</p>
            <details v-else class="team-customizer__transcript"><summary>Sample transcript</summary><p>{{ AMINA_VOICE_SAMPLE_TEXT }}</p></details>
            <p v-if="voiceUrl && previewState !== 'idle'" role="status">{{ previewState === 'loading' ? 'Loading voice sample…' : 'Playing Amina’s voice sample. Microphone off.' }}</p>
            <p v-if="previewError" role="alert">{{ previewError }}</p>
          </div>
          <button class="team-customizer__reset" type="button" :disabled="!editable" @click="resetAgent"><RotateCcw :size="14" aria-hidden="true" />Reset {{ identity.name }}</button>
        </div>
      </div>
    </div>
    <footer class="team-customizer__footer">
      <p>Save these choices for new sessions. Current sessions keep their original choices.</p>
      <p v-if="team.error.value" class="team-customizer__error" role="alert">{{ team.error.value }} <button type="button" :disabled="busy" @click="reload">Reload saved choices</button></p>
      <p v-if="notice" class="team-customizer__notice" role="status">{{ notice }}</p>
      <div class="team-customizer__actions">
        <button class="team-customizer__primary" type="button" :disabled="!editable || team.conflicted.value || (settings && !changed)" @click="saveChoices">{{ team.saving.value ? 'Saving team…' : settings ? 'Save team choices' : 'Continue with these choices' }}</button>
        <button v-if="!settings" class="team-customizer__secondary" type="button" :disabled="busy" @click="keepCurrent">{{ team.error.value ? 'Continue with current team' : team.revision.value ? 'Keep current team' : 'Keep defaults' }}</button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.team-customizer { display:flex; flex:1; flex-direction:column; min-height:0; width:100%; box-sizing:border-box; padding:clamp(18px,2.4vw,28px); border:1px solid #d4e4ed; border-radius:18px; background:#fff; color:#163348; font-family:'Albert Sans',sans-serif; }
.team-customizer__header { flex:none; }
.team-customizer__eyebrow { margin:0 0 7px!important; color:#577386; font-size:.7rem!important; font-weight:650; letter-spacing:.08em; text-transform:uppercase; }
.team-customizer__header h1,.team-customizer__header h2 { margin:0; font-size:clamp(1.25rem,2.4vw,1.65rem); font-weight:650; line-height:1.25; letter-spacing:-.025em; }
.team-customizer p { margin:9px 0 0; color:#526b7b; font-size:.85rem; line-height:1.5; }
.team-customizer__body { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:4px 3px; margin-top:17px; }
.team-customizer__agents { display:flex; gap:8px; margin-bottom:18px; }
.team-customizer button { display:inline-flex; justify-content:center; align-items:center; gap:8px; min-height:44px; padding:9px 14px; border:1px solid #c8dae4; border-radius:9px; background:#fff; color:#244c65; font:inherit; font-size:.85rem; cursor:pointer; }
.team-customizer__agents button { flex:1; max-width:180px; justify-content:flex-start; font-weight:600; }
.team-customizer__agents button[aria-pressed=true] { border-color:#307b9f; background:#edf6fa; color:#165677; }
.team-customizer__agents button>svg { margin-left:auto; }
.team-customizer__thumbnail { width:30px; height:30px; flex:none; overflow:hidden; border-radius:50%; background:#f3f7f9; }
.team-customizer__editor { display:grid; grid-template-columns:minmax(150px,.75fr) minmax(0,1.7fr); gap:28px; }
.team-customizer__portrait { display:flex; flex-direction:column; align-items:center; justify-content:center; align-self:start; position:sticky; top:0; margin:0; border-radius:14px; padding:16px 10px; background:color-mix(in srgb,var(--companion-accent) 5%,#f5f9fb); }
.team-customizer__portrait>div { width:100%; height:clamp(180px,27vh,245px); }
.team-customizer__portrait figcaption { display:flex; flex-direction:column; align-items:center; gap:5px; margin-top:10px; }
.team-customizer__portrait strong { font-size:1rem; font-weight:650; }
.team-customizer__portrait figcaption span { color:#5f7584; font-size:.75rem; }
.team-customizer__choices { min-width:0; }
.team-customizer fieldset { min-width:0; margin:0 0 16px; padding:0; border:0; }
.team-customizer legend,.team-customizer__voice>label { display:block; padding:0; margin-bottom:9px; font-size:.85rem; font-weight:650; }
.team-customizer__swatches { display:flex; flex-wrap:wrap; gap:5px; }
.team-customizer__swatches label { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:55px; min-height:62px; padding:4px 3px; box-sizing:border-box; gap:5px; border:1px solid transparent; border-radius:8px; cursor:pointer; color:#456172; font-size:.65rem; }
.team-customizer__swatches label.is-selected { border-color:#a9cbdc; background:#f0f7fa; color:#1b5979; }
.team-customizer__swatches input { position:absolute; width:1px; height:1px; opacity:0; }
.team-customizer__swatch { width:28px; height:28px; display:grid; place-items:center; border:1px solid rgb(28 47 62 / 13%); border-radius:50%; }
.team-customizer__swatch svg { padding:2px; border-radius:50%; color:#163348; background:#fff; box-shadow:0 1px 4px #0002; }
.team-customizer__swatches label:has(input:focus-visible) { outline:3px solid #0284c7; outline-offset:2px; }
.team-customizer fieldset:disabled label { opacity:.55; cursor:default; }
.team-customizer__voice { margin-top:3px; }
.team-customizer__voice-control { display:flex; align-items:center; gap:8px; }
.team-customizer select { min-width:0; width:100%; flex:1; min-height:44px; box-sizing:border-box; padding:10px; border:1px solid #c8dae4; border-radius:9px; color:#244c65; background:white; font:inherit; font-size:.85rem; }
.team-customizer__listen { flex:none; }
.team-customizer__voice p { font-size:.74rem; }
.team-customizer__sample-note { color:#6a7880!important; }
.team-customizer__transcript { margin-top:8px; color:#526b7b; font-size:.74rem; }
.team-customizer__transcript summary { display:flex; align-items:center; min-height:32px; cursor:pointer; text-decoration:underline; text-underline-offset:3px; }
.team-customizer__transcript summary:focus-visible { outline:3px solid #0284c7; outline-offset:3px; }
.team-customizer__reset { min-height:36px!important; padding:6px 0!important; margin-top:12px; border:0!important; background:transparent!important; font-size:.76rem!important; }
.team-customizer__footer { flex:none; border-top:1px solid #dce7ed; margin-top:16px; padding-top:12px; }
.team-customizer__footer>p:first-child { margin:0 0 10px; font-size:.74rem; }
.team-customizer__actions { display:flex; flex-wrap:wrap; gap:8px; }
.team-customizer button.team-customizer__primary { color:#fff; background:#14698f; border-color:#14698f; font-weight:600; }
.team-customizer__secondary { background:#f7fafc!important; }
.team-customizer__error { color:#9a3412!important; margin-bottom:12px!important; }
.team-customizer__error button { padding:5px 8px; text-decoration:underline; }
.team-customizer__notice { margin:0 0 10px!important; color:#25604d!important; }
.team-customizer__loading { padding-top:15px; font-size:.85rem; color:#526b7b; }
.team-customizer button:disabled { opacity:.5; cursor:default; }
.team-customizer button:focus-visible,.team-customizer select:focus-visible { outline:3px solid #0284c7; outline-offset:3px; }
@media(max-width:600px) { .team-customizer__editor { grid-template-columns:1fr; gap:12px; } .team-customizer__portrait { flex-direction:row; justify-content:flex-start; gap:15px; padding:5px 12px; top:51px; z-index:1; background:#f3f7fa; } .team-customizer__portrait>div { width:58px; height:70px; } .team-customizer__portrait figcaption { align-items:flex-start; margin:0; } .team-customizer__agents { gap:6px; position:sticky; top:0; z-index:2; padding:0 0 7px; margin-bottom:5px; background:white; } .team-customizer__agents button { padding:7px 9px; font-size:.8rem; } .team-customizer__agents button>svg { display:none; } .team-customizer__actions>button { flex:1; } .team-customizer__swatches { gap:2px; } .team-customizer__swatches label { min-width:44px; } }
@media(prefers-reduced-motion:no-preference) { .team-customizer__agents button { transition:background 140ms ease-out,border-color 140ms ease-out; } }
</style>
