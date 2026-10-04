import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { z } from 'zod'
import type { H3Event } from 'h3'
import { contextDescription, type ContextSnapshot, type AirsOperation } from '../../shared/airsOrchestration'
import { getAirsContext, writeAirsArtifact, reserveGuestAllowance } from './airsContext'
import { runAirsAgent, noArgs } from './airsAgentRunner'
const summarySchema=z.object({summary:z.string().trim().min(1).max(700)}).strict()
export async function summarizeAirsContext(ownerId:string,revision:string,event?:H3Event) {
 const context=await getAirsContext(ownerId,event)
 if((context.revision || '')!==revision)throw createError({statusCode:409,statusMessage:'Your context changed. Reload it.'})
 if(context.summaryStatus==='READY' || context.summaryStatus==='CONFIRMED')return context
 if(context.summaryStatus==='PROCESSING' && Date.now()-Date.parse(context.operation?.startedAt || '')<120000)throw createError({statusCode:409,statusMessage:'Misu is already preparing your summary.'})
 const operation:AirsOperation={id:randomUUID(),revision,phase:'INTERPRETING_CONTEXT',completed:['CONTEXT_SAVED'],status:'PROCESSING',startedAt:new Date().toISOString()}
 await writeAirsArtifact(ownerId,'PROFILE',{...context,summaryStatus:'PROCESSING',operation},event,revision,context.operation?.id || '')
 try {
  const config=useRuntimeConfig(event)
  const fixture=config.studySourceFixtureMode===true && config.flowstAuthMode==='mock' && process.env.NODE_ENV!=='production'
  if(!fixture)await reserveGuestAllowance(ownerId,'MODEL',event)
  const result=fixture ? {summary:contextDescription(context).slice(0,700)} : summarySchema.parse((await runAirsAgent('MISU','Summarize only what the learner said about background, goals, interests and intended conversations. Do not infer abilities, personality, demographics or missing details. Use neutral second-person wording. This is an editable proposed understanding, not a confirmed profile.',[
   {name:'get_learner_context',description:'Read the learner’s exact saved words.',parameters:noArgs,run:()=>({words:contextDescription(context)})},
   {name:'propose_context_summary',description:'Propose a concise summary for learner confirmation.',parameters:z.toJSONSchema(summarySchema) as Record<string,unknown>,run:args=>summarySchema.parse(args)},
  ],'propose_context_summary',event)).proposal)
  const ready:ContextSnapshot={...context,summary:result.summary,summaryStatus:'READY',summaryOrigin:fixture?'FIXTURE':'MODEL',operation:{...operation,phase:'SUMMARY_READY',completed:['CONTEXT_SAVED','INTERPRETING_CONTEXT'],status:'COMPLETE'}}
  await writeAirsArtifact(ownerId,'PROFILE',ready,event,revision,operation.id);return ready
 } catch(error) {
  await writeAirsArtifact(ownerId,'PROFILE',{...context,summaryStatus:'FAILED',operation:{...operation,status:'FAILED'}},event,revision,operation.id).catch(()=>undefined)
  throw error
 }
}
