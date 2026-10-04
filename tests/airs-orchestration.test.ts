import { describe,it,expect,vi,afterEach } from 'vitest'
import { createError,createEvent } from 'h3'
import { learnerContextSchema,kaiReviewSchema,validateReviewEvidence } from '../shared/airsOrchestration'
import { runAirsAgent } from '../server/services/airsAgentRunner'
import { getGuestSession,verifyGuestToken } from '../server/utils/airsGuest'
import { IncomingMessage,ServerResponse } from 'node:http'
import { Socket } from 'node:net'
afterEach(()=>vi.unstubAllGlobals())
function configure(){vi.stubGlobal('useRuntimeConfig',()=>({groqApiKey:'fixture-key',groqModel:'fixture',airsGuestSecret:'a'.repeat(32),public:{appSurface:'air',airsGuestEnabled:true}}));vi.stubGlobal('createError',createError)}
describe('Airs context and agent boundaries',()=>{
 it('rejects extra permissions and oversized context',()=>{expect(learnerContextSchema.safeParse({background:'x',admin:true}).success).toBe(false);expect(learnerContextSchema.safeParse({background:'x'.repeat(401)}).success).toBe(false)})
 it('rejects invented evidence and unapproved criteria',()=>{
  const review=kaiReviewSchema.parse({observations:[{text:'A supported observation',criterionId:'CLARITY',evidenceIds:['saved']}],notAssessed:['Tempo'],nextPractice:{goal:'Explain clearly',exercise:'Try again',evidenceIds:['saved']}})
  expect(()=>validateReviewEvidence(review,new Set(['other']),new Set(['CLARITY']))).toThrow()
  expect(()=>validateReviewEvidence(review,new Set(['saved']),new Set(['ACCURACY']))).toThrow()
 })
 it('rejects wrong-role tools before contacting the model',async()=>{configure();const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);await expect(runAirsAgent('KAI','',[{name:'propose_session_plan',description:'',parameters:{},run:()=>({})}],'propose_session_plan')).rejects.toThrow('Invalid agent tool catalog');expect(fetcher).not.toHaveBeenCalled()})
 it('rejects an invented model tool',async()=>{configure();vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'1',function:{name:'delete_repository',arguments:'{}'}}]}}]}))));await expect(runAirsAgent('MISU','',[{name:'propose_session_plan',description:'',parameters:{required:['title']},run:()=>({})}],'propose_session_plan')).rejects.toThrow('unavailable function')})
 it('returns confirmed function results and a validated proposal',async()=>{configure();vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'1',function:{name:'propose_session_plan',arguments:'{"title":"Valid"}'}}]}}]}))));const result=await runAirsAgent('MISU','',[{name:'get_learner_context',description:'',parameters:{},run:()=>({background:'Confirmed'})},{name:'propose_session_plan',description:'',parameters:{required:['title']},run:args=>args}],'propose_session_plan');expect(result.proposal).toEqual({title:'Valid'});expect(result.trace.map(t=>t.tool)).toEqual(['get_learner_context','propose_session_plan'])})
 it('guest identities are unique, signed and disabled in Flowst',()=>{configure();const make=()=>{const req=new IncomingMessage(new Socket());req.url='/api/auth/session';return createEvent(req,new ServerResponse(req))};const a=getGuestSession(make(),true)!,b=getGuestSession(make(),true)!;expect(a.identity.userId).not.toBe(b.identity.userId);expect(verifyGuestToken(a.token)?.userId).toBe(a.identity.userId);const changed=a.token.slice(0,-1)+(a.token.endsWith('0')?'1':'0');expect(verifyGuestToken(changed)).toBeNull();vi.stubGlobal('useRuntimeConfig',()=>({public:{appSurface:'flowst',airsGuestEnabled:true}}));expect(verifyGuestToken(a.token)).toBeNull()})
})
