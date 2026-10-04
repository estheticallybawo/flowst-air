import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useAminaLiveCall } from '../composables/useAminaLiveCall'
import { STUDY_LIVE_START_MESSAGE } from '../shared/studyLive'

const sdk = vi.hoisted(() => ({ start: vi.fn(), callbacks: {} as any, session: { sendUserMessage: vi.fn(), setMicMuted: vi.fn(), setVolume: vi.fn(), endSession: vi.fn(), getInputVolume: vi.fn(() => 0) } }))
vi.mock('@elevenlabs/client', () => ({ Conversation: { startSession: sdk.start } }))
let cleanup: (() => void) | undefined
let fetcher: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers()
  vi.stubGlobal('ref', ref); vi.stubGlobal('computed', computed)
  vi.stubGlobal('onBeforeUnmount', (callback: () => void) => { cleanup = callback })
  vi.stubGlobal('WebSocket', { OPEN: 1 })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } })
  fetcher = vi.fn(async (path: string) => path.endsWith('/live/start')
    ? { conversationToken: 'private-test-token', studyToken: 'test-study-token', maxSeconds: 60 }
    : path.endsWith('/live') ? { enabled: true, provider: 'elevenlabs', socketUrl: '', message: '' } : { turns: [] })
  vi.stubGlobal('useAuth', () => ({ ensureSession: vi.fn().mockResolvedValue(undefined), authorizedFetch: fetcher }))
  sdk.start.mockImplementation(async (options: any) => { sdk.callbacks = options; options.onConnect({ conversationId: 'test-provider-call' }); return sdk.session })
})
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })

test('a clicked call sends one start action after connection and never shows it as spoken words', async () => {
  const call = useAminaLiveCall(ref('study'), vi.fn().mockResolvedValue(undefined))
  expect(sdk.start).not.toHaveBeenCalled()
  await call.start()
  expect(call.hasConnected.value).toBe(true)
  expect(sdk.session.sendUserMessage).toHaveBeenCalledExactlyOnceWith(STUDY_LIVE_START_MESSAGE)
  sdk.callbacks.onMessage({ message: STUDY_LIVE_START_MESSAGE, role: 'user', source: 'user' })
  expect(call.caption.value).toBe('')
  sdk.callbacks.onMessage({ message: 'Page 1 introduces light capture.', role: 'agent', source: 'ai' })
  expect(call.caption.value).toBe('Page 1 introduces light capture.')
  expect(call.savedCaption.value).toBe(false)
  call.stop()
  expect(sdk.session.setMicMuted).toHaveBeenCalledWith(true)
  expect(sdk.session.endSession).toHaveBeenCalled()
})

test('availability stays loading until the actual request settles and remains restricted on failure', async () => {
  let rejectRequest!: (reason: unknown) => void
  fetcher.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject }))
  const call = useAminaLiveCall(ref('study'), vi.fn().mockResolvedValue(undefined))
  const checking = call.checkAvailability()
  expect(call.availabilityLoading.value).toBe(true)
  expect(call.availability.value).toBeNull()
  rejectRequest({ statusCode: 401 })
  await checking
  expect(call.availabilityLoading.value).toBe(false)
  expect(call.availability.value).toBeNull()
  expect(call.error.value).toBe('Your session ended. Sign in again to keep studying.')
  expect(sdk.start).not.toHaveBeenCalled()
})


test('live availability and startup failures never expose provider request details', async () => {
  const diagnostic = '[POST] https://private.example/api/voice Failed to fetch'
  fetcher.mockResolvedValueOnce({ enabled: false, socketUrl: '', message: diagnostic })
  const call = useAminaLiveCall(ref('study'), vi.fn().mockResolvedValue(undefined))
  await call.checkAvailability()
  expect(call.availability.value?.message).toBe('Live calls are unavailable right now. Please try again.')
  sdk.start.mockRejectedValueOnce(new Error(diagnostic))
  await call.start()
  expect(call.error.value).toBe('We couldn’t start the call. Check your connection and try again.')
  expect(call.status.value).toBe('ERROR')
})


test('starting a call preserves the sign-in recovery message when access expires', async () => {
  fetcher.mockRejectedValueOnce({ statusCode: 401 })
  const call = useAminaLiveCall(ref('study'), vi.fn().mockResolvedValue(undefined))
  await call.start()
  expect(call.error.value).toBe('Your session ended. Sign in again to keep studying.')
  expect(sdk.start).not.toHaveBeenCalled()
})
