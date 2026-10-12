import {randomUUID} from 'node:crypto'
import {createError} from 'h3'
import {beforeEach,afterEach,expect,it,vi} from 'vitest'
vi.mock('../server/services/studyInference', () => ({groqStudyText:vi.fn()}))
vi.mock('../server/services/studyRelatedResearch', () => ({relatedStudyReferences:vi.fn()}))
vi.mock('../server/services/airsContext', async importOriginal => ({...await importOriginal<typeof import('../server/services/airsContext')>(),reserveGuestAllowance:vi.fn()}))
import {groqStudyText} from '../server/services/studyInference'
import {relatedStudyReferences} from '../server/services/studyRelatedResearch'
import {reserveGuestAllowance} from '../server/services/airsContext'
import {prepareAminaTurn,streamAminaText,finishAminaTurn} from '../server/services/studyAmina'
import {prepareObjectiveOperation,finishObjectiveOperation,ensureObjectiveFlow,cancelPendingObjectiveOperation} from '../server/services/studyObjectiveFlow'
import {createStudyConversation,saveStudyPlan,getStudyConversation,getStudyChunks,getStudyPedagogyHistory,getStudyObjectiveOperation,deleteStudyConversation,acquireStudyLiveLease,releaseStudyLiveLease,claimRecordedStudyTurn,failRecordedStudyTurn,getCompletedRecordedStudyTurn,appendStudyTurn,updateStudyMode,saveStudyObjectiveState} from '../server/services/studyRepository'
import {changeStudyPacing,getStudyPacing} from '../server/services/studyPacing'
import {createKaiReview} from '../server/services/airsKai'
import {DEFAULT_STUDY_FUNCTION_REFS} from '../server/domain/neuromap/studyFunctions'
import {defaultObjectivePolicy,applySemanticEvidence,objectivePolicySchema,explicitObjectiveControl,createObjectiveLedger,type SemanticEvidence,type ObjectiveControl} from '../shared/studyObjectivePolicy'
import {deriveAirsJourney} from '../shared/airsJourney'
import {studyDocumentObjectivesComplete,studySessionReviewReady} from '../shared/studyCompletion'
import type {StudyTurn,StudySource} from '../shared/study'

let owner='',id='',source:StudySource,leaseId:string|undefined
const config={flowstAuthMode:'mock',studySourceFixtureMode:true,studyObjectiveFlowEnabled:true,studyRelatedResearchEnabled:false,public:{appSurface:'flowst'}}
let outcome: 'met'|'partial'|'not_met'='met', uncertainty=false, emotion:SemanticEvidence['interactionState']='correct'
beforeEach(()=>{
 vi.stubGlobal('createError',createError);vi.stubGlobal('useRuntimeConfig',()=>config)
 vi.mocked(groqStudyText).mockReset();outcome='met';uncertainty=false;emotion='correct'
 config.studySourceFixtureMode=true;vi.mocked(reserveGuestAllowance).mockReset()
 config.studyRelatedResearchEnabled=false;vi.mocked(relatedStudyReferences).mockReset()
 vi.mocked(groqStudyText).mockImplementation(async (_system,messages)=>{
  const data=JSON.parse(messages[0]!.content)
  const meaning=data.target.requiredMeaning as string[]
  return JSON.stringify({semanticAcceptance:uncertainty?'not_met':outcome,demonstrated:outcome==='met'&&!uncertainty?meaning:outcome==='partial'?meaning.slice(0,1):[],unresolved:outcome==='met'&&!uncertainty?[]:meaning,reason:outcome==='met'?'You described the canonical document as the authoritative reference for this design.':'The purpose is not clear yet.',sourceRefs:[data.passages[0].id],learnerQuotes:[data.answers.at(-1).text],transcriptionUncertainty:uncertainty?['The key term was unclear.']:[],interactionState:uncertainty?'transcription_noise':emotion})
 })
})
afterEach(async()=>{if(leaseId)await releaseStudyLiveLease(id,leaseId);leaseId=undefined;if(id)await deleteStudyConversation(owner,id);id='';vi.useRealTimers();vi.unstubAllGlobals()})

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

it('matches quotation typography to the original saved transcript and keeps its turn attribution',async()=>{
 await setup();await turn("I'm ready",'INTRO');
 const answer='It’s the authoritative\n  reference for the system design.';
 vi.mocked(groqStudyText).mockImplementationOnce(async (_system,messages)=>{
  const data=JSON.parse(messages[0]!.content);
  return JSON.stringify({semanticAcceptance:'met',demonstrated:data.target.requiredMeaning,unresolved:[],reason:'The saved answer describes the reference’s purpose.',sourceRefs:[source.id],learnerQuotes:["It's the authoritative reference for the system design."],transcriptionUncertainty:[],interactionState:'correct'});
 });
 const result=await turn(answer);
 expect(result.prepared.objectiveOperation?.semantic?.learnerQuotes).toEqual([answer]);
 expect(result.prepared.objectiveOperation?.semantic?.learnerTurnIds).toEqual([result.prepared.userTurn.id]);
 expect(result.study.objectiveFlow?.ledger[0]?.status).toBe('met_for_session');
 expect(groqStudyText).toHaveBeenCalledTimes(1);
});

it('constrains review references and criteria to the supplied target in the provider contract',async()=>{
 await setup();await turn("I'm ready",'INTRO');await turn('It is the authoritative reference for the system design.');
 const output=vi.mocked(groqStudyText).mock.calls[0]![4] as any;
 expect(output.parameters.properties.sourceRefs.items.enum).toEqual([source.id]);
 expect(output.parameters.properties.demonstrated.items.enum).toEqual(['Explain the purpose of the canonical reference.']);
 expect(output.parameters.properties.unresolved.items.enum).toEqual(['Explain the purpose of the canonical reference.']);
});

const related:StudySource={id:'related-web:fixture',label:'Reference institution',excerpt:'The canonical system design defines agent responsibilities.',location:{url:'https://example.org/reference'},origin:'RELATED_WEB',retrievedAt:new Date().toISOString(),contentHash:'fixture'};
it('saves related references once across device retries, cites them separately and excludes them from assessment',async()=>{
 await setup();await turn("I'm ready",'INTRO');config.studyRelatedResearchEnabled=true;
 vi.mocked(relatedStudyReferences).mockResolvedValue([related]);
 const key=randomUUID();const first=await prepare('Please explain with an example.','QUESTION',key);
 expect((await getStudyObjectiveOperation(owner,id,key))?.relatedResearch?.status).toBe('COMPLETE');
 const reloaded=await prepare('Please explain with an example.','QUESTION',key);
 expect(reloaded.retrieval.sources).toContainEqual(related);expect(relatedStudyReferences).toHaveBeenCalledTimes(1);
 expect(relatedStudyReferences).toHaveBeenCalledWith('Document purpose. Explain the purpose of the canonical reference.',undefined);
 const reply=await finishObjectiveOperation(owner,id,reloaded,JSON.stringify({acknowledgement:'',explanation:'This reference explains how the canonical design assigns responsibilities.',sourceIds:[related.id]}));
 expect(reply.text).toContain('For related context, example.org reports:');expect(reply.sources).toContainEqual(related);expect(reply.provenance).toBe('MIXED');
 const saved=await getStudyConversation(owner,id);
 expect(saved.plan.objectives[0]!.sources.map(item=>item.id)).toEqual([source.id]);expect(saved.objectiveFlow?.ledger[0]?.targets[0]?.attempts).toBe(0);
 expect((await getStudyPedagogyHistory(owner,id)).evidence).toHaveLength(0);
 await turn('It is the authoritative reference for the system design.');
 const review=JSON.parse(vi.mocked(groqStudyText).mock.calls.at(-1)![1][0]!.content);
 expect(review.passages.map((item:any)=>item.id)).toEqual([source.id]);
 expect(first.packet.sourceIds).not.toContain(related.id);
});
it('continues from the approved source after unavailable research without dispatching another search on retry',async()=>{
 await setup();await turn("I'm ready",'INTRO');config.studyRelatedResearchEnabled=true;
 vi.mocked(relatedStudyReferences).mockResolvedValue([]);
 const key=randomUUID();await prepare('Please explain.','QUESTION',key);const retry=await prepare('Please explain.','QUESTION',key);
 const reply=await finishObjectiveOperation(owner,id,retry,'invalid model draft');
 expect(relatedStudyReferences).toHaveBeenCalledTimes(1);expect(reply.text).toContain('I couldn’t verify related web references');
 expect(reply.sources.some(item=>item.origin==='RELATED_WEB')).toBe(false);
});
it('rejects an invented related citation instead of displaying it as a reference',async()=>{
 await setup();await turn("I'm ready",'INTRO');config.studyRelatedResearchEnabled=true;vi.mocked(relatedStudyReferences).mockResolvedValue([related]);
 const prepared=await prepare('Please explain.','QUESTION');
 const reply=await finishObjectiveOperation(owner,id,prepared,JSON.stringify({acknowledgement:'',explanation:'PRIVATE unsupported external fact.',sourceIds:['related-web:invented']}));
 expect(reply.text).not.toContain('PRIVATE');expect(reply.text).not.toContain('For related context');expect(reply.sources).not.toContainEqual(related);
});
it('does not duplicate an in-flight search when the same saved operation is opened elsewhere',async()=>{
 await setup();await turn("I'm ready",'INTRO');config.studyRelatedResearchEnabled=true;
 let complete!:(sources:StudySource[])=>void;
 vi.mocked(relatedStudyReferences).mockImplementation(()=>new Promise(resolve=>{complete=resolve}));
 const key=randomUUID(),pending=prepare('Please explain.','QUESTION',key);
 await vi.waitFor(()=>expect(relatedStudyReferences).toHaveBeenCalledTimes(1));
 const other=await prepare('Please explain.','QUESTION',key);
 expect(other.objectiveOperation?.relatedResearch?.status).toBe('UNAVAILABLE');expect(relatedStudyReferences).toHaveBeenCalledTimes(1);
 complete([related]);expect((await pending).retrieval.sources).toContainEqual(related);
});
it('atomically rejects a stale research claim even when it has the newest conversation revision',async()=>{
 await setup();await turn("I'm ready",'INTRO');
 const prepared=await prepare('Please explain.','QUESTION'),operation=prepared.objectiveOperation!;
 const current=await getStudyConversation(owner,id);
 const first={...operation,relatedResearch:{status:'STARTED' as const,startedAt:'first-claim',sources:[]}};
 await saveStudyObjectiveState(owner,id,current.revision,{flow:current.objectiveFlow!,operation:first,expectedOperationStatus:'REVIEWED',claimRelatedResearch:true});
 const refreshed=await getStudyConversation(owner,id);
 const stale={...operation,relatedResearch:{status:'STARTED' as const,startedAt:'second-claim',sources:[]}};
 await expect(saveStudyObjectiveState(owner,id,refreshed.revision,{flow:refreshed.objectiveFlow!,operation:stale,expectedOperationStatus:'REVIEWED',claimRelatedResearch:true})).rejects.toMatchObject({statusCode:409});
 expect((await getStudyObjectiveOperation(owner,id,operation.id))?.relatedResearch?.startedAt).toBe('first-claim');
});



it.each(['invalid JSON','missing interaction state','reason above 500 characters','empty reason','more than four learner quotes','unsupported quotation','insufficient evidence'])('explains %s and retries the saved answer without consuming another attempt',async name=>{
 await setup({pacing:true});await turn("I'm ready",'INTRO');
 const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
 const key=randomUUID(),answer='It is the authoritative reference for the system design.';
 const valid={semanticAcceptance:'met',demonstrated:['Explain the purpose of the canonical reference.'],unresolved:[],reason:'The learner described the approved meaning.',sourceRefs:[source.id],learnerQuotes:[answer],transcriptionUncertainty:[],interactionState:'correct'};
 const invalid:any={...valid};
 if(name==='missing interaction state')delete invalid.interactionState;
 if(name==='reason above 500 characters')invalid.reason='PRIVATE '.repeat(100);
 if(name==='empty reason')invalid.reason='';
 if(name==='more than four learner quotes')invalid.learnerQuotes=Array(5).fill(answer);
 if(name==='unsupported quotation')invalid.learnerQuotes=['PRIVATE invented learner answer'];
 if(name==='insufficient evidence')invalid.demonstrated=[];
 vi.mocked(groqStudyText).mockResolvedValueOnce(name==='invalid JSON'?'PRIVATE invalid JSON' : JSON.stringify(invalid));
 try {
 const failure=await prepare(answer,'PRACTICE',key).catch(cause=>cause);
 expect(failure).toMatchObject({statusCode:502,data:{code:'MISU_REVIEW_INVALID',stage:'EVIDENCE_REVIEW',savedAnswer:true,reference:expect.any(String)}});
 const hints:Record<string,string>={'invalid JSON':'not valid JSON','missing interaction state':'missing its interaction status','reason above 500 characters':'explanation must contain at most 500 characters','empty reason':'explanation must contain at least 1 character','more than four learner quotes':'learner quotations must contain at most 4 items','unsupported quotation':'quotation could not be matched','insufficient evidence':'complete evidence'};
 expect(failure.statusMessage).toContain(hints[name]);expect(failure.statusMessage.length).toBeLessThanOrEqual(240);
 expect(JSON.stringify(failure.data)+JSON.stringify(warn.mock.calls)).not.toMatch(/PRIVATE|authoritative reference/);
 const saved=await getStudyConversation(owner,id),pending=await getStudyObjectiveOperation(owner,id,key);
 expect(saved.objectiveFlow?.error).toBe(failure.statusMessage);
 expect(saved.turns.filter(turn=>turn.role==='USER'&&turn.text===answer)).toHaveLength(1);
 expect(saved.objectiveFlow?.pendingReview).toBe(true);expect(saved.objectiveFlow?.ledger[0]?.targets[0]?.attempts).toBe(0);
 expect(pending?.status).toBe('PENDING');expect(pending?.reviewLeaseUntil).toBeUndefined();
 const reviewed=await prepare(answer,'PRACTICE',key);await finishObjectiveOperation(owner,id,reviewed,draft);
 const recovered=await getStudyConversation(owner,id);
 expect(recovered.turns.filter(turn=>turn.role==='USER'&&turn.text===answer)).toHaveLength(1);
 expect(recovered.objectiveFlow?.ledger[0]?.targets[0]?.attempts).toBe(1);expect(recovered.objectiveFlow?.error).toBeUndefined();
 expect(groqStudyText).toHaveBeenCalledTimes(2);
 const request=vi.mocked(groqStudyText).mock.calls[0]!;
 expect(request[4]).toMatchObject({name:'submit_objective_evidence',parameters:{additionalProperties:false,properties:{reason:{maxLength:500},learnerQuotes:{maxItems:4,items:{maxLength:1000}}}}});
 expect(request[0]).toContain('maxItems');
 } finally {warn.mockRestore();}
});
