<script setup lang="ts">
import type { SourceDraft } from '~/shared/studyMaterial'
import { learnerStudyError } from '~/shared/studyPresentation'
const emit = defineEmits<{ ready: [draft: SourceDraft | null] }>()
const auth = useAuth()
const route = useRoute()
const router = useRouter()
const url = ref('')
const transcript = ref('')
const format = ref<'txt' | 'srt' | 'vtt'>('txt')
const supplied = ref(false)
const draft = ref<SourceDraft | null>(null)
const selected = ref<string[]>([])
const busy = ref(false)
const error = ref('')
const filter = ref('')
const capabilities = ref({ fixtures: false })
const candidates = computed(() => (draft.value?.candidates || []).filter(item => item.path.toLowerCase().includes(filter.value.toLowerCase())))
let timer: ReturnType<typeof setTimeout> | undefined
let disposed = false
async function publish(value: SourceDraft | null) {
  if (disposed) return
  // Complete draft-link navigation before showing ready content that can be reloaded.
  if (import.meta.client && route.path === '/airs/new' && route.query.source !== value?.id) {
    try { await router.replace({ query: { ...route.query, source: value?.id } }) }
    catch { error.value = 'The source draft exists, but this page could not save its link. Keep this page open or inspect again after reloading.' }
  }
  if (disposed) return
  draft.value = value
  emit('ready', value?.status === 'READY' ? value : null)
  if (value?.status === 'PROCESSING') schedule()
}
function schedule() {
  clearTimeout(timer)
  if (!disposed) timer = setTimeout(() => { void refresh() }, 2500)
}
async function refresh() {
  if (!draft.value || disposed) return
  try { await publish(await auth.authorizedFetch<SourceDraft>(`/api/study/sources/${draft.value.id}`)) }
  catch (cause) { error.value = learnerStudyError(cause, 'Source status could not be checked. Try checking again.'); clearTimeout(timer) }
}
async function inspect(fixture?: 'GITHUB' | 'WEB' | 'VIDEO') {
  if (busy.value) return
  busy.value = true; error.value = ''; emit('ready', null)
  try {
    const value = await auth.authorizedFetch<SourceDraft>('/api/study/sources/inspect', { method: 'POST', body: { url: url.value.trim(),
      ...(supplied.value ? { transcript: transcript.value, format: format.value } : {}), ...(fixture ? { fixture } : {}) } })
    selected.value = []; await publish(value)
  } catch (cause) { error.value = learnerStudyError(cause, 'This source could not be read. Try another link or supply a transcript.') }
  finally { busy.value = false }
}
async function prepare() {
  if (!draft.value || busy.value) return
  busy.value = true; error.value = ''
  try { await publish(await auth.authorizedFetch<SourceDraft>(`/api/study/sources/${draft.value.id}/prepare`, { method: 'POST', body: draft.value.kind === 'GITHUB' ? { paths: selected.value } : { confirmTranscription: true } })) }
  catch (cause) { error.value = learnerStudyError(cause, 'This source could not be prepared. Check its status or try again.') }
  finally { busy.value = false }
}
async function cancel() {
  if (!draft.value || busy.value) return
  busy.value = true; error.value = ''
  try { await auth.authorizedFetch(`/api/study/sources/${draft.value.id}`, { method: 'DELETE' }); clearTimeout(timer); await publish(null) }
  catch (cause) { error.value = learnerStudyError(cause, 'The source could not be cancelled. Check its status before trying again.') }
  finally { busy.value = false }
}
async function readTranscript(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!/\.(txt|srt|vtt)$/i.test(file.name) || file.size > 400_000) { error.value = 'Choose a TXT, SRT, or VTT file smaller than 400 KB.'; return }
  const value = await file.text()
  if (value.length > 100_000) { error.value = 'Choose a transcript with at most 100,000 characters.'; return }
  transcript.value = value; format.value = file.name.split('.').pop()!.toLowerCase() as typeof format.value; error.value = ''
}
onMounted(async () => {
  if (typeof route.query.source === 'string') {
    try { await publish(await auth.authorizedFetch<SourceDraft>(`/api/study/sources/${encodeURIComponent(route.query.source)}`)) }
    catch (cause) { error.value = learnerStudyError(cause, 'This draft could not be restored. Inspect the source again.') }
  }
  try { capabilities.value = await auth.authorizedFetch('/api/study/sources/capabilities') } catch { /* Live controls do not depend on fixture discovery. */ }
})
onBeforeUnmount(() => { disposed = true; clearTimeout(timer) })
</script>

<template>
  <section class="source-picker" aria-label="Bring a source link">
    <template v-if="!draft">
      <label class="source-field">Public source link
        <input v-model="url" type="url" placeholder="https://…" :disabled="busy" autocomplete="off" />
      </label>
      <p class="source-help">One GitHub repository, readable web page, or YouTube/TikTok lesson up to 30 minutes. We check what can be read before creating a plan.</p>
      <label class="source-check"><input v-model="supplied" type="checkbox" :disabled="busy" /> I have transcript text to supply</label>
      <div v-if="supplied" class="source-transcript">
        <label class="source-field">Transcript file (optional)<input type="file" accept=".txt,.srt,.vtt" :disabled="busy" @change="readTranscript" /></label>
        <label class="source-field">Transcript text<textarea v-model="transcript" rows="7" maxlength="100000" :disabled="busy" /></label>
        <label class="source-field">Text format<select v-model="format"><option value="txt">Plain text</option><option value="srt">SRT subtitles</option><option value="vtt">WebVTT subtitles</option></select></label>
        <p class="source-help">Supply material you own or have permission to use. We will label it as your supplied transcript.</p>
      </div>
      <button class="air-button air-button-primary" :disabled="busy || !url.trim() || (supplied && !transcript.trim())" @click="inspect()">{{ busy ? 'Inspecting source…' : 'Inspect source' }}</button>
      <div v-if="capabilities.fixtures" class="source-fixtures">
        <strong>Local demonstration fixtures</strong><p>No external source or paid provider is contacted.</p>
        <button v-for="kind in (['GITHUB', 'WEB', 'VIDEO'] as const)" :key="kind" :disabled="busy" @click="inspect(kind)">Try {{ kind.toLowerCase() }} fixture</button>
      </div>
    </template>
    <template v-else>
      <header><h3>{{ draft.title }}</h3><a v-if="!draft.fixture" :href="draft.url" target="_blank" rel="noopener noreferrer">Open original source</a></header>
      <p v-if="draft.fixture" class="source-notice">Demonstration fixture — no external source was imported.</p>
      <p v-if="draft.message" role="status">{{ draft.message }}</p>
      <ul v-if="draft.omissions.length" class="source-help"><li v-for="omission in draft.omissions" :key="omission">{{ omission }}</li></ul>
      <template v-if="draft.status === 'SELECT'">
        <p>Select up to 12 files. Commit: <code>{{ draft.repository?.commit }}</code></p>
        <label class="source-field">Filter files<input v-model="filter" type="search" /></label>
        <fieldset class="source-files"><legend>Files to study ({{ selected.length }}/12)</legend>
          <label v-for="candidate in candidates" :key="candidate.path"><input v-model="selected" type="checkbox" :value="candidate.path" :disabled="busy || (selected.length >= 12 && !selected.includes(candidate.path))" /><span>{{ candidate.path }}</span><small>{{ Math.ceil(candidate.size / 1024) }} KiB</small></label>
        </fieldset>
        <button :disabled="busy || !selected.length" class="air-button air-button-primary" @click="prepare">{{ busy ? 'Reading selected files…' : 'Read selected files' }}</button>
      </template>
      <template v-else-if="draft.status === 'VIDEO_READY'">
        <p>Video duration: {{ Math.ceil((draft.video?.durationSeconds || 0) / 60) }} minutes. Creating a transcript uses your source allowance, separate from speaking practice.</p>
        <p class="source-help">Continuing sends this public link to ElevenLabs for speech transcription. Use material you own or have permission to study.</p>
        <button :disabled="busy" class="air-button air-button-primary" @click="prepare">{{ busy ? 'Submitting…' : 'Create transcript' }}</button>
      </template>
      <template v-else-if="draft.status === 'PROCESSING'">
        <p role="status">{{ draft.kind === 'VIDEO' ? 'Waiting for the speech transcript. You can leave this screen and check again before the draft expires.' : 'Reading selected source files…' }}</p>
        <button :disabled="busy" @click="refresh">Check status</button>
        <p class="source-help">Cancelling removes this draft. Provider processing already started may still finish.</p>
      </template>
      <template v-else-if="draft.status === 'READY' && draft.extraction">
        <p class="source-ready" role="status">Source ready for your review · {{ draft.extraction.sections.length }} passages</p>
        <p v-if="draft.extraction.provenance?.transcriptOrigin">{{ draft.fixture ? 'Demonstration speech transcript' : draft.extraction.provenance.transcriptOrigin === 'GENERATED' ? 'AI-generated transcript of the video’s speech' : 'Learner-supplied transcript — not verified against the video' }}</p>
        <p v-if="draft.extraction.provenance?.language">Transcript language: {{ draft.extraction.provenance.language }}</p>
        <details open class="source-preview"><summary>Review included text</summary>
          <article v-for="section in draft.extraction.sections" :key="section.id"><h4><a v-if="section.location?.url" :href="section.location.url" target="_blank" rel="noopener noreferrer">{{ section.label }}</a><template v-else>{{ section.label }}</template></h4><p>{{ section.text }}</p></article>
        </details>
        <p class="source-help">Creating your session plan confirms that you want to study this snapshot. The plan will need your approval before practice.</p>
      </template>
      <p v-if="['UNAVAILABLE', 'FAILED'].includes(draft.status)">You can cancel this draft and supply a transcript or choose another source.</p>
      <button :disabled="busy" class="source-cancel" @click="cancel">Cancel source / choose another</button>
    </template>
    <p v-if="error" role="alert" class="air-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.source-picker{display:grid;gap:1rem;min-width:0;width:100%}.source-field{display:grid;gap:.45rem;font-weight:600}.source-field input,.source-field textarea,.source-field select{width:100%;box-sizing:border-box;border:1px solid #cfc6bb;border-radius:.7rem;padding:.75rem;background:#fffdf9;color:#292522;font:inherit}.source-check{display:flex;gap:.6rem;align-items:center}.source-help{color:#615a53;font-size:.9rem;line-height:1.6}.source-files{max-height:20rem;overflow:auto;border:1px solid #d6cdc2;border-radius:.7rem}.source-files label{display:flex;gap:.65rem;padding:.6rem;align-items:start}.source-files span{overflow-wrap:anywhere;flex:1}.source-files small{white-space:nowrap}.source-preview{max-height:24rem;overflow:auto;border:1px solid #d6cdc2;padding:1rem;border-radius:.7rem}.source-preview article{border-top:1px solid #e3dbd0;padding:.5rem 0}.source-preview p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}.source-preview h4{font-size:.9rem}.source-picker code{overflow-wrap:anywhere}.source-ready{font-weight:600;color:#365141}.source-cancel{justify-self:start;text-decoration:underline;padding:.5rem 0}.source-transcript{display:grid;gap:1rem}.source-fixtures,.source-notice{padding:1rem;background:#eee9df;border-radius:.6rem}.source-fixtures button{margin:.4rem;padding:.5rem;border:1px solid #a79a88;border-radius:.4rem}.source-picker a{color:#3c5c49;overflow-wrap:anywhere}.source-picker button:focus-visible,.source-picker summary:focus-visible{outline:3px solid #677f56;outline-offset:3px}.source-picker button:disabled{opacity:.55;cursor:default}
</style>
