import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useAminaLiveCall } from '../composables/useAminaLiveCall'

class MockSocket {
  static OPEN = 1
  static instances: MockSocket[] = []
  readyState = MockSocket.OPEN
  bufferedAmount = 0
  binaryType = ''
  onopen?: () => void
  onmessage?: (event: { data: string }) => void
  onerror?: () => void
  onclose?: () => void
  send = vi.fn()
  close = vi.fn(() => { this.readyState = 3 })
  constructor(public url: URL) { MockSocket.instances.push(this) }
  receive(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) }) }
}

const releaseCapture = vi.fn()
const closeAudio = vi.fn().mockResolvedValue(undefined)
let cleanup: (() => Promise<void>) | undefined

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  MockSocket.instances = []
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('onBeforeUnmount', (callback: () => Promise<void>) => { cleanup = callback })
  vi.stubGlobal('WebSocket', MockSocket)
  vi.stubGlobal('window', { location: { origin: 'https://air.local' } })
  vi.stubGlobal('location', { protocol: 'https:' })
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: releaseCapture }],
      }),
    },
  })
  vi.stubGlobal('AudioContext', class {
    currentTime = 0
    destination = {}
    audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) }
    resume = vi.fn().mockResolvedValue(undefined)
    close = closeAudio
    createMediaStreamSource() { return { connect: vi.fn() } }
    createGain() { return { gain: { value: 1 }, connect: vi.fn() } }
  })
  vi.stubGlobal('AudioWorkletNode', class {
    port = { onmessage: undefined }
    connect = vi.fn()
    disconnect = vi.fn()
  })
  vi.stubGlobal('useAuth', () => ({
    accessToken: ref('local-test-token'),
    ensureSession: vi.fn().mockResolvedValue(undefined),
    authorizedFetch: vi.fn().mockResolvedValue({
      enabled: true,
      provider: 'bedrock',
      socketUrl: 'wss://air.local/local-test-voice',
      message: '',
    }),
  }))
})

afterEach(async () => {
  await cleanup?.()
  cleanup = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test.each([
  '/home',
  '/home/new',
  '/home/settings',
  '/air',
  '/air/settings',
  '/auth/sign-in?redirect=/home/new',
])('a WebSocket error preserves the local recovery destination %s', async (destination) => {
  const call = useAminaLiveCall(ref('study'), vi.fn().mockResolvedValue(undefined))
  await call.start()
  expect(MockSocket.instances).toHaveLength(1)
  expect(call.status.value).toBe('CONNECTING')
  MockSocket.instances[0]!.receive({
    type: 'error',
    code: 'LOCAL_TEST_RECOVERY',
    message: 'Choose your next session to continue.',
    nextAction: destination,
  })
  expect(call.nextAction.value).toBe(destination)
  expect(call.errorCode.value).toBe('LOCAL_TEST_RECOVERY')
  expect(call.status.value).toBe('ERROR')
  expect(releaseCapture).toHaveBeenCalledOnce()
  expect(closeAudio).toHaveBeenCalledOnce()
  await call.stop()
})

test.each([
  '/home-away/settings',
  'https://outside.example/home',
  '//outside.example/home',
  '/api/study',
  '/auth/register',
  42,
])('a WebSocket error rejects a recovery destination outside the allowed pages: %s', async (destination) => {
  const call = useAminaLiveCall(ref('study'), vi.fn().mockResolvedValue(undefined))
  await call.start()
  MockSocket.instances[0]!.receive({
    type: 'error',
    message: 'Choose your next session to continue.',
    nextAction: destination,
  })
  expect(call.nextAction.value).toBe('')
  expect(call.status.value).toBe('ERROR')
  await call.stop()
})
