import { createError } from 'h3'
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'
import type { VoiceId } from '@aws-sdk/client-polly'
import { StartStreamTranscriptionCommand, TranscribeStreamingClient } from '@aws-sdk/client-transcribe-streaming'
import type { H3Event } from 'h3'
import type { StudyConversation } from '../../shared/study'
import { awsClientConfig } from './awsClientConfig'
import { reserveStudyVoiceUsage } from './studyRepository'

let transcribe: TranscribeStreamingClient | undefined
let polly: PollyClient | undefined
const SAMPLE_RATE = 16_000
const BYTES_PER_SECOND = SAMPLE_RATE * 2

function awsSpeechError(error: unknown, service: string) {
  const name = (error as { name?: string })?.name || ''
  if (/Credentials|ExpiredToken|UnrecognizedClient|InvalidSignature/i.test(name))
    return 'Amina’s voice is temporarily unavailable. Please try again or contact the pilot team if this continues.'
  if (/AccessDenied|Unauthorized|ResourceNotFound/i.test(name))
    return 'Amina’s voice is temporarily unavailable. Please try again or contact the pilot team if this continues.'
  if (/Throttling|ServiceUnavailable|Timeout/i.test(name))
    return 'Amina’s voice is taking longer than usual. Please try again in a moment.'
  return service === 'Transcribe'
    ? 'We could not turn that recording into text. Your recording is still here; please try sending it again.'
    : 'Amina’s audio could not play. Her reply is still in your transcript.'
}

export async function transcribeStudyPcm(ownerId: string, conversation: StudyConversation, pcm: Buffer, event?: H3Event) {
  if (useRuntimeConfig(event).studyVoiceProvider !== 'aws') return (await import('./studyElevenSpeech')).elevenTranscribeStudyPcm(ownerId, conversation, pcm, event)
  if (pcm.length < 3200 || pcm.length > 3_840_000 || pcm.length % 2)
    throw createError({ statusCode: 400, statusMessage: 'Record between 0.1 and 120 seconds of 16 kHz mono PCM audio.' })
  const seconds = Math.ceil(pcm.length / BYTES_PER_SECOND)
  const config = useRuntimeConfig(event)
  transcribe ||= new TranscribeStreamingClient({ ...awsClientConfig(String(config.awsRegion || 'us-east-1')), maxAttempts: 1 })
  await reserveStudyVoiceUsage(ownerId, conversation.id, {
    kind: 'TRANSCRIBE', units: seconds, estimatedUsd: seconds / 60 * Number(config.studyAwsTranscribeUsdPerMinute),
  }, event)
  async function* audioStream() {
    for (let offset = 0; offset < pcm.length; offset += 3200)
      yield { AudioEvent: { AudioChunk: pcm.subarray(offset, Math.min(offset + 3200, pcm.length)) } }
  }
  try {
    const result = await transcribe.send(new StartStreamTranscriptionCommand({
      LanguageCode: 'en-US', MediaEncoding: 'pcm', MediaSampleRateHertz: SAMPLE_RATE, AudioStream: audioStream(),
    }), { abortSignal: AbortSignal.timeout(90_000) })
    const finals: string[] = []
    for await (const item of result.TranscriptResultStream || []) {
      for (const segment of item.TranscriptEvent?.Transcript?.Results || []) {
        if (!segment.IsPartial) {
          const text = segment.Alternatives?.[0]?.Transcript?.trim()
          if (text) finals.push(text)
        }
      }
    }
    return finals.join(' ').trim()
  } catch (error) {
    console.error('Amazon Transcribe study turn failed', error)
    throw createError({ statusCode: 503, statusMessage: awsSpeechError(error, 'Transcribe') })
  }
}

export async function synthesizeStudySpeech(ownerId: string, conversation: StudyConversation, text: string, event?: H3Event) {
  if (useRuntimeConfig(event).studyVoiceProvider !== 'aws') return (await import('./studyElevenSpeech')).elevenSynthesizeStudySpeech(ownerId, conversation, text, event)
  const config = useRuntimeConfig(event)
  const spoken = text.slice(0, 3000)
  polly ||= new PollyClient({ ...awsClientConfig(String(config.awsRegion || 'us-east-1')), maxAttempts: 1 })
  await reserveStudyVoiceUsage(ownerId, conversation.id, {
    kind: 'POLLY', units: spoken.length, estimatedUsd: spoken.length / 1_000_000 * Number(config.studyAwsPollyUsdPerMillion),
  }, event)
  try {
    const result = await polly.send(new SynthesizeSpeechCommand({
      Text: spoken, OutputFormat: 'mp3', VoiceId: String(config.studyAwsPollyVoiceId || 'Joanna') as VoiceId, Engine: 'neural',
    }))
    if (!result.AudioStream) throw new Error('Empty Polly audio stream')
    const audio = Buffer.from(await result.AudioStream.transformToByteArray())
    return audio
  } catch (error) {
    console.error('Amazon Polly study reply failed', error)
    throw createError({ statusCode: 503, statusMessage: awsSpeechError(error, 'Polly') })
  }
}
