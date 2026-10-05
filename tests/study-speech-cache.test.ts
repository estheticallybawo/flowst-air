import { afterEach, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createStudyConversation, appendStudyTurn, deleteStudyConversation, getStudyConversation } from '../server/services/studyRepository'
import { getOrPrepareStudySpeech } from '../server/services/studySpeechCache'
import { studySpeechOutcome } from '../shared/studySpeechOutcome'
afterEach(()=>vi.unstubAllGlobals())
async function fixture(){
 vi.stubGlobal('useRuntimeConfig',()=>({flowstAuthMode:'mock',elevenLabsApiKey:'test',elevenLabsVoiceId:'voice',studyAwsVoiceTrialMaxCharacters:6000,public:{appSurface:'flowst'}}))
 const owner=randomUUID(),study=await createStudyConversation(owner,'source.txt','text/plain',Buffer.from('fixture'),{kind:'WEB',sections:[{id:'one',label:'Section 1',text:'Recall an idea before checking notes.'}],excerpt:'Recall'})
 const turnId=randomUUID();await appendStudyTurn(owner,study.id,{id:turnId,role:'AMIRA',kind:'WELCOME',text:'Recall the idea.',sources:[],mode:'DISCUSSION',createdAt:new Date().toISOString()})
 return {owner,id:study.id,turnId}
}
it('reuses saved audio and timings on replay without a second paid dispatch or allowance',async()=>{
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
it('rejects concurrent dispatch, retains failures, and requires explicit retry after uncertain work',async()=>{
 const f=await fixture();let release!:(response:Response)=>void
 const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{release=resolve}));vi.stubGlobal('fetch',fetcher)
 const first=getOrPrepareStudySpeech(f.owner,f.id,f.turnId)
 await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1))
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).rejects.toMatchObject({statusCode:409,data:{code:'SPEECH_PENDING'}})
 release(new Response('',{status:503}));await expect(first).rejects.toMatchObject({statusCode:503})
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).rejects.toMatchObject({statusCode:503})
 expect(fetcher).toHaveBeenCalledTimes(1)
 fetcher.mockImplementation(async()=>new Response(JSON.stringify({audio_base64:Buffer.from('audio').toString('base64')})))
 await getOrPrepareStudySpeech(f.owner,f.id,f.turnId,true)
 expect(fetcher).toHaveBeenCalledTimes(2)
})
it('preserves voice allowance errors and does not suggest retrying an exhausted allowance',async()=>{
 const f=await fixture();vi.stubGlobal('useRuntimeConfig',()=>({flowstAuthMode:'mock',elevenLabsApiKey:'test',elevenLabsVoiceId:'voice',studyAwsVoiceTrialMaxCharacters:1,public:{appSurface:'flowst'}}));const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).rejects.toMatchObject({statusCode:429,data:{code:'AMIRA_VOICE_ALLOWANCE_USED'}})
 await expect(getOrPrepareStudySpeech(f.owner,f.id,f.turnId)).rejects.toMatchObject({statusCode:429,data:{code:'AMIRA_VOICE_ALLOWANCE_USED'}})
 expect(fetcher).not.toHaveBeenCalled()
 const outcome=studySpeechOutcome({data:{data:{code:'AMIRA_VOICE_ALLOWANCE_USED'}}})
 expect(outcome.retryable).toBe(false);expect(outcome.message).toContain('voice allowance')
 expect(studySpeechOutcome({data:{statusMessage:'Connection unavailable'}}).message).toBe('Connection unavailable')
 expect(studySpeechOutcome({name:'NotSupportedError'}).retryable).toBe(false)
})
