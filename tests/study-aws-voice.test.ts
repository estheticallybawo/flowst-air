import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStudyConversation, deleteStudyConversation, getStudyConversation, reserveStudyVoiceUsage } from '../server/services/studyRepository'
import { synthesizeStudySpeech, transcribeStudyPcm } from '../server/services/studyAwsSpeech'
import type { StudyConversation } from '../shared/study'

const sdk = vi.hoisted(() => ({ transcribeSend: vi.fn(), pollySend: vi.fn(), transcribeConfig: vi.fn(), pollyConfig: vi.fn() }))

vi.mock('@aws-sdk/client-transcribe-streaming', () => ({
  TranscribeStreamingClient: class {
    constructor(config: unknown) { sdk.transcribeConfig(config) }
    send = sdk.transcribeSend
  },
  StartStreamTranscriptionCommand: class { constructor(public input: any) {} },
}))
vi.mock('@aws-sdk/client-polly', () => ({
  PollyClient: class {
    constructor(config: unknown) { sdk.pollyConfig(config) }
    send = sdk.pollySend
  },
  SynthesizeSpeechCommand: class { constructor(public input: any) {} },
}))

vi.stubGlobal('useRuntimeConfig', () => ({
  studyVoiceProvider: 'aws', flowstAuthMode: 'mock', awsRegion: 'us-east-1', studyAwsVoiceTrialMaxSeconds: 300,
  studyAwsVoiceTrialMaxCharacters: 6000, studyAwsTranscribeUsdPerMinute: 0.03,
  studyAwsPollyUsdPerMillion: 16, studyAwsPollyVoiceId: 'Joanna',
}))
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => { sdk.transcribeSend.mockReset(); sdk.pollySend.mockReset() })

async function withVoiceConversation(ownerId: string, test: (chat: StudyConversation) => Promise<void>) {
  const chat = await createStudyConversation(ownerId, 'lesson.pdf', 'application/pdf', Buffer.from('document'), {
    kind: 'PDF', sections: [{ id: 'page-1', label: 'Page 1', text: 'Plants need light.' }], excerpt: 'Plants',
  })
  try { await test(chat) } finally { await deleteStudyConversation(ownerId, chat.id) }
}

function transcribeResult(text = 'Plants need light.') {
  return { TranscriptResultStream: (async function* () {
    yield { TranscriptEvent: { Transcript: { Results: [{ IsPartial: false, Alternatives: [{ Transcript: text }] }] } } }
  })() }
}

function pollyResult() {
  return { AudioStream: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } }
}

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
      expect(sdk.transcribeConfig).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 1 }))
      expect((await getStudyConversation('voice-failure-owner', chat.id)).turns).toHaveLength(0)
      expect((await getStudyConversation('voice-failure-owner', chat.id)).voiceUsage?.transcribeSeconds).toBe(1)
    } finally { log.mockRestore(); await deleteStudyConversation('voice-failure-owner', chat.id) }
  })

  it('streams signed 16-bit PCM to Transcribe and counts finalized text without storing audio', async () => {
    const chat = await createStudyConversation('aws-voice-owner', 'lesson.pdf', 'application/pdf', Buffer.from('document'), {
      kind: 'PDF', sections: [{ id: 'page-1', label: 'Page 1', text: 'Plants convert light into chemical energy.' }], excerpt: 'Plants',
    })
    sdk.transcribeSend.mockImplementation(async (command: { input: { AudioStream: AsyncIterable<{ AudioEvent: { AudioChunk: Uint8Array } }> } }) => {
      expect((await getStudyConversation('aws-voice-owner', chat.id)).voiceUsage?.transcribeSeconds).toBe(1)
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
      expect((await getStudyConversation('polly-owner', chat.id)).voiceUsage?.pollyCharacters).toBe(22)
      expect(command.input).toMatchObject({ Text: 'Welcome to the lesson.', VoiceId: 'Joanna', Engine: 'neural' })
      return { AudioStream: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } }
    })
    const audio = await synthesizeStudySpeech('polly-owner', chat, 'Welcome to the lesson.')
    expect(sdk.pollyConfig).toHaveBeenCalledWith(expect.objectContaining({ maxAttempts: 1 }))
    expect([...audio]).toEqual([1, 2, 3])
    expect((await getStudyConversation('polly-owner', chat.id)).voiceUsage?.pollyCharacters).toBe(22)
    await deleteStudyConversation('polly-owner', chat.id)
  })

  it.each([
    { priorSeconds: 299, bytes: 3200, chargedSeconds: 1 },
    { priorSeconds: 298, bytes: 32002, chargedSeconds: 2 },
  ])('allows exactly 300 input seconds after rounding $bytes PCM bytes up to $chargedSeconds seconds', async ({ priorSeconds, bytes, chargedSeconds }) => {
    const owner = `aws-input-boundary-${bytes}`
    await withVoiceConversation(owner, async chat => {
      await reserveStudyVoiceUsage(owner, chat.id, { kind: 'TRANSCRIBE', units: priorSeconds, estimatedUsd: 0 })
      sdk.transcribeSend.mockImplementation(async () => {
        expect((await getStudyConversation(owner, chat.id)).voiceUsage?.transcribeSeconds).toBe(priorSeconds + chargedSeconds)
        return transcribeResult()
      })
      await expect(transcribeStudyPcm(owner, chat, Buffer.alloc(bytes))).resolves.toBe('Plants need light.')
      expect(sdk.transcribeSend).toHaveBeenCalledTimes(1)
      expect((await getStudyConversation(owner, chat.id)).voiceUsage?.transcribeSeconds).toBe(300)
    })
  })

  it('rounds each short recording separately even when both use the original conversation snapshot', async () => {
    await withVoiceConversation('aws-rounded-input', async chat => {
      sdk.transcribeSend.mockImplementation(async () => transcribeResult())
      await transcribeStudyPcm('aws-rounded-input', chat, Buffer.alloc(3200))
      await transcribeStudyPcm('aws-rounded-input', chat, Buffer.alloc(3200))
      expect(sdk.transcribeSend).toHaveBeenCalledTimes(2)
      expect((await getStudyConversation('aws-rounded-input', chat.id)).voiceUsage?.transcribeSeconds).toBe(2)
    })
  })

  it.each([
    { priorSeconds: 300, bytes: 3200 },
    { priorSeconds: 299, bytes: 32002 },
  ])('continues input beyond former totals ($priorSeconds seconds plus $bytes PCM bytes)', async ({ priorSeconds, bytes }) => {
    const owner = `aws-exhausted-input-${priorSeconds}`
    await withVoiceConversation(owner, async chat => {
      await reserveStudyVoiceUsage(owner, chat.id, { kind: 'TRANSCRIBE', units: priorSeconds, estimatedUsd: 0 })
      sdk.transcribeSend.mockImplementation(async () => transcribeResult())
      await expect(transcribeStudyPcm(owner, chat, Buffer.alloc(bytes))).resolves.toBe('Plants need light.')
      expect(sdk.transcribeSend).toHaveBeenCalledTimes(1)
      expect((await getStudyConversation(owner, chat.id)).voiceUsage?.transcribeSeconds).toBe(priorSeconds + Math.ceil(bytes / 32000))
    })
  })

  it('counts the spoken 3000 characters per reply and allows a further reply beyond 6000 total', async () => {
    await withVoiceConversation('aws-output-boundary', async chat => {
      await reserveStudyVoiceUsage('aws-output-boundary', chat.id, { kind: 'POLLY', units: 3000, estimatedUsd: 0 })
      sdk.pollySend.mockImplementation(async (command: { input: { Text: string } }) => {
        expect(command.input.Text).toBe(sdk.pollySend.mock.calls.length === 1 ? 'a'.repeat(3000) : 'b')
        expect((await getStudyConversation('aws-output-boundary', chat.id)).voiceUsage?.pollyCharacters).toBe(sdk.pollySend.mock.calls.length === 1 ? 6000 : 6001)
        return pollyResult()
      })
      await expect(synthesizeStudySpeech('aws-output-boundary', chat, 'a'.repeat(3500))).resolves.toEqual(Buffer.from([1, 2, 3]))
      await expect(synthesizeStudySpeech('aws-output-boundary', chat, 'b')).resolves.toEqual(Buffer.from([1, 2, 3]))
      expect(sdk.pollySend).toHaveBeenCalledTimes(2)
      expect((await getStudyConversation('aws-output-boundary', chat.id)).voiceUsage?.pollyCharacters).toBe(6001)
    })
  })

  it('continues generating speech when existing usage has reached the former total', async () => {
    await withVoiceConversation('aws-exhausted-output', async chat => {
      await reserveStudyVoiceUsage('aws-exhausted-output', chat.id, { kind: 'POLLY', units: 6000, estimatedUsd: 0 })
      sdk.pollySend.mockImplementation(async () => pollyResult())
      await expect(synthesizeStudySpeech('aws-exhausted-output', chat, 'One more reply.')).resolves.toEqual(Buffer.from([1, 2, 3]))
      expect(sdk.pollySend).toHaveBeenCalledTimes(1)
      expect((await getStudyConversation('aws-exhausted-output', chat.id)).voiceUsage?.pollyCharacters).toBe(6000 + 'One more reply.'.length)
    })
  })

  it('records both concurrent distinct output requests beyond the former total', async () => {
    await withVoiceConversation('aws-concurrent-output', async chat => {
      await reserveStudyVoiceUsage('aws-concurrent-output', chat.id, { kind: 'POLLY', units: 5900, estimatedUsd: 0 })
      sdk.pollySend.mockImplementation(async () => {
        expect((await getStudyConversation('aws-concurrent-output', chat.id)).voiceUsage?.pollyCharacters).toBeGreaterThanOrEqual(5960)
        return pollyResult()
      })
      const results = await Promise.allSettled([
        synthesizeStudySpeech('aws-concurrent-output', chat, 'a'.repeat(60)),
        synthesizeStudySpeech('aws-concurrent-output', chat, 'b'.repeat(60)),
      ])
      expect(results.every(result => result.status === 'fulfilled')).toBe(true)
      expect(sdk.pollySend).toHaveBeenCalledTimes(2)
      expect((await getStudyConversation('aws-concurrent-output', chat.id)).voiceUsage?.pollyCharacters).toBe(6020)
    })
  })

  it('records both concurrent distinct recordings beyond the former total', async () => {
    await withVoiceConversation('aws-concurrent-input', async chat => {
      await reserveStudyVoiceUsage('aws-concurrent-input', chat.id, { kind: 'TRANSCRIBE', units: 299, estimatedUsd: 0 })
      sdk.transcribeSend.mockImplementation(async () => {
        expect((await getStudyConversation('aws-concurrent-input', chat.id)).voiceUsage?.transcribeSeconds).toBeGreaterThanOrEqual(300)
        return transcribeResult()
      })
      const results = await Promise.allSettled([
        transcribeStudyPcm('aws-concurrent-input', chat, Buffer.alloc(6400, 1)),
        transcribeStudyPcm('aws-concurrent-input', chat, Buffer.alloc(6400, 2)),
      ])
      expect(results.every(result => result.status === 'fulfilled')).toBe(true)
      expect(sdk.transcribeSend).toHaveBeenCalledTimes(2)
      expect((await getStudyConversation('aws-concurrent-input', chat.id)).voiceUsage?.transcribeSeconds).toBe(301)
    })
  })

  it.each(['dispatch', 'audio stream'])('retains the output reservation after an uncertain Polly %s failure', async stage => {
    const owner = `aws-polly-failure-${stage}`
    await withVoiceConversation(owner, async chat => {
      const failure = Object.assign(new Error('Synthetic timeout'), { name: 'TimeoutError' })
      if (stage === 'dispatch') sdk.pollySend.mockRejectedValue(failure)
      else sdk.pollySend.mockResolvedValue({ AudioStream: { transformToByteArray: async () => { throw failure } } })
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        await expect(synthesizeStudySpeech(owner, chat, 'Reserved reply.')).rejects.toMatchObject({ statusCode: 503 })
        expect(sdk.pollySend).toHaveBeenCalledTimes(1)
        expect((await getStudyConversation(owner, chat.id)).voiceUsage?.pollyCharacters).toBe('Reserved reply.'.length)
      } finally { log.mockRestore() }
    })
  })

  it('retains the input reservation if the returned transcript stream fails', async () => {
    await withVoiceConversation('aws-transcript-stream-failure', async chat => {
      sdk.transcribeSend.mockResolvedValue({ TranscriptResultStream: (async function* () {
        yield { TranscriptEvent: { Transcript: { Results: [{ IsPartial: true, Alternatives: [{ Transcript: 'Plants' }] }] } } }
        throw Object.assign(new Error('Synthetic stream timeout'), { name: 'TimeoutError' })
      })() })
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        await expect(transcribeStudyPcm('aws-transcript-stream-failure', chat, Buffer.alloc(32002))).rejects.toMatchObject({ statusCode: 503 })
        expect(sdk.transcribeSend).toHaveBeenCalledTimes(1)
        expect((await getStudyConversation('aws-transcript-stream-failure', chat.id)).voiceUsage?.transcribeSeconds).toBe(2)
      } finally { log.mockRestore() }
    })
  })
})
