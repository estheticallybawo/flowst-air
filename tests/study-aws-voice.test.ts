import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStudyConversation, deleteStudyConversation, getStudyConversation } from '../server/services/studyRepository'
import { synthesizeStudySpeech, transcribeStudyPcm } from '../server/services/studyAwsSpeech'

const sdk = vi.hoisted(() => ({ transcribeSend: vi.fn(), pollySend: vi.fn() }))

vi.mock('@aws-sdk/client-transcribe-streaming', () => ({
  TranscribeStreamingClient: class { send = sdk.transcribeSend },
  StartStreamTranscriptionCommand: class { constructor(public input: any) {} },
}))
vi.mock('@aws-sdk/client-polly', () => ({
  PollyClient: class { send = sdk.pollySend },
  SynthesizeSpeechCommand: class { constructor(public input: any) {} },
}))

vi.stubGlobal('useRuntimeConfig', () => ({
  studyVoiceProvider: 'aws', flowstAuthMode: 'mock', awsRegion: 'us-east-1', studyAwsVoiceTrialMaxSeconds: 300,
  studyAwsVoiceTrialMaxCharacters: 6000, studyAwsTranscribeUsdPerMinute: 0.03,
  studyAwsPollyUsdPerMillion: 16, studyAwsPollyVoiceId: 'Joanna',
}))
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => { sdk.transcribeSend.mockReset(); sdk.pollySend.mockReset() })

describe('Amazon-only Amina voice services', () => {
  it('does not claim an unsent transcript was saved when voice processing fails', async () => {
    const chat = await createStudyConversation('voice-failure-owner', 'lesson.pdf', 'application/pdf', Buffer.from('document'), {
      kind: 'PDF', sections: [{ id: 'page-1', label: 'Page 1', text: 'Plants need light.' }], excerpt: 'Plants',
    })
    sdk.transcribeSend.mockRejectedValue(Object.assign(new Error('Synthetic permission failure'), { name: 'AccessDeniedException' }))
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await expect(transcribeStudyPcm('voice-failure-owner', chat, Buffer.alloc(6400))).rejects.toMatchObject({
        statusCode: 503, statusMessage: expect.not.stringContaining('saved'),
      })
      expect((await getStudyConversation('voice-failure-owner', chat.id)).turns).toHaveLength(0)
    } finally { log.mockRestore(); await deleteStudyConversation('voice-failure-owner', chat.id) }
  })

  it('streams signed 16-bit PCM to Transcribe and counts finalized text without storing audio', async () => {
    const chat = await createStudyConversation('aws-voice-owner', 'lesson.pdf', 'application/pdf', Buffer.from('document'), {
      kind: 'PDF', sections: [{ id: 'page-1', label: 'Page 1', text: 'Plants convert light into chemical energy.' }], excerpt: 'Plants',
    })
    sdk.transcribeSend.mockImplementation(async (command: { input: { AudioStream: AsyncIterable<{ AudioEvent: { AudioChunk: Uint8Array } }> } }) => {
      const chunks: Uint8Array[] = []
      for await (const item of command.input.AudioStream) chunks.push(item.AudioEvent.AudioChunk)
      expect(chunks.map(chunk => chunk.length)).toEqual([3200, 3200])
      return { TranscriptResultStream: (async function* () {
        yield { TranscriptEvent: { Transcript: { Results: [{ IsPartial: true, Alternatives: [{ Transcript: 'Plants' }] }] } } }
        yield { TranscriptEvent: { Transcript: { Results: [{ IsPartial: false, Alternatives: [{ Transcript: 'Plants convert light into energy.' }] }] } } }
      })() }
    })
    const transcript = await transcribeStudyPcm('aws-voice-owner', chat, Buffer.alloc(6400))
    expect(transcript).toBe('Plants convert light into energy.')
    const current = await getStudyConversation('aws-voice-owner', chat.id)
    expect(current.voiceUsage?.transcribeSeconds).toBe(1)
    expect(current).not.toHaveProperty('audio')
    await deleteStudyConversation('aws-voice-owner', chat.id)
  })

  it('speaks with Polly neural voice and counts characters', async () => {
    const chat = await createStudyConversation('polly-owner', 'lesson.pdf', 'application/pdf', Buffer.from('document'), {
      kind: 'PDF', sections: [{ id: 'page-1', label: 'Page 1', text: 'Water is a reactant.' }], excerpt: 'Water',
    })
    sdk.pollySend.mockImplementation(async (command: { input: { Text: string, VoiceId: string, Engine: string } }) => {
      expect(command.input).toMatchObject({ Text: 'Welcome to the lesson.', VoiceId: 'Joanna', Engine: 'neural' })
      return { AudioStream: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } }
    })
    const audio = await synthesizeStudySpeech('polly-owner', chat, 'Welcome to the lesson.')
    expect([...audio]).toEqual([1, 2, 3])
    expect((await getStudyConversation('polly-owner', chat.id)).voiceUsage?.pollyCharacters).toBe(22)
    await deleteStudyConversation('polly-owner', chat.id)
  })
})
