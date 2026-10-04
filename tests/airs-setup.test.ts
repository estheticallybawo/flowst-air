import {afterEach,describe,expect,it,vi} from 'vitest'
import {contextDescription} from '../shared/airsOrchestration'
import {getAirsContext,saveAirsContext} from '../server/services/airsContext'
import {summarizeAirsContext} from '../server/services/airsContextSummary'
import {createStudyConversation,getStudyConversation} from '../server/services/studyRepository'
import {generateMisuPlan} from '../server/services/studyMisu'
afterEach(()=>vi.unstubAllGlobals())
const configure=(fixture=true)=>vi.stubGlobal('useRuntimeConfig',()=>({flowstAuthMode:'mock',studySourceFixtureMode:fixture,groqApiKey:'test-key',groqModel:'fixture',public:{appSurface:'flowst'}}))
describe('Misu-led setup persistence',()=>{
 it('saves exact words, proposes a summary, and confirms an edited understanding',async()=>{
  configure();const owner='setup-confirm';const words='  Graduate developer.\nI create content and prepare for interviews.  '
  const saved=await saveAirsContext(owner,{selfDescription:words,revision:''})
  expect(saved.selfDescription).toBe(words);expect(saved.summaryStatus).toBe('NONE')
  const proposed=await summarizeAirsContext(owner,saved.revision!)
  expect(proposed.summaryStatus).toBe('READY');expect(proposed.summaryConfirmedAt).toBeUndefined()
  const confirmed=await saveAirsContext(owner,{revision:saved.revision,summary:'I create content and want to explain my projects.',confirmSummary:true})
  expect(confirmed.selfDescription).toBe(words);expect(confirmed.summaryStatus).toBe('CONFIRMED')
  expect((await getAirsContext('setup-other')).selfDescription).toBeUndefined()
 })
 it('retains legacy context and rejects stale saves, confirmations and oversized words',async()=>{
  configure();const old=await saveAirsContext('setup-legacy',{background:'Graduate',goals:'Interview',audience:'Hiring team'})
  expect(contextDescription(old)).toBe('Graduate\nInterview\nHiring team')
  const current=await saveAirsContext('setup-legacy',{selfDescription:'My new goals',revision:old.revision})
  await expect(saveAirsContext('setup-legacy',{selfDescription:'Stale edit',revision:old.revision})).rejects.toMatchObject({statusCode:409})
  await expect(saveAirsContext('setup-legacy',{summary:'Stale summary',revision:old.revision,confirmSummary:true})).rejects.toMatchObject({statusCode:409})
  await expect(saveAirsContext('setup-legacy',{selfDescription:'x'.repeat(2001),revision:current.revision})).rejects.toMatchObject({statusCode:400})
 })
 it('does not let a late model summary overwrite newer context',async()=>{
  configure(false);let resolve!:(response:Response)=>void
  const fetcher=vi.fn(()=>new Promise<Response>(done=>{resolve=done}));vi.stubGlobal('fetch',fetcher)
  const saved=await saveAirsContext('setup-race',{selfDescription:'Old context',revision:''})
  const pending=summarizeAirsContext('setup-race',saved.revision!);const failure=expect(pending).rejects.toMatchObject({statusCode:409})
  await vi.waitFor(()=>expect(fetcher).toHaveBeenCalled())
  await expect(summarizeAirsContext('setup-race',saved.revision!)).rejects.toMatchObject({statusCode:409})
  const next=await saveAirsContext('setup-race',{selfDescription:'New context',revision:saved.revision})
  resolve(new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'summary',function:{name:'propose_context_summary',arguments:JSON.stringify({summary:'Old proposed summary'})}}]}}]})))
  await failure;expect((await getAirsContext('setup-race')).revision).toBe(next.revision);expect((await getAirsContext('setup-race')).summary).toBeUndefined()
 })
 it('retains saved words when the model fails',async()=>{
  configure(false);vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:503})))
  const saved=await saveAirsContext('setup-failure',{selfDescription:'My career context',revision:''})
  await expect(summarizeAirsContext('setup-failure',saved.revision!)).rejects.toMatchObject({statusCode:503})
  expect((await getAirsContext('setup-failure')).selfDescription).toBe('My career context')
  expect((await getAirsContext('setup-failure')).summaryStatus).toBe('FAILED')
 })
 it('reports confirmed planning phases and preserves the previous draft after a failed adjustment',async()=>{
  configure();const owner='setup-plan';const extraction:any={kind:'WEB',sections:[{id:'section-1',label:'Source',text:'Retrieval practice means explaining an idea from memory.'}],excerpt:'Retrieval',provenance:{fixture:true}}
  const chat=await createStudyConversation(owner,'study source','text/plain',Buffer.from('fixture'),extraction)
  const draft=await generateMisuPlan(owner,chat.id)
  expect(draft.plan.operation?.phase).toBe('PLAN_READY');expect(draft.plan.operation?.completed).toEqual(['READING_SOURCE','PREPARING_GOALS','CHECKING_REFERENCES'])
  const revised=await generateMisuPlan(owner,chat.id,true,undefined,'Focus on interviews',{purpose:'INTERVIEW',scope:'FOCUSED',timeBudgetMinutes:10,context:''})
  expect(revised.plan.version).toBe(draft.plan.version+1);expect(revised.preferences?.purpose).toBe('INTERVIEW')
  configure(false);vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:503})))
  await expect(generateMisuPlan(owner,chat.id,true)).rejects.toMatchObject({statusCode:503})
  const retained=await getStudyConversation(owner,chat.id)
  expect(retained.plan.status).toBe('DRAFT');expect(retained.plan.version).toBe(revised.plan.version);expect(retained.plan.objectives).toEqual(revised.plan.objectives)
 })
})
