<script setup lang="ts">
import { flowstReturnDestination } from '~/shared/flowstReturn'
const route = useRoute()
const entryQuery = useRequestURL().searchParams
const fromFlowst = ref(entryQuery.get('entry') === 'flowst' || String(entryQuery.get('redirect') || '').includes('entry=flowst'))
const flowstReturn = computed(() => flowstReturnDestination(useRuntimeConfig().public.flowstHomeUrl, import.meta.dev))
const returnError = ref('')
function rememberEntry() {
  const query = new URL(window.location.href).searchParams
  const entered = query.get('entry') === 'flowst' || String(query.get('redirect') || '').includes('entry=flowst')
  try {
    if (entered) sessionStorage.setItem('airs-entry', 'flowst')
    fromFlowst.value = sessionStorage.getItem('airs-entry') === 'flowst'
  } catch { fromFlowst.value = entered }
}
async function onFlowstMessage(event: MessageEvent) {
  if (!flowstReturn.value || window.parent === window || event.source !== window.parent || event.origin !== new URL(flowstReturn.value).origin) return
  if (event.data?.type === 'flowst:hello') { announceReady(); return }
  if (event.data?.type !== 'flowst:request-exit' || typeof event.data.id !== 'string') return
  let allowed = false
  try { allowed = (await useAirsMediaLifecycle().beforeExit.value?.()) ?? true } catch { allowed = false }
  window.parent.postMessage({ type: 'airs:exit-result', id: event.data.id, allowed }, event.origin)
}
function announceReady() {
  if (window.parent !== window && flowstReturn.value) window.parent.postMessage({ type: 'airs:ready' }, new URL(flowstReturn.value).origin)
}
onMounted(() => { rememberEntry(); watch(() => route.fullPath, rememberEntry); window.addEventListener('message', onFlowstMessage); announceReady() })
onBeforeUnmount(() => window.removeEventListener('message', onFlowstMessage))

async function returnToFlowst() {
  if (!flowstReturn.value) return
  try {
    if (!((await useAirsMediaLifecycle().beforeExit.value?.()) ?? true)) return
    if (window.parent !== window) window.top!.location.href = flowstReturn.value
    else window.location.assign(flowstReturn.value)
  } catch { returnError.value = 'We could not finish leaving this session. Please try again.' }
}

const standaloneAirs = ['airs', 'air', 'amira'].includes(useRuntimeConfig().public.appSurface)
const sourceFixtureMode = useRuntimeConfig().public.studySourceFixtureMode
const demoError = ref('')
async function startSourceDemo() {
  try {
    await $fetch('/api/auth/dev-session', { method: 'POST', body: { scenario: 'member' } })
    await navigateTo('/airs/new', { external: true })
  } catch { demoError.value = 'The local demo session could not start. Check that fixture mode and mock authentication are enabled.' }
}
useHead({ bodyAttrs: { class: standaloneAirs ? 'airs-surface' : '' } })
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <NuxtRouteAnnouncer />
    <aside v-if="sourceFixtureMode" class="source-fixture-banner" aria-label="Demonstration mode">
      Local demonstration: sample sources and scripted plans. Live voice needs configured providers.
      <button @click="startSourceDemo">Open local demo</button>
      <p v-if="demoError" role="alert">{{ demoError }}</p>
    </aside>
    <aside v-if="fromFlowst && flowstReturn" class="flowst-return" aria-label="Flowst workspace">
      <a :href="flowstReturn" @click.prevent="returnToFlowst">← Back to Flowst</a><span>Flowst / Airs · Bring Your Source</span>
      <p v-if="returnError" role="alert">{{ returnError }}</p>
    </aside>
    <NuxtPage />
  </div>
</template>
<style scoped>
.source-fixture-banner{padding:.8rem 1rem;background:#eee9df;color:#3f4739;font-size:.9rem;line-height:1.5}.source-fixture-banner button{margin-left:.75rem;text-decoration:underline;font-weight:600}
.flowst-return{padding:.75rem 1rem;display:flex;flex-wrap:wrap;align-items:center;gap:1rem;border-bottom:1px solid #dce3ec;font-size:.85rem}.flowst-return a{min-height:44px;display:inline-flex;align-items:center;font-weight:650;text-decoration:underline}.flowst-return span{color:#53606b}
</style>
