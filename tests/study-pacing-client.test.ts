import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useStudyPacing } from '../composables/useStudyPacing'
import type { StudyPacingState } from '../shared/studyPacing'

const fetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('ref', ref); vi.stubGlobal('computed', computed)
  vi.stubGlobal('useAuth', () => ({ authorizedFetch: fetch }))
  vi.stubGlobal('onMounted', () => {}); vi.stubGlobal('onBeforeUnmount', () => {})
  fetch.mockReset()
})
afterEach(() => vi.unstubAllGlobals())
const clock = (phase: StudyPacingState['phase'], revision: string): StudyPacingState => ({
  phase, revision, blockId: 'block', objectiveId: 'objective', remainingMs: 120000, startedAt: 1000, serverNow: 1000,
  ...(phase === 'PAUSED' ? { pausedPhase: 'PRACTICE' as const } : {}),
})
function pending() {
  let resolve!: (result: { pacing: StudyPacingState }) => void
  const promise = new Promise<{ pacing: StudyPacingState }>(done => { resolve = done })
  return { promise, resolve }
}
it('keeps the resumed clock when an older paused refresh arrives last', async () => {
  const pacing = useStudyPacing(ref('study')), old = pending()
  fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ pacing: clock('PRACTICE', 'resumed') })
  const stale = pacing.refresh()
  await pacing.refresh()
  old.resolve({ pacing: clock('PAUSED', 'old') }); await stale
  expect(pacing.current.value?.phase).toBe('PRACTICE')
  expect(pacing.state.value?.revision).toBe('resumed')
})
it('keeps a saved pause when a refresh begun before the mutation arrives last', async () => {
  const pacing = useStudyPacing(ref('study')), old = pending()
  fetch.mockResolvedValueOnce({ pacing: clock('PRACTICE', 'running') })
  await pacing.refresh()
  fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ pacing: clock('PAUSED', 'paused') })
  const stale = pacing.refresh()
  expect(await pacing.change('PAUSE')).toBe(true)
  old.resolve({ pacing: clock('PRACTICE', 'running') }); await stale
  expect(pacing.current.value?.phase).toBe('PAUSED')
  expect(pacing.state.value?.revision).toBe('paused')
})
it('rejects an old clock fetched during an in-flight pause after the pause commits', async () => {
  const pacing = useStudyPacing(ref('study')), mutation = pending(), read = pending()
  fetch.mockResolvedValueOnce({ pacing: clock('PRACTICE', 'running') })
  await pacing.refresh()
  fetch.mockReturnValueOnce(mutation.promise).mockReturnValueOnce(read.promise)
  const pause = pacing.change('PAUSE'), refresh = pacing.refresh()
  mutation.resolve({ pacing: clock('PAUSED', 'paused') }); await pause
  read.resolve({ pacing: clock('PRACTICE', 'running') }); await refresh
  expect(pacing.current.value?.phase).toBe('PAUSED')
  expect(pacing.state.value?.revision).toBe('paused')
})
it('refreshes authoritative state after a rejected timer mutation', async () => {
  const pacing = useStudyPacing(ref('study'))
  fetch.mockRejectedValueOnce({ data: { statusMessage: 'Your timer changed. Reload.' } })
    .mockResolvedValueOnce({ pacing: clock('PAUSED', 'saved') })
  expect(await pacing.change('RESUME')).toBe(false)
  expect(pacing.current.value?.phase).toBe('PAUSED')
  expect(pacing.error.value).toBe('Your timer changed. Reload.')
  expect(pacing.busy.value).toBe(false)
})
