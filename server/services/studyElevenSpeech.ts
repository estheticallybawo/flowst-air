import {validSpeechAlignment,type TimedStudySpeech} from '../../shared/studySpeech'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { StudyConversation } from '../../shared/study'
import { appendStudyVoiceUsage } from './studyRepository'
import { awsVoiceTrialCheck } from './studyAwsSpeech'

function key(event?: H3Event) {
  const config = useRuntimeConfig(event)
  if (!config.elevenLabsApiKey) throw createError({ statusCode: 503, statusMessage: 'Amina’s voice connection is not configured.' })
  return config
}
async function checked(response: Response) {
  if (!response.ok) throw createError({ statusCode: response.status === 429 ? 429 : 503, statusMessage: 'Amina’s voice connection is unavailable. Please retry.' })
  return response
}
export async function elevenTranscribeStudyPcm(ownerId: string, conversation: StudyConversation, pcm: Buffer, event?: H3Event) {
  if (pcm.length < 3200 || pcm.length > 3_840_000 || pcm.length % 2) throw createError({ statusCode: 400, statusMessage: 'Record between 0.1 and 120 seconds of 16 kHz mono PCM audio.' })
  const config = key(event); const seconds = Math.ceil(pcm.length / 32000)
  awsVoiceTrialCheck(conversation, 'TRANSCRIBE', seconds, Number(config.studyAwsVoiceTrialMaxSeconds))
  const header = Buffer.alloc(44); header.write('RIFF'); header.writeUInt32LE(pcm.length + 36, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
  const body = new FormData(); body.append('model_id', 'scribe_v2'); body.append('file', new Blob([new Uint8Array(Buffer.concat([header, pcm]))], { type: 'audio/wav' }), 'recording.wav'); body.append('tag_audio_events', 'false')
  // Reserve before sending so failed/uncertain requests cannot bypass the allowance.
  await appendStudyVoiceUsage(ownerId, conversation.id, { kind: 'ELEVEN_INPUT', units: seconds }, event)
  const response = await checked(await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': String(config.elevenLabsApiKey) }, body, signal: AbortSignal.timeout(90_000) }))
  const result = await response.json() as { text?: string }
  return result.text?.trim() || ''
}
export async function elevenSynthesizeStudySpeech(ownerId: string, conversation: StudyConversation, text: string, event?: H3Event) {
  const config = key(event); const spoken = text.slice(0, 3000)
  if (!config.elevenLabsVoiceId) throw createError({ statusCode: 503, statusMessage: 'Amina’s voice is not selected yet.' })
  awsVoiceTrialCheck(conversation, 'POLLY', spoken.length, undefined, Number(config.studyAwsVoiceTrialMaxCharacters) || 6000)
  await appendStudyVoiceUsage(ownerId, conversation.id, { kind: 'ELEVEN_OUTPUT', units: spoken.length }, event)
  const response = await checked(await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(String(config.elevenLabsVoiceId))}`, {
    method: 'POST', headers: { 'xi-api-key': String(config.elevenLabsApiKey), 'Content-Type': 'application/json' }, body: JSON.stringify({ text: spoken, model_id: config.elevenLabsModelId }), signal: AbortSignal.timeout(45_000),
  }))
  return Buffer.from(await response.arrayBuffer())
}

/** One reserved synthesis returns audio and provider timings together; no fallback paid retry. */
export async function elevenSynthesizeTimedStudySpeech(ownerId:string,conversation:StudyConversation,text:string,event?:H3Event):Promise<TimedStudySpeech>{
 const config=key(event),spoken=text.slice(0,3000)
 if(!config.elevenLabsVoiceId)throw createError({statusCode:503,statusMessage:'Amina’s voice is not selected yet.'})
 awsVoiceTrialCheck(conversation,'POLLY',spoken.length,undefined,Number(config.studyAwsVoiceTrialMaxCharacters) || 6000)
 await appendStudyVoiceUsage(ownerId,conversation.id,{kind:'ELEVEN_OUTPUT',units:spoken.length},event)
 const response=await checked(await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(String(config.elevenLabsVoiceId))}/with-timestamps`,{method:'POST',headers:{'xi-api-key':String(config.elevenLabsApiKey),'Content-Type':'application/json'},body:JSON.stringify({text:spoken,model_id:config.elevenLabsModelId}),signal:AbortSignal.timeout(45000)}))
 const reader=response.body?.getReader();if(!reader)throw createError({statusCode:503,statusMessage:'Amina’s spoken reply was empty.'})
 const chunks:Uint8Array[]=[];let bytes=0
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>8000000){await reader.cancel();throw createError({statusCode:502,statusMessage:'Amina’s spoken reply was too large.'})}chunks.push(part.value)}}finally{reader.releaseLock()}
 const result=JSON.parse(Buffer.concat(chunks).toString('utf8'))
 if(typeof result.audio_base64!=='string' || !result.audio_base64.length || result.audio_base64.length>6000000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(result.audio_base64))throw createError({statusCode:502,statusMessage:'Amina’s spoken reply could not be read.'})
 return {audioBase64:result.audio_base64,mimeType:'audio/mpeg',spokenText:spoken,alignment:validSpeechAlignment(result.alignment || result.normalized_alignment)}
}
