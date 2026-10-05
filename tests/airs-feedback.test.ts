import { it,expect,vi,afterEach } from 'vitest'
import { createError } from 'h3'
import { createStudyConversation,getStudyConversation,getStudyPedagogyHistory,getStudyChunks,saveStudyPlan,appendStudyTurn,deleteStudyConversation } from '../server/services/studyRepository'
import {deriveAirsJourney} from '../shared/airsJourney'
import { prepareAminaTurn,finishAminaTurn } from '../server/services/studyAmina'
import { DEFAULT_STUDY_FUNCTION_REFS } from '../server/domain/neuromap/studyFunctions'
import { createKaiReview,chooseNextPractice } from '../server/services/airsKai'
import { saveAirsContext,getAirsContext,relevantAirsMemory,deleteAirsConversationMemory } from '../server/services/airsContext'
afterEach(()=>vi.unstubAllGlobals())
it('keeps context and feedback owner-scoped and persists an evidence-linked next exercise',async()=>{
 vi.stubGlobal('useRuntimeConfig',()=>({flowstAuthMode:'mock',studySourceFixtureMode:true,public:{appSurface:'air'}}));vi.stubGlobal('createError',createError)
 await saveAirsContext('feedback-owner',{background:'Graduate developer',goals:'Interview explanation',audience:'Interviewer'})
 expect((await getAirsContext('another-owner')).background).toBe('')
 const extraction:any={kind:'WEB',sections:[{id:'section-1',label:'Section 1',text:'Retrieval means explaining an idea from memory.'}],excerpt:'Retrieval',provenance:{fixture:true}}
 const chat=await createStudyConversation('feedback-owner','sample.txt','text/plain',Buffer.from('fixture'),extraction)
 const source=(await getStudyChunks('feedback-owner',chat.id))[0]!
 const plan=await saveStudyPlan('feedback-owner',chat.id,{status:'APPROVED',version:1,approvedBy:'feedback-owner',approvedAt:new Date().toISOString(),activeObjectiveId:'objective-1',objectives:[{id:'objective-1',title:'Explain retrieval',outcome:'Explain retrieval from memory',sources:[source]}],functionRefs:DEFAULT_STUDY_FUNCTION_REFS.map(r=>({...r}))},chat.revision)
 await appendStudyTurn('feedback-owner',chat.id,{id:'welcome',role:'AMIRA',kind:'WELCOME',mode:'DISCUSSION',text:'Welcome',sources:[],createdAt:new Date().toISOString(),objectiveId:'objective-1'})
 const intro=await prepareAminaTurn('feedback-owner',chat.id,"I'm ready");await finishAminaTurn('feedback-owner',chat.id,intro,'Section 1 describes retrieval. How would you explain it?')
 const attempt=await prepareAminaTurn('feedback-owner',chat.id,'Retrieval means recalling an idea without looking at notes.');await finishAminaTurn('feedback-owner',chat.id,attempt,'Your explanation describes recalling from memory, as Section 1 says.')
 const completed=await getStudyConversation('feedback-owner',chat.id),history=await getStudyPedagogyHistory('feedback-owner',chat.id)
 expect(deriveAirsJourney(completed,history).kaiReady).toBe(false)
 expect(deriveAirsJourney(completed,history).completedObjectiveIds).toEqual([])
 await expect(createKaiReview('feedback-owner',chat.id)).rejects.toMatchObject({statusCode:409})
 const confirmed=await saveStudyPlan('feedback-owner',chat.id,{...completed.plan,courseCompletedBy:'feedback-owner',courseCompletedAt:new Date().toISOString()},completed.revision)
 expect(deriveAirsJourney(confirmed,history)).toMatchObject({kaiReady:true,completedObjectiveIds:['objective-1']})
 expect(deriveAirsJourney(confirmed,{traces:[],evidence:[]}).kaiReady).toBe(false)
 const review=await createKaiReview('feedback-owner',chat.id)
 expect(review.observations[0]?.evidenceIds.length).toBeGreaterThan(0)
 expect((await createKaiReview('feedback-owner',chat.id)).id).toBe(review.id)
 await expect(createKaiReview('another-owner',chat.id)).rejects.toMatchObject({statusCode:404})
 const accepted=await chooseNextPractice('feedback-owner',chat.id,review.id,'ACCEPTED')
 expect(accepted.nextPracticeStatus).toBe('ACCEPTED')
 expect((await relevantAirsMemory('feedback-owner'))?.reviewId).toBe(review.id)
 expect(await relevantAirsMemory('another-owner')).toBeNull()
 await deleteStudyConversation('feedback-owner',chat.id);await deleteAirsConversationMemory('feedback-owner',chat.id)
 expect(await relevantAirsMemory('feedback-owner')).toBeNull()
})
