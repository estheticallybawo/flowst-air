import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { DEFAULT_AGENT_PRESENTATION } from '../shared/agentPresentation'

const calls = vi.hoisted(() => ({
  identity: vi.fn(), access: vi.fn(), build: vi.fn(), agent: vi.fn(),
  acquire: vi.fn(), release: vi.fn(), usage: vi.fn(), current: vi.fn(), sign: vi.fn(), header: vi.fn(),
}))
vi.mock('../server/utils/auth', () => ({ requireIdentity: calls.identity }))
vi.mock('../server/services/airAccess', () => ({ assertAirStudyAccess: calls.access }))
vi.mock('../server/services/studyAmina', () => ({ buildAminaLiveContext: calls.build }))
vi.mock('../server/services/studyElevenAgent', () => ({ getAminaAgent: calls.agent }))
vi.mock('../server/services/studyRepository', () => ({
  acquireStudyLiveLease: calls.acquire, appendStudyVoiceUsage: calls.usage,
  releaseStudyLiveLease: calls.release, getStudyConversation: calls.current,
}))
vi.mock('../server/services/studyVoice', () => ({ signStudyVoiceToken: calls.sign }))

const voiceId = '2vbhUP8zyKg4dEZaTWGn'
const snapshot = () => ({
  ...DEFAULT_AGENT_PRESENTATION,
  agents: { ...DEFAULT_AGENT_PRESENTATION.agents, AMIRA: { ...DEFAULT_AGENT_PRESENTATION.agents.AMIRA, voiceId } },
})
let handler: (event: any) => Promise<unknown>
let fetcher: ReturnType<typeof vi.fn>

beforeEach(async () => {
  vi.clearAllMocks()
  calls.identity.mockResolvedValue({ userId: 'owner' })
  calls.build.mockResolvedValue({ conversation: { plan: { version: 3 }, agentPresentation: snapshot() } })
  calls.agent.mockResolvedValue({ maxSeconds: 60 })
  calls.acquire.mockResolvedValue({ leaseId: 'lease' })
  calls.current.mockResolvedValue({ plan: { version: 3 } })
  calls.sign.mockReturnValue('signed-study-token')
  vi.stubGlobal('defineEventHandler', (callback: unknown) => callback)
  vi.stubGlobal('getRouterParam', () => 'session')
  vi.stubGlobal('useRuntimeConfig', () => ({ elevenLabsStudyAgentId: 'synthetic-agent', elevenLabsApiKey: 'synthetic' }))
  vi.stubGlobal('setHeader', calls.header)
  vi.stubGlobal('createError', createError)
  fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'synthetic-connection-token' })))
  vi.stubGlobal('fetch', fetcher)
  handler = (await import('../server/api/study/conversations/[id]/live/start.post')).default as typeof handler
})
afterEach(() => { vi.unstubAllGlobals() })

it('checks authentication before reading a session or obtaining a voice connection', async () => {
  calls.identity.mockRejectedValueOnce(createError({ statusCode: 401 }))
  await expect(handler({})).rejects.toMatchObject({ statusCode: 401 })
  expect(calls.access).not.toHaveBeenCalled()
  expect(calls.build).not.toHaveBeenCalled()
  expect(calls.agent).not.toHaveBeenCalled()
  expect(calls.acquire).not.toHaveBeenCalled()
  expect(fetcher).not.toHaveBeenCalled()
})

it('rejects an unsupported saved voice before remote checks or lease acquisition', async () => {
  const presentation = snapshot()
  presentation.agents.AMIRA.voiceId = 'untrusted'
  calls.build.mockResolvedValueOnce({ conversation: { plan: { version: 3 }, agentPresentation: presentation } })
  await expect(handler({})).rejects.toMatchObject({ statusCode: 409, data: { code: 'SPEECH_VOICE_UNAVAILABLE' } })
  expect(calls.access).toHaveBeenCalledWith('owner', 'PRACTISE', {})
  expect(calls.build).toHaveBeenCalledWith('owner', 'session')
  expect(calls.agent).not.toHaveBeenCalled()
  expect(calls.acquire).not.toHaveBeenCalled()
  expect(fetcher).not.toHaveBeenCalled()
})

it('does not acquire a call lease or connection when selected-voice overrides are unavailable', async () => {
  calls.agent.mockRejectedValueOnce(createError({ statusCode: 503, data: { code: 'LIVE_VOICE_OVERRIDE_DISABLED' } }))
  await expect(handler({})).rejects.toMatchObject({ data: { code: 'LIVE_VOICE_OVERRIDE_DISABLED' } })
  expect(calls.agent).toHaveBeenCalledWith(voiceId)
  expect(calls.acquire).not.toHaveBeenCalled()
  expect(calls.usage).not.toHaveBeenCalled()
  expect(fetcher).not.toHaveBeenCalled()
})

it('returns the saved voice while retaining the bounded lease, signed token and usage record', async () => {
  expect(await handler({})).toEqual({ conversationToken: 'synthetic-connection-token', studyToken: 'signed-study-token', maxSeconds: 60, voiceId })
  expect(calls.agent).toHaveBeenCalledWith(voiceId)
  expect(calls.acquire).toHaveBeenCalledWith('owner', 'session', 90_000, 6000)
  expect(calls.sign).toHaveBeenCalledWith('owner', 'session', 3, 'lease')
  expect(calls.usage).toHaveBeenCalledWith('owner', 'session', { kind: 'ELEVEN_CALL', units: 60 }, {})
  expect(calls.header).toHaveBeenCalledWith({}, 'Cache-Control', 'private, no-store')
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(calls.release).not.toHaveBeenCalled()
})

it('releases the same lease without requesting a connection when the approved plan changes', async () => {
  calls.current.mockResolvedValueOnce({ plan: { version: 4 } })
  await expect(handler({})).rejects.toMatchObject({ statusCode: 409 })
  expect(fetcher).not.toHaveBeenCalled()
  expect(calls.usage).not.toHaveBeenCalled()
  expect(calls.release).toHaveBeenCalledWith('session', 'lease')
})
