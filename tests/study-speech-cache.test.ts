import { afterEach, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createStudyConversation, appendStudyTurn, deleteStudyConversation, getStudyConversation, reserveStudyVoiceUsage } from '../server/services/studyRepository'
import { getOrPrepareStudySpeech } from '../server/services/studySpeechCache'
import { studySpeechOutcome } from '../shared/studySpeechOutcome'
afterEach(()=>vi.unstubAllGlobals())
it('does not offer repeated paid recovery while application audio-storage permissions need repair',()=>{
 for(const code of ['SPEECH_CACHE_ACCESS','SPEECH_CACHE_AUTH']){
  expect(studySpeechOutcome({data:{code,statusMessage:'The app’s audio-storage connection needs attention.'}})).toEqual({message:'The app’s audio-storage connection needs attention.',retryable:false})
 }
})
it('offers explicit service recovery for legacy quota failures without overriding unsupported playback',()=>{
 for(const cause of [{data:{code:'AMIRA_VOICE_ALLOWANCE_USED'}},{data:{data:{code:'AMIRA_VOICE_ALLOWANCE_USED'}}}]) {
  const outcome=studySpeechOutcome(cause)
  expect(outcome.retryable).toBe(true)
  expect(outcome.message).toContain('unavailable right now')
  expect(outcome.message).not.toContain('allowance')
 }
 expect(studySpeechOutcome({name:'NotSupportedError',data:{code:'AMIRA_VOICE_ALLOWANCE_USED'}}).retryable).toBe(false)
})
async function fixture(){
 vi.stubGlobal('useRuntimeConfig',()=>({flowstAuthMode:'mock',elevenLabsApiKey:'test',elevenLabsVoiceId:'voice',studyAwsVoiceTrialMaxCharacters:6000,public:{appSurface:'flowst'}}))
 const owner=randomUUID(),study=await createStudyConversation(owner,'source.txt','text/plain',Buffer.from('fixture'),{kind:'WEB',sections:[{id:'one',label:'Section 1',text:'Recall an idea before checking notes.'}],excerpt:'Recall'})
 const turnId=randomUUID();await appendStudyTurn(owner,study.id,{id:turnId,role:'AMIRA',kind:'WELCOME',text:'Recall the idea.',sources:[],mode:'DISCUSSION',createdAt:new Date().toISOString()})
 return {owner,id:study.id,turnId}
}
it('reuses saved audio and timings on replay without a second paid dispatch or usage record',async()=>{
 const f=await fixture(),fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({audio_base64:Buffer.from('audio').toString('base64')})))
 vi.stubGlobal('fetch',fetcher)
 const packet=await getOrPrepareStudySpeech(f.owner,f.id,f.turnId)
 expect(await getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).toEqual(packet)
 expect(fetcher).toHaveBeenCalledTimes(1)
 expect((await getStudyConversation(f.owner,f.id)).voiceUsage?.pollyCharacters).toBe('Recall the idea.'.length)
 await expect(getOrPrepareStudySpeech('other',f.id,f.turnId)).rejects.toMatchObject({statusCode:404})
 await deleteStudyConversation(f.owner,f.id)
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).rejects.toMatchObject({statusCode:404})
})
it('replays prepared audio beyond the former total without recording usage again',async()=>{
 const f=await fixture(),fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({audio_base64:Buffer.from('audio').toString('base64')})))
 vi.stubGlobal('fetch',fetcher)
 const packet=await getOrPrepareStudySpeech(f.owner,f.id,f.turnId)
 await reserveStudyVoiceUsage(f.owner,f.id,{kind:'ELEVEN_OUTPUT',units:6000})
 expect((await getStudyConversation(f.owner,f.id)).voiceUsage?.pollyCharacters).toBe(6000+'Recall the idea.'.length)
 expect(await getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).toEqual(packet)
 expect(await getOrPrepareStudySpeech(f.owner,f.id,f.turnId,true)).toEqual(packet)
 expect(fetcher).toHaveBeenCalledTimes(1)
 expect((await getStudyConversation(f.owner,f.id)).voiceUsage?.pollyCharacters).toBe(6000+'Recall the idea.'.length)
 await deleteStudyConversation(f.owner,f.id)
})
it('rejects concurrent dispatch, retains failures, and requires explicit retry after uncertain work',async()=>{
 const f=await fixture();let release!:(response:Response)=>void
 const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{release=resolve}));vi.stubGlobal('fetch',fetcher)
 const first=getOrPrepareStudySpeech(f.owner,f.id,f.turnId)
 await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1))
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).rejects.toMatchObject({statusCode:409,data:{code:'SPEECH_PENDING'}})
 release(new Response('',{status:503}));await expect(first).rejects.toMatchObject({statusCode:503})
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).rejects.toMatchObject({statusCode:503})
 expect(fetcher).toHaveBeenCalledTimes(1)
 expect((await getStudyConversation(f.owner,f.id)).voiceUsage?.pollyCharacters).toBe('Recall the idea.'.length)
 fetcher.mockImplementation(async()=>new Response(JSON.stringify({audio_base64:Buffer.from('audio').toString('base64')})))
 await getOrPrepareStudySpeech(f.owner,f.id,f.turnId,true)
 expect(fetcher).toHaveBeenCalledTimes(2)
 expect((await getStudyConversation(f.owner,f.id)).voiceUsage?.pollyCharacters).toBe('Recall the idea.'.length*2)
 await deleteStudyConversation(f.owner,f.id)
})
it('prepares speech beyond prior totals and preserves meaningful playback failures',async()=>{
 const f=await fixture();vi.stubGlobal('useRuntimeConfig',()=>({flowstAuthMode:'mock',elevenLabsApiKey:'test',elevenLabsVoiceId:'voice',studyAwsVoiceTrialMaxCharacters:1,public:{appSurface:'flowst'}}));const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({audio_base64:Buffer.from('audio').toString('base64')})));vi.stubGlobal('fetch',fetcher)
 await reserveStudyVoiceUsage(f.owner,f.id,{kind:'ELEVEN_OUTPUT',units:6000})
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).resolves.toBeDefined()
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).resolves.toBeDefined()
 expect(fetcher).toHaveBeenCalledTimes(1)
 expect((await getStudyConversation(f.owner,f.id)).voiceUsage?.pollyCharacters).toBe(6000+'Recall the idea.'.length)
 expect(studySpeechOutcome({data:{statusMessage:'Connection unavailable'}}).message).toBe('Connection unavailable')
 expect(studySpeechOutcome({name:'NotSupportedError'}).retryable).toBe(false)
 await deleteStudyConversation(f.owner,f.id)
})
it.each([
 ['voice_not_found',404,'SPEECH_PROVIDER_CONFIGURATION',false],
 ['invalid_api_key',401,'SPEECH_PROVIDER_CONFIGURATION',false],
 ['quota_exceeded',401,'SPEECH_PROVIDER_CREDITS',false],
 ['detected_unusual_activity',401,'SPEECH_PROVIDER_RESTRICTED',false],
 ['concurrent_limit_exceeded',429,'SPEECH_PROVIDER_BUSY',true],
] as const)('preserves safe %s failures across saved replay and requires explicit recovery',async(providerCode,httpStatus,code,retryable)=>{
 const f=await fixture()
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:{code:providerCode,message:'Private provider text must never reach the learner.'}}),{status:httpStatus}))
 vi.stubGlobal('fetch',fetcher)
 const first=await getOrPrepareStudySpeech(f.owner,f.id,f.turnId).catch(cause=>cause)
 expect(first).toMatchObject({statusCode:code==='SPEECH_PROVIDER_BUSY'?429:503,data:{code,retryable}})
 expect(first.statusMessage).not.toContain('Private provider text')
 expect(studySpeechOutcome(first).retryable).toBe(retryable)
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).rejects.toMatchObject({data:{code,retryable}})
 expect(fetcher).toHaveBeenCalledTimes(1)
 fetcher.mockResolvedValue(new Response(JSON.stringify({audio_base64:Buffer.from('prepared-audio').toString('base64')})))
 const packet=await getOrPrepareStudySpeech(f.owner,f.id,f.turnId,true)
 expect(packet.audioBase64).toBe(Buffer.from('prepared-audio').toString('base64'))
 expect(await getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).toEqual(packet)
 expect(fetcher).toHaveBeenCalledTimes(2)
 await deleteStudyConversation(f.owner,f.id)
})
it('bounds provider error bodies and returns a safe temporary service error for invalid JSON',async()=>{
 for(const body of ['<html>Provider unavailable</html>','x'.repeat(16_385)]) {
  const f=await fixture()
  const fetcher=vi.fn().mockResolvedValue(new Response(body,{status:503}))
  vi.stubGlobal('fetch',fetcher)
  await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).rejects.toMatchObject({statusCode:503,data:{code:'SPEECH_PROVIDER_UNAVAILABLE',retryable:true}})
  expect(fetcher).toHaveBeenCalledTimes(1)
  await deleteStudyConversation(f.owner,f.id)
 }
})
it('reports a missing voice before dispatch and permits explicitly preparing it after configuration is fixed',async()=>{
 const f=await fixture()
 vi.stubGlobal('useRuntimeConfig',()=>({flowstAuthMode:'mock',elevenLabsApiKey:'test',public:{appSurface:'flowst'}}))
 const fetcher=vi.fn()
 vi.stubGlobal('fetch',fetcher)
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).rejects.toMatchObject({statusCode:503,data:{code:'SPEECH_NOT_CONFIGURED',retryable:false}})
 expect(fetcher).not.toHaveBeenCalled()
 vi.stubGlobal('useRuntimeConfig',()=>({flowstAuthMode:'mock',elevenLabsApiKey:'test',elevenLabsVoiceId:'voice',public:{appSurface:'flowst'}}))
 fetcher.mockResolvedValue(new Response(JSON.stringify({audio_base64:Buffer.from('prepared-audio').toString('base64')})))
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId,true)).resolves.toMatchObject({mimeType:'audio/mpeg'})
 expect(fetcher).toHaveBeenCalledTimes(1)
 await deleteStudyConversation(f.owner,f.id)
})
