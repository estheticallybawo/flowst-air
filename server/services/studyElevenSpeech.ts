import {validSpeechAlignment,type TimedStudySpeech} from '../../shared/studySpeech'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { StudyConversation } from '../../shared/study'
import { reserveStudyVoiceUsage } from './studyRepository'

function key(event?: H3Event) {
  const config = useRuntimeConfig(event)
  if (!config.elevenLabsApiKey) throw createError({ statusCode: 503, statusMessage: 'Amina’s voice is not configured on this server. Your saved reply remains available.', data: { code: 'SPEECH_NOT_CONFIGURED', retryable: false } })
  return config
}

/** Provider messages may echo submitted text or configuration. Return only our safe descriptions. */
async function rejectionCode(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      bytes += part.value.byteLength
      if (bytes > 16_384) { await reader.cancel(); return '' }
      chunks.push(part.value)
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const code = body?.detail?.code || body?.detail?.status || body?.detail?.type
    return typeof code === 'string' ? code : ''
  } catch { return '' } finally { reader.releaseLock() }
}

async function checked(response: Response) {
  if (!response.ok) {
    const reason = await rejectionCode(response)
    let code = 'SPEECH_PROVIDER_UNAVAILABLE'
    let message = 'Amina’s voice service is unavailable right now. You can retry voice or read your saved reply.'
    let retryable = true
    if (['quota_exceeded', 'insufficient_credits', 'insufficient_balance', 'payment_required', 'subscription_required'].includes(reason) || response.status === 402) {
      code = 'SPEECH_PROVIDER_CREDITS'
      message = 'The speech provider has paused audio because its account needs credits or an eligible plan. Your study has no cumulative voice quota; your saved reply remains available.'
      retryable = false
    } else if (['detected_unusual_activity', 'unusual_activity_detected'].includes(reason)) {
      code = 'SPEECH_PROVIDER_RESTRICTED'
      message = 'The speech provider has restricted audio for this deployment. The Flowst team needs to resolve it; your saved reply remains available.'
      retryable = false
    } else if (['voice_not_found', 'model_not_found', 'invalid_api_key', 'authentication_error', 'authorization_error', 'permission_denied', 'missing_permissions'].includes(reason) || [401, 403, 404].includes(response.status)) {
      code = 'SPEECH_PROVIDER_CONFIGURATION'
      message = 'Amina’s configured voice is unavailable to the server. The Flowst team needs to check its voice access; your saved reply remains available.'
      retryable = false
    } else if (['rate_limit_exceeded', 'concurrent_limit_exceeded', 'too_many_concurrent_requests'].includes(reason) || response.status === 429) {
      code = 'SPEECH_PROVIDER_BUSY'
      message = 'Amina’s speech provider is busy. Wait a moment before retrying voice; your saved reply remains available.'
    }
    console.warn('Study speech provider rejected a request', { provider: 'elevenlabs', providerStatus: response.status, code })
    throw createError({ statusCode: code === 'SPEECH_PROVIDER_BUSY' ? 429 : 503, statusMessage: message, data: { code, retryable } })
  }
  return response
}
export async function elevenTranscribeStudyPcm(ownerId: string, conversation: StudyConversation, pcm: Buffer, event?: H3Event) {
  if (pcm.length < 3200 || pcm.length > 3_840_000 || pcm.length % 2) throw createError({ statusCode: 400, statusMessage: 'Record between 0.1 and 120 seconds of 16 kHz mono PCM audio.' })
  const config = key(event); const seconds = Math.ceil(pcm.length / 32000)
  const header = Buffer.alloc(44); header.write('RIFF'); header.writeUInt32LE(pcm.length + 36, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
  const body = new FormData(); body.append('model_id', 'scribe_v2'); body.append('file', new Blob([new Uint8Array(Buffer.concat([header, pcm]))], { type: 'audio/wav' }), 'recording.wav'); body.append('tag_audio_events', 'false')
  // Record usage before dispatch; uncertain provider work never triggers an automatic retry.
  await reserveStudyVoiceUsage(ownerId, conversation.id, { kind: 'ELEVEN_INPUT', units: seconds }, event)
  const response = await checked(await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': String(config.elevenLabsApiKey) }, body, signal: AbortSignal.timeout(90_000) }))
  const result = await response.json() as { text?: string }
  return result.text?.trim() || ''
}
export async function elevenSynthesizeStudySpeech(ownerId: string, conversation: StudyConversation, text: string, event?: H3Event) {
  const config = key(event); const spoken = text.slice(0, 3000)
  if (!config.elevenLabsVoiceId) throw createError({ statusCode: 503, statusMessage: 'Amina’s voice is not selected on this server. Your saved reply remains available.', data: { code: 'SPEECH_NOT_CONFIGURED', retryable: false } })
  await reserveStudyVoiceUsage(ownerId, conversation.id, { kind: 'ELEVEN_OUTPUT', units: spoken.length }, event)
  const response = await checked(await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(String(config.elevenLabsVoiceId))}`, {
    method: 'POST', headers: { 'xi-api-key': String(config.elevenLabsApiKey), 'Content-Type': 'application/json' }, body: JSON.stringify({ text: spoken, model_id: config.elevenLabsModelId }), signal: AbortSignal.timeout(45_000),
  }))
  return Buffer.from(await response.arrayBuffer())
}

/** One reserved synthesis returns audio and provider timings together; no fallback paid retry. */
export async function elevenSynthesizeTimedStudySpeech(ownerId:string,conversation:StudyConversation,text:string,event?:H3Event):Promise<TimedStudySpeech>{
 const config=key(event),spoken=text.slice(0,3000)
 if(!config.elevenLabsVoiceId)throw createError({statusCode:503,statusMessage:'Amina’s voice is not selected on this server. Your saved reply remains available.',data:{code:'SPEECH_NOT_CONFIGURED',retryable:false}})
 await reserveStudyVoiceUsage(ownerId,conversation.id,{kind:'ELEVEN_OUTPUT',units:spoken.length},event)
 const response=await checked(await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(String(config.elevenLabsVoiceId))}/with-timestamps`,{method:'POST',headers:{'xi-api-key':String(config.elevenLabsApiKey),'Content-Type':'application/json'},body:JSON.stringify({text:spoken,model_id:config.elevenLabsModelId}),signal:AbortSignal.timeout(45000)}))
 const reader=response.body?.getReader();if(!reader)throw createError({statusCode:503,statusMessage:'Amina’s spoken reply was empty.'})
 const chunks:Uint8Array[]=[];let bytes=0
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>8000000){await reader.cancel();throw createError({statusCode:502,statusMessage:'Amina’s spoken reply was too large.'})}chunks.push(part.value)}}finally{reader.releaseLock()}
 const result=JSON.parse(Buffer.concat(chunks).toString('utf8'))
 if(typeof result.audio_base64!=='string' || !result.audio_base64.length || result.audio_base64.length>6000000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(result.audio_base64))throw createError({statusCode:502,statusMessage:'Amina’s spoken reply could not be read.'})
 return {audioBase64:result.audio_base64,mimeType:'audio/mpeg',spokenText:spoken,alignment:validSpeechAlignment(result.alignment || result.normalized_alignment)}
}
