import {randomUUID} from 'node:crypto'
import {createError} from 'h3'
import {beforeEach,afterEach,expect,it,vi} from 'vitest'
vi.mock('../server/services/studyInference', () => ({groqStudyText:vi.fn()}))
vi.mock('../server/services/airsContext', async importOriginal => ({...await importOriginal<typeof import('../server/services/airsContext')>(),reserveGuestAllowance:vi.fn()}))
import {groqStudyText} from '../server/services/studyInference'
import {reserveGuestAllowance} from '../server/services/airsContext'
import {prepareAminaTurn,streamAminaText,finishAminaTurn} from '../server/services/studyAmina'
import {prepareObjectiveOperation,finishObjectiveOperation,ensureObjectiveFlow,cancelPendingObjectiveOperation} from '../server/services/studyObjectiveFlow'
import {createStudyConversation,saveStudyPlan,getStudyConversation,getStudyChunks,getStudyPedagogyHistory,getStudyObjectiveOperation,deleteStudyConversation,acquireStudyLiveLease,releaseStudyLiveLease,claimRecordedStudyTurn,failRecordedStudyTurn,getCompletedRecordedStudyTurn,appendStudyTurn,updateStudyMode} from '../server/services/studyRepository'
import {changeStudyPacing,getStudyPacing} from '../server/services/studyPacing'
import {createKaiReview} from '../server/services/airsKai'
import {DEFAULT_STUDY_FUNCTION_REFS} from '../server/domain/neuromap/studyFunctions'
import {defaultObjectivePolicy,applySemanticEvidence,objectivePolicySchema,explicitObjectiveControl,createObjectiveLedger,type SemanticEvidence,type ObjectiveControl} from '../shared/studyObjectivePolicy'
import {deriveAirsJourney} from '../shared/airsJourney'
import {studyDocumentObjectivesComplete,studySessionReviewReady} from '../shared/studyCompletion'
import type {StudyTurn,StudySource} from '../shared/study'

let owner='',id='',source:StudySource,leaseId:string|undefined
const config={flowstAuthMode:'mock',studySourceFixtureMode:true,studyObjectiveFlowEnabled:true,public:{appSurface:'flowst'}}
let outcome: 'met'|'partial'|'not_met'='met', uncertainty=false, emotion:SemanticEvidence['interactionState']='correct'
beforeEach(()=>{
 vi.stubGlobal('createError',createError);vi.stubGlobal('useRuntimeConfig',()=>config)
 vi.mocked(groqStudyText).mockReset();outcome='met';uncertainty=false;emotion='correct'
 config.studySourceFixtureMode=true;vi.mocked(reserveGuestAllowance).mockReset()
 vi.mocked(groqStudyText).mockImplementation(async (_system,messages)=>{
  const data=JSON.parse(messages[0]!.content)
  const meaning=data.target.requiredMeaning as string[]
  return JSON.stringify({semanticAcceptance:uncertainty?'not_met':outcome,demonstrated:outcome==='met'&&!uncertainty?meaning:outcome==='partial'?meaning.slice(0,1):[],unresolved:outcome==='met'&&!uncertainty?[]:meaning,reason:outcome==='met'?'You described the canonical document as the authoritative reference for this design.':'The purpose is not clear yet.',sourceRefs:[data.passages[0].id],learnerQuotes:[data.answers.at(-1).text],transcriptionUncertainty:uncertainty?['The key term was unclear.']:[],interactionState:uncertainty?'transcription_noise':emotion})
 })
})
afterEach(async()=>{if(leaseId)await releaseStudyLiveLease(id,leaseId);leaseId=undefined;if(id)await deleteStudyConversation(owner,id);id='';vi.unstubAllGlobals()})

async function setup(options:{pacing?:boolean;targets?:boolean;legacy?:boolean}={}) {
 owner='objective-policy-'+randomUUID()
 const study=await createStudyConversation(owner,'design.txt','text/plain',Buffer.from('fixture'),{
  kind:'WEB',sections:[{id:'design',label:'Design · lines 1–8',text:'This is the canonical reference for the system design. Misu plans, Amina guides verbal practice and Kai reviews saved evidence.'}],excerpt:'System design',provenance:{fixture:false,url:'https://example.com/design',provider:'Local test',retrievedAt:new Date().toISOString(),hash:'fixture',omissions:[]}})
 id=study.id;source=(await getStudyChunks(owner,id))[0]!
 const first={id:'purpose',title:'Document purpose',outcome:'Explain the purpose of the canonical reference.',sources:[source]}
 const policy=defaultObjectivePolicy(first)
 if(options.targets){policy.successCriteria.requiredMeaning=['Describe the purpose','Apply the purpose'];policy.evidenceTargets=[{id:'purpose:target:1',title:'Purpose',requiredMeaning:['Describe the purpose'],question:'What is the document for?',sourceIds:[source.id]},{id:'purpose:target:2',title:'Application',requiredMeaning:['Apply the purpose'],question:'When would you consult this reference?',sourceIds:[source.id]}]}
 await saveStudyPlan(owner,id,{status:'APPROVED',version:1,approvedBy:owner,approvedAt:new Date().toISOString(),activeObjectiveId:'purpose',functionRefs:DEFAULT_STUDY_FUNCTION_REFS.map(ref=>({...ref})),...(options.pacing?{pacing:{mode:'TOPIC_BLOCKS' as const,practiceMinutes:5,breakMinutes:3}}:{}),objectives:[{...first,policy},{id:'roles',title:'Agent roles',outcome:'Explain the responsibilities of the three agents.',sources:[source]}]},study.revision)
 if(options.pacing)await changeStudyPacing(owner,id,'START','')
 return options.legacy ? getStudyConversation(owner,id) : ensureObjectiveFlow(await getStudyConversation(owner,id))
}
const draft=JSON.stringify({acknowledgement:'You described the reference’s purpose.',explanation:'',sourceIds:[]})
async function prepare(text:string,kind:StudyTurn['kind']='PRACTICE',operationId=randomUUID(),control?:ObjectiveControl){return prepareObjectiveOperation(owner,id,text,{id:randomUUID(),role:'USER',text,kind,mode:'DISCUSSION',sources:[],createdAt:new Date().toISOString()},undefined,operationId,undefined,control)}
async function turn(text:string,kind:StudyTurn['kind']='PRACTICE',control?:ObjectiveControl){const prepared=await prepare(text,kind,randomUUID(),control);const reply=await finishObjectiveOperation(owner,id,prepared,draft);return {prepared,reply,study:await getStudyConversation(owner,id)}}

it('accepts a faithful paraphrase, acknowledges it and moves forward without a Continue or timer',async()=>{
 await setup({pacing:true});await turn("I'm ready",'INTRO')
 const {reply,study}=await turn('It is the main authoritative reference for understanding the system design.')
 expect(study.objectiveFlow!.ledger[0]).toMatchObject({status:'met_for_session',targets:[{attempts:1,semanticAcceptance:'met'}]})
 expect(study.plan.activeObjectiveId).toBe('roles');expect(reply.objectiveId).toBe('purpose');expect(reply.nextPrompt?.objectiveId).toBe('roles')
 expect(reply.text).toContain('purpose');expect(reply.text.match(/\?/g)).toHaveLength(1)
 expect((await getStudyPacing(owner,id))).toMatchObject({objectiveId:'roles',phase:'PRACTICE'})
 expect((await getStudyPacing(owner,id))!.remainingMs).toBeGreaterThan(290000)
 const history=await getStudyPedagogyHistory(owner,id);expect(history.evidence[0]?.objectiveId).toBe('purpose');expect(history.traces[0]?.packet.version).toBe(2)
 expect(deriveAirsJourney(study,history)).toMatchObject({completedObjectiveIds:['purpose'],checkpointReady:false,kaiReady:false})
 const final=await turn('Misu plans, Amina guides my explanations, and Kai reviews the saved evidence.')
 expect(final.study.objectiveFlow?.sessionStatus).toBe('covered');expect(final.reply.nextPrompt).toBeUndefined()
 expect(studyDocumentObjectivesComplete(final.study,await getStudyPedagogyHistory(owner,id))).toBe(true)
})
it('limits the underlying target to two attempts, changes support and never asks a third equivalent question',async()=>{
 await setup();await turn("I'm ready",'INTRO');outcome='not_met';emotion='uncertain'
 await turn('I am not sure yet.')
 const second=await turn('I still do not know.')
 expect(second.study.objectiveFlow?.ledger[0]).toMatchObject({status:'needs_revisit',targets:[{attempts:2,promptsUsed:2}]})
 expect(second.reply.nextPrompt).toBeUndefined();expect(second.reply.text).toContain('approved source')
 const third=await turn('One more guess.');expect(third.reply.nextPrompt).toBeUndefined();expect(groqStudyText).toHaveBeenCalledTimes(2)
 await turn('Repeat the question','CONTROL','REPEAT')
 expect((await getStudyConversation(owner,id)).objectiveFlow?.ledger[0]?.targets[0]?.attempts).toBe(2)
 const deferred=await turn('Revisit this later','CONTROL','DEFER')
 expect(deferred.study.objectiveFlow?.ledger[0]?.status).toBe('deferred');expect(deferred.study.plan.activeObjectiveId).toBe('roles')
})
it('uses an unattempted distinct approved activity after exhaustion and does not reopen a satisfied target',async()=>{
 await setup({targets:true});await turn("I'm ready",'INTRO');outcome='not_met'
 await turn('First try.');const second=await turn('Second try.')
 expect(second.reply.nextPrompt?.targetId).toBe('purpose:target:2')
 const replay=await turn('Repeat the question','CONTROL','REPEAT')
 expect(replay.reply.text).toBe(second.reply.nextPrompt?.text)
 expect(replay.study.objectiveFlow?.ledger[0]?.targets.map(target=>[target.attempts,target.promptsUsed])).toEqual([[2,2],[0,1]])
 outcome='met';await turn('I would consult it before implementing the design.')
 const current=await getStudyConversation(owner,id)
 expect(current.objectiveFlow?.ledger[0]?.targets.map(item=>item.attempts)).toEqual([2,1])
 expect(current.objectiveFlow?.ledger[0]?.status).not.toBe('met_for_session')
})
it('does not count greetings, questions, hint requests or ambiguous controls as answers',async()=>{
 await setup();await turn("I'm ready",'INTRO');await turn('Hello','CONTROL');await turn('What does canonical mean?','QUESTION');await turn('Give me a hint','CONTROL','HINT');const result=await turn('stop','CONTROL')
 expect(result.prepared.objectiveOperation?.directive?.action).toBe('clarify');expect(groqStudyText).not.toHaveBeenCalled()
 expect(result.study.objectiveFlow?.ledger[0]?.targets[0]).toMatchObject({attempts:0,promptsUsed:1,hintsUsed:1})
})
it('keeps material transcription uncertainty unresolved and tracks self-correction',async()=>{
 await setup();await turn("I'm ready",'INTRO');uncertainty=true
 const noise=await turn('It is the [unclear] reference.');expect(noise.study.objectiveFlow?.ledger[0]?.status).not.toBe('met_for_session')
 uncertainty=false;emotion='self_corrected';const corrected=await turn('I mean it is the authoritative reference.')
 expect(corrected.study.objectiveFlow?.ledger[0]?.targets[0]?.selfCorrections).toBe(1)
 expect(corrected.study.objectiveFlow?.ledger[0]?.status).toBe('met_for_session')
})
it('saves input before review and retries its review once without another input or attempt',async()=>{
 await setup();await turn("I'm ready",'INTRO');const key=randomUUID()
 vi.mocked(groqStudyText).mockRejectedValueOnce(new Error('Review unavailable'))
 await expect(prepare('The authoritative reference.','PRACTICE',key)).rejects.toThrow('Review unavailable')
 let study=await getStudyConversation(owner,id);expect(study.objectiveFlow).toMatchObject({pendingOperationId:key,pendingReview:true});expect(study.turns.filter(t=>t.text==='The authoritative reference.')).toHaveLength(1)
 expect(study.objectiveFlow?.ledger[0]?.targets[0]?.attempts).toBe(0)
 const retry=await prepare('The authoritative reference.','PRACTICE',key);await finishObjectiveOperation(owner,id,retry,draft)
 study=await getStudyConversation(owner,id);expect(study.turns.filter(t=>t.text==='The authoritative reference.')).toHaveLength(1);expect(study.objectiveFlow?.ledger[0]?.targets[0]?.attempts).toBe(1)
})
it('reuses reviewed decisions after draft failure and makes duplicate completion idempotent',async()=>{
 await setup();const key=randomUUID();const reviewed=await prepare('The authoritative reference.','PRACTICE',key)
 const retry=await prepare('The authoritative reference.','PRACTICE',key);expect(groqStudyText).toHaveBeenCalledTimes(1)
 const results=await Promise.allSettled([finishObjectiveOperation(owner,id,reviewed,draft),finishObjectiveOperation(owner,id,retry,draft)])
 expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1)
 const completed=await prepare('The authoritative reference.','PRACTICE',key)
 expect((await finishObjectiveOperation(owner,id,completed,draft)).id).toBe((results.find(result=>result.status==='fulfilled') as PromiseFulfilledResult<StudyTurn>).value.id)
 expect((await getStudyPedagogyHistory(owner,id)).evidence).toHaveLength(1)
})
it('holds the next prompt across a due break or explicit pause and resumes without a Start checkpoint',async()=>{
 await setup({pacing:true});await turn("I'm ready",'INTRO')
 const prepared=await prepare('The authoritative reference.');const clock=await getStudyPacing(owner,id);await changeStudyPacing(owner,id,'PAUSE',clock!.revision)
 const reply=await finishObjectiveOperation(owner,id,prepared,draft);expect(reply.nextPrompt).toBeUndefined()
 const study=await getStudyConversation(owner,id);expect(study.plan.activeObjectiveId).toBe('roles');expect(study.objectiveFlow?.ledger[1]?.targets[0]?.promptsUsed).toBe(0)
 const paused=await getStudyPacing(owner,id);await changeStudyPacing(owner,id,'RESUME',paused!.revision)
 const resumed=await turn("I'm ready",'CONTROL','RESUME');expect(resumed.reply.nextPrompt?.objectiveId).toBe('roles')
})
it('allows internal advancement in a live lease and keeps Kai outside that lease',async()=>{
 await setup();leaseId=(await acquireStudyLiveLease(owner,id)).leaseId
 await turn('The authoritative reference.');const final=await turn('Misu plans, Amina guides, and Kai reviews.')
 expect(deriveAirsJourney(final.study,await getStudyPedagogyHistory(owner,id)).kaiReady).toBe(true)
 await expect(createKaiReview(owner,id)).rejects.toMatchObject({statusCode:409})
})
it('ends with explicit gaps and a zero-evidence factual closure, never completion',async()=>{
 await setup();await turn('Revisit this later','CONTROL','DEFER');const ended=await turn('End the session','CONTROL','END');const history=await getStudyPedagogyHistory(owner,id)
 expect(ended.study.objectiveFlow?.ledger.map(entry=>entry.deferReason)).toEqual(['learner_deferred','learner_ended'])
 expect(ended.study.objectiveFlow?.sessionStatus).toBe('ended_with_gaps');expect(studyDocumentObjectivesComplete(ended.study,history)).toBe(false);expect(studySessionReviewReady(ended.study,history)).toBe(true)
 const review=await createKaiReview(owner,id);expect(review.closureOnly).toBe(true);expect(review.observations).toEqual([]);expect(review.notAssessed.join(' ')).toMatch(/understanding/i)
 expect(groqStudyText).not.toHaveBeenCalled()
})
it('preserves a validated met decision when ending after a failed recorded response',async()=>{
 await setup();const key=randomUUID(),hash='fixture-audio';const reservation=await claimRecordedStudyTurn(owner,id,key,hash)
 if(reservation.status!=='CLAIMED')throw new Error('Expected a claim')
 const incoming:StudyTurn={id:randomUUID(),role:'USER',text:'The authoritative reference.',kind:'PRACTICE',mode:'DISCUSSION',sources:[],createdAt:new Date().toISOString()}
 await prepareObjectiveOperation(owner,id,incoming.text,incoming,undefined,key,reservation.claim)
 await failRecordedStudyTurn(owner,id,reservation.claim)
 const saved=await cancelPendingObjectiveOperation(await getStudyConversation(owner,id))
 expect(saved.objectiveFlow?.ledger[0]?.status).toBe('met_for_session');expect(await getCompletedRecordedStudyTurn(owner,id,key,hash)).toBeTruthy()
})
it('does not create a fresh budget for a legacy chat and retains its original transcript',async()=>{
 await setup({legacy:true})
 for(let index=0;index<2;index++){
  await appendStudyTurn(owner,id,{id:randomUUID(),role:'AMIRA',text:'What is its purpose?',kind:'PRACTICE',mode:'DISCUSSION',objectiveId:'purpose',sources:[source],createdAt:new Date().toISOString()})
  await appendStudyTurn(owner,id,{id:randomUUID(),role:'USER',text:'Saved historical answer.',kind:'PRACTICE',mode:'DISCUSSION',objectiveId:'purpose',sources:[],createdAt:new Date().toISOString()})
 }
 await updateStudyMode(owner,id,'DISCUSSION',{questionNumber:0,totalQuestions:5,awaitingAnswer:false,attempts:[0,1].map(()=>({objectiveId:'purpose',question:'What is its purpose?',answer:'Saved historical answer.',feedback:'Saved feedback.',sources:[source],mode:'DISCUSSION' as const}))})
 const migrated=await ensureObjectiveFlow(await getStudyConversation(owner,id))
 expect(migrated.objectiveFlow?.ledger[0]?.targets[0]?.hintsUsed).toBeNull()
 outcome='not_met'
 const resumed=await turn("I'm ready",'INTRO')
 expect(resumed.reply.nextPrompt).toBeUndefined();expect(resumed.study.turns.some(t=>t.text==='Saved historical answer.')).toBe(true)
 expect(resumed.study.objectiveFlow?.ledger[0]?.targets[0]?.attempts).toBe(2)
})
it('supports all evaluation modes and requires explicit source-fidelity wording',()=>{
 const objective={id:'o',title:'Purpose',outcome:'Explain purpose.',sources:[{id:'s',label:'Source',excerpt:'Meaning'}]}
 const base=defaultObjectivePolicy(objective)
 for(const mode of ['comprehension','retrieval','source_fidelity','application','reasoning','transfer'] as const)expect(objectivePolicySchema.parse({...base,evaluationMode:mode}).evaluationMode).toBe(mode)
 expect(()=>objectivePolicySchema.parse({...base,successCriteria:{...base.successCriteria,lexicalMatchRequired:true}})).toThrow()
 expect(explicitObjectiveControl('Please skip this objective')).toBe('SKIP');expect(explicitObjectiveControl('Please end my session')).toBe('END');expect(explicitObjectiveControl('Please continue practice')).toBe('RESUME')
 expect(explicitObjectiveControl('I’d like to end my session.')).toBe('END');expect(explicitObjectiveControl('Could we pause the session?')).toBe('PAUSE');expect(explicitObjectiveControl('Can you explain that again?')).toBe('EXPLAIN_AGAIN')
 expect(()=>objectivePolicySchema.parse({...base,evidenceTargets:[{...base.evidenceTargets[0],question:'What is its purpose? Why use it?'}]})).toThrow()
})

it('preserves a reviewed answer when a spoken pause interrupts its response',async()=>{
 await setup();await turn("I'm ready",'INTRO')
 const answer=await prepare('The authoritative reference.')
 const pause=await turn('Pause the session','CONTROL')
 expect(pause.study.objectiveFlow?.pendingOperationId).toBe(answer.objectiveOperation.id)
 expect(pause.study.objectiveFlow?.paused).toBe(true)
 const reply=await finishObjectiveOperation(owner,id,answer,draft)
 expect(reply.nextPrompt).toBeUndefined()
 const saved=await getStudyConversation(owner,id)
 expect(saved.plan.activeObjectiveId).toBe('roles');expect(saved.objectiveFlow?.ledger[0]?.targets[0]?.attempts).toBe(1)
 const trace=(await getStudyPedagogyHistory(owner,id)).traces.find(item=>item.outputTurnId===reply.id)
 expect(trace?.packet.controller?.nextPrompt).toBeUndefined()
 const resume=await turn('Continue practice','CONTROL')
 expect(resume.reply.nextPrompt?.objectiveId).toBe('roles');expect(groqStudyText).toHaveBeenCalledTimes(1)
})
it('answers a pending learner question before asking the next objective',async()=>{
 await setup();await turn("I'm ready",'INTRO')
 const answer=await prepare('The authoritative reference.')
 const question=await prepare('What does canonical mean?','QUESTION')
 const ack=await finishObjectiveOperation(owner,id,answer,draft)
 expect(ack.nextPrompt).toBeUndefined()
 const response=await finishObjectiveOperation(owner,id,question,JSON.stringify({acknowledgement:'',explanation:'Canonical identifies the approved reference in this source.',sourceIds:[source.id]}))
 expect(response.text).toContain('approved reference');expect(response.nextPrompt?.objectiveId).toBe('roles')
 expect((await getStudyConversation(owner,id)).objectiveFlow?.ledger.map(entry=>entry.targets[0]?.attempts)).toEqual([1,0])
 expect((await getStudyPedagogyHistory(owner,id)).evidence).toHaveLength(1)
})
it('allows a spoken end to preserve validated understanding and close with remaining gaps',async()=>{
 await setup();const answer=await prepare('The authoritative reference.')
 const ended=await turn('Please end my session','CONTROL')
 expect(ended.study.objectiveFlow?.ledger.map(entry=>entry.status)).toEqual(['met_for_session','deferred'])
 expect(ended.study.objectiveFlow?.sessionStatus).toBe('ended_with_gaps');expect(ended.reply.nextPrompt).toBeUndefined()
 expect((await getStudyObjectiveOperation(owner,id,answer.objectiveOperation.id))?.status).toBe('COMPLETE')
 expect(groqStudyText).toHaveBeenCalledTimes(1)
})
it('does not run simultaneous semantic reviews for the same saved input',async()=>{
 await setup();const key=randomUUID(),implementation=vi.mocked(groqStudyText).getMockImplementation()!
 let release!:()=>void,started!:()=>void
 const gate=new Promise<void>(resolve=>{release=resolve}),reviewStarted=new Promise<void>(resolve=>{started=resolve})
 vi.mocked(groqStudyText).mockImplementationOnce(async(...args)=>{started();await gate;return implementation(...args)})
 const reviewing=prepare('The authoritative reference.','PRACTICE',key)
 await reviewStarted
 await expect(prepare('The authoritative reference.','PRACTICE',key)).rejects.toMatchObject({statusCode:409})
 const pause=await turn('Pause the session','CONTROL');expect(pause.study.objectiveFlow?.paused).toBe(true)
 release();const prepared=await reviewing;const reply=await finishObjectiveOperation(owner,id,prepared,draft)
 expect(reply.nextPrompt).toBeUndefined();expect(groqStudyText).toHaveBeenCalledTimes(1)
 expect((await getStudyConversation(owner,id)).objectiveFlow?.ledger[0]?.targets[0]?.attempts).toBe(1)
})
it('ties reviewed legacy understanding to the historical answer, never the resume message',async()=>{
 await setup({legacy:true});const historicalId=randomUUID()
 await appendStudyTurn(owner,id,{id:historicalId,role:'USER',text:'The authoritative reference.',kind:'PRACTICE',mode:'DISCUSSION',objectiveId:'purpose',sources:[],createdAt:new Date().toISOString()})
 const resumed=await turn("I'm ready",'INTRO')
 const history=await getStudyPedagogyHistory(owner,id)
 expect(resumed.study.objectiveFlow?.ledger[0]?.metAtTurnId).toBe(historicalId)
 expect(history.evidence[0]?.learnerTurnId).toBe(historicalId)
 expect(history.traces.find(item=>item.evidenceRefs.length)?.inputTurnId).toBe(historicalId)
 expect(resumed.study.practice.attempts.at(-1)?.answer).toBe('The authoritative reference.')
})
it('keeps a met answer acknowledged while explicitly stated fatigue holds the next question',async()=>{
 await setup();await turn("I'm ready",'INTRO');emotion='fatigue_explicitly_stated'
 const result=await turn('It is the authoritative reference, and I am tired.')
 expect(result.study.objectiveFlow?.ledger[0]?.status).toBe('met_for_session');expect(result.study.objectiveFlow?.paused).toBe(true)
 expect(result.reply.nextPrompt).toBeUndefined();expect(result.study.plan.activeObjectiveId).toBe('roles')
})
it('rejects invented quotations and keeps the answer available for review recovery',async()=>{
 await setup();vi.mocked(groqStudyText).mockResolvedValueOnce(JSON.stringify({semanticAcceptance:'met',demonstrated:['Explain the purpose of the canonical reference.'],unresolved:[],reason:'Covered.',sourceRefs:[source.id],learnerQuotes:['Words the learner never said.'],transcriptionUncertainty:[],interactionState:'correct'}))
 await expect(prepare('The authoritative reference.')).rejects.toMatchObject({statusCode:502})
 const saved=await getStudyConversation(owner,id)
 expect(saved.objectiveFlow?.pendingReview).toBe(true);expect(saved.objectiveFlow?.ledger[0]?.targets[0]?.attempts).toBe(0)
})
it('allows deferral during a pause and keeps the next prompt suspended',async()=>{
 await setup();await turn("I'm ready",'INTRO');await turn('Pause the session','CONTROL')
 const deferred=await turn('Revisit this later','CONTROL')
 expect(deferred.study.objectiveFlow?.ledger[0]?.status).toBe('deferred');expect(deferred.study.plan.activeObjectiveId).toBe('roles')
 expect(deferred.study.objectiveFlow?.paused).toBe(true);expect(deferred.reply.nextPrompt).toBeUndefined()
 const resumed=await turn('Continue practice','CONTROL')
 expect(resumed.reply.nextPrompt?.objectiveId).toBe('roles');expect(groqStudyText).not.toHaveBeenCalled()
})
it('saves a live answer before a quota failure and allows end without a model request',async()=>{
 await setup();await turn("I'm ready",'INTRO')
 await appendStudyTurn(owner,id,{id:randomUUID(),role:'AMIRA',kind:'WELCOME',mode:'DISCUSSION',text:'Welcome.',sources:[],createdAt:new Date().toISOString()})
 config.studySourceFixtureMode=false
 vi.mocked(reserveGuestAllowance).mockImplementation(async()=>{
  expect((await getStudyConversation(owner,id)).turns.some(t=>t.role==='USER' && t.text==='The authoritative reference.')).toBe(true)
  throw createError({statusCode:429,statusMessage:'Fixture quota failure'})
 })
 await expect(prepareAminaTurn(owner,id,'The authoritative reference.',undefined,true,'quota-answer')).rejects.toMatchObject({statusCode:429})
 const saved=await getStudyConversation(owner,id)
 expect(saved.objectiveFlow).toMatchObject({pendingOperationId:'quota-answer',pendingReview:true})
 expect(groqStudyText).not.toHaveBeenCalled()
 const ended=await prepareAminaTurn(owner,id,'End the session',undefined,true,'quota-end')
 let raw='';for await(const chunk of streamAminaText(ended.system,ended.conversation.turns,'End the session',undefined,ended.sourceContext,ended.objectiveOperation))raw+=chunk
 const reply=await finishAminaTurn(owner,id,ended,raw)
 expect(reply.text).toContain('remaining gaps');expect(groqStudyText).not.toHaveBeenCalled();expect(reserveGuestAllowance).toHaveBeenCalledTimes(1)
 expect((await getStudyConversation(owner,id)).objectiveFlow?.sessionStatus).toBe('ended_with_gaps')
 expect((await getStudyPedagogyHistory(owner,id)).traces.at(-1)?.provider).toBe('controller')
})
