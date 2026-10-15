import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ reserve: vi.fn() }))
vi.mock('../server/services/studyRepository', () => ({ reserveStudyVoiceUsage: mocks.reserve }))
import { AMINA_VOICES, isAminaVoiceId } from '../shared/aminaVoices'
import { DEFAULT_AGENT_PRESENTATION } from '../shared/agentPresentation'
import { selectedAminaVoice, resolveAminaVoice } from '../server/services/studyAminaVoice'
import { elevenSynthesizeStudySpeech, elevenSynthesizeTimedStudySpeech } from '../server/services/studyElevenSpeech'
import { getAminaAgent } from '../server/services/studyElevenAgent'
import type { StudyConversation } from '../shared/study'

const selectedVoiceId = '2vbhUP8zyKg4dEZaTWGn'
const conversation = (voiceId: string | null = selectedVoiceId) => ({
  ownerId: 'owner', id: 'session', agentPresentation: {
    ...DEFAULT_AGENT_PRESENTATION,
    agents: { ...DEFAULT_AGENT_PRESENTATION.agents, AMIRA: { ...DEFAULT_AGENT_PRESENTATION.agents.AMIRA, voiceId } },
  },
}) as StudyConversation

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({ elevenLabsApiKey: 'synthetic', elevenLabsVoiceId: 'configured-default', elevenLabsModelId: 'eleven_flash_v2_5' }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('Amina voice choices', () => {
  it('keeps exactly the approved selectable voices and rejects unsupported IDs', () => {
    expect(AMINA_VOICES.filter(voice => voice.available)).toHaveLength(8)
    expect(AMINA_VOICES.find(voice => voice.name === 'Conversational')?.id).toBe(selectedVoiceId)
    for (const voiceId of ['ii0s2u4R3UFnxKL6DOrz', 'unknown', '', 3, null]) expect(isAminaVoiceId(voiceId)).toBe(false)
  })
  it('retains the configured voice for legacy and original-look sessions', () => {
    expect(selectedAminaVoice({})).toBeNull()
    expect(resolveAminaVoice({}, 'configured')).toBe('configured')
    expect(resolveAminaVoice(conversation(null), 'configured')).toBe('configured')
    expect(resolveAminaVoice(conversation(), 'configured')).toBe(selectedVoiceId)
  })
  it('preserves the configuration error when no session or server voice is selected', () => {
    expect(() => resolveAminaVoice({}, '')).toThrow(expect.objectContaining({ statusCode: 503, data: { code: 'SPEECH_NOT_CONFIGURED', retryable: false } }))
    expect(() => resolveAminaVoice(conversation(null), undefined)).toThrow(expect.objectContaining({ statusCode: 503 }))
    expect(resolveAminaVoice(conversation(), undefined)).toBe(selectedVoiceId)
  })
  it.each([elevenSynthesizeStudySpeech, elevenSynthesizeTimedStudySpeech])('uses the immutable saved session voice with one reservation and request', async synthesize => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ audio_base64: 'YXVkaW8=' })))
    vi.stubGlobal('fetch', fetcher)
    await synthesize('owner', conversation(), 'A synthetic test line.')
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]![0]).toContain(`/text-to-speech/${selectedVoiceId}`)
    expect(mocks.reserve).toHaveBeenCalledTimes(1)
  })
  it('rejects unsupported saved selections before reserving or dispatching speech', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(elevenSynthesizeTimedStudySpeech('owner', conversation('untrusted'), 'Test')).rejects.toMatchObject({ statusCode: 409, data: { code: 'SPEECH_VOICE_UNAVAILABLE', retryable: false } })
    expect(fetcher).not.toHaveBeenCalled()
    expect(mocks.reserve).not.toHaveBeenCalled()
  })
  it('requires live voice override permission without changing the remote agent', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ elevenLabsApiKey: 'synthetic', elevenLabsStudyAgentId: 'synthetic-agent', studyTextProvider: 'aws', elevenLabsStudyLlmSecret: 's'.repeat(32), elevenLabsStudyLlmUrl: 'https://example.com/study' }))
    const agent = {
      conversation_config: { conversation: { max_duration_seconds: 60 }, agent: { first_message: '', prompt: { llm: 'custom-llm', custom_llm: { url: 'https://example.com/study' }, backup_llm_config: { preference: 'disabled' } } } },
      platform_settings: { privacy: { record_voice: false, retention_days: 0 }, auth: { enable_auth: true }, overrides: { custom_llm_extra_body: true, conversation_config_override: { tts: { voice_id: false } } } },
    }
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify(agent)))
    vi.stubGlobal('fetch', fetcher)
    await expect(getAminaAgent(selectedVoiceId)).rejects.toMatchObject({ data: { code: 'LIVE_VOICE_OVERRIDE_DISABLED', retryable: false } })
    await expect(getAminaAgent()).resolves.toEqual({ maxSeconds: 60 })
    agent.platform_settings.overrides.conversation_config_override.tts.voice_id = true
    await expect(getAminaAgent(selectedVoiceId)).resolves.toEqual({ maxSeconds: 60 })
    expect(fetcher.mock.calls.every(call => !call[1]?.method)).toBe(true)
  })
})
