import { computed, onMounted, watch, type ComputedRef, type InjectionKey } from 'vue'
import { DEFAULT_AGENT_PRESENTATION, normalizeAgentPresentation, type AgentPresentation } from '~/shared/agentPresentation'

export const AGENT_PRESENTATION_KEY: InjectionKey<ComputedRef<AgentPresentation>> = Symbol('airs-session-presentation')

interface PresentationState {
  ownerId: string
  presentation: AgentPresentation
  revision: string
  savedAt?: string
  loaded: boolean
  loading: boolean
  saving: boolean
  error: string
  conflicted: boolean
  epoch: number
}
interface PresentationResponse { presentation: AgentPresentation; revision: string; savedAt?: string }
const defaults = () => normalizeAgentPresentation(DEFAULT_AGENT_PRESENTATION)
const initialState = (ownerId = '', epoch = 0): PresentationState => ({
  ownerId, presentation: defaults(), revision: '', loaded: false, loading: false,
  saving: false, error: '', conflicted: false, epoch,
})
const statusCode = (cause: any) => Number(cause?.statusCode || cause?.status || cause?.response?.status || 0)

/** Account preferences only. Session portraits use the separately provided snapshot. */
export function useAgentPresentation() {
  const auth = useAuth()
  const state = useState<PresentationState>('airs-agent-presentation', () => initialState())
  const ownerId = computed(() => auth.status.value === 'AUTHENTICATED' ? auth.me.value?.profile.userId || '' : '')
  let mounted = false

  function checkOwner() {
    if (state.value.ownerId !== ownerId.value)
      state.value = initialState(ownerId.value, state.value.epoch + 1)
  }
  function apply(result: PresentationResponse) {
    state.value.presentation = normalizeAgentPresentation(result.presentation)
    state.value.revision = result.revision || ''
    state.value.savedAt = result.savedAt
    state.value.loaded = true
    state.value.conflicted = false
  }
  async function refresh(force = false): Promise<boolean> {
    checkOwner()
    if (!ownerId.value || state.value.loading || state.value.saving) return false
    if (state.value.loaded && !force) return true
    const owner = ownerId.value, epoch = ++state.value.epoch
    state.value.loading = true
    state.value.error = ''
    try {
      const result = await auth.authorizedFetch<PresentationResponse>('/api/study/presentation')
      if (ownerId.value !== owner || state.value.ownerId !== owner || state.value.epoch !== epoch) return false
      apply(result)
      return true
    } catch {
      if (ownerId.value === owner && state.value.epoch === epoch)
        state.value.error = 'Your team choices could not be loaded. Try again, or continue with the current team.'
      return false
    } finally {
      if (ownerId.value === owner && state.value.epoch === epoch) state.value.loading = false
    }
  }
  async function save(presentation: AgentPresentation): Promise<boolean> {
    checkOwner()
    if (!ownerId.value || !state.value.loaded || state.value.loading || state.value.saving || state.value.conflicted) return false
    const owner = ownerId.value, epoch = ++state.value.epoch
    state.value.saving = true
    state.value.error = ''
    try {
      const result = await auth.authorizedFetch<PresentationResponse>('/api/study/presentation', {
        method: 'PUT', body: { presentation: normalizeAgentPresentation(presentation), revision: state.value.revision },
      })
      if (ownerId.value !== owner || state.value.ownerId !== owner || state.value.epoch !== epoch) return false
      apply(result)
      return true
    } catch (cause) {
      if (ownerId.value === owner && state.value.epoch === epoch) {
        state.value.conflicted = statusCode(cause) === 409
        state.value.error = state.value.conflicted
          ? 'Your team changed in another window. Reload the saved choices before saving again.'
          : 'Your team choices were not confirmed saved. Reload to check, or continue with the last confirmed team.'
      }
      return false
    } finally {
      if (ownerId.value === owner && state.value.epoch === epoch) state.value.saving = false
    }
  }
  function setAminaVoice(voiceId: string | null) {
    const presentation = normalizeAgentPresentation(state.value.presentation)
    presentation.agents.AMIRA.voiceId = voiceId
    return save(presentation)
  }
  watch(ownerId, () => {
    checkOwner()
    if (mounted && ownerId.value) void refresh()
  }, { immediate: true, flush: 'sync' })
  onMounted(() => { mounted = true; if (ownerId.value) void refresh() })
  return {
    presentation: computed(() => state.value.presentation), revision: computed(() => state.value.revision),
    savedAt: computed(() => state.value.savedAt), loaded: computed(() => state.value.loaded),
    loading: computed(() => state.value.loading), saving: computed(() => state.value.saving),
    error: computed(() => state.value.error), conflicted: computed(() => state.value.conflicted),
    ownerId, refresh, save, setAminaVoice,
  }
}
