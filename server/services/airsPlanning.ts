import { createError } from 'h3'
import { z } from 'zod'
import type { H3Event } from 'h3'
import { evaluationCriteriaSchema } from '../../shared/airsOrchestration'
import { getAirsContext, relevantAirsMemory } from './airsContext'
import { runAirsAgent, noArgs } from './airsAgentRunner'
const proposalSchema=z.object({
 title:z.string().min(1).max(200),
 objectives:z.array(z.object({title:z.string().min(1).max(200),outcome:z.string().min(1).max(600),sourceIds:z.array(z.string()).min(1),estimatedMinutes:z.number().int().positive(),planningNote:z.string().max(500).optional()}).strict()).min(1).max(6),
 rationale:z.string().min(1).max(700),conversationStrategy:z.string().min(1).max(700),evaluationCriteria:evaluationCriteriaSchema,
}).strict()
export async function planWithAirsFunctions(ownerId:string,policy:string,inventory:string,event?:H3Event){
 const context=await getAirsContext(ownerId,event),memory=await relevantAirsMemory(ownerId,event)
 const result=await runAirsAgent('MISU',policy+' Propose source-grounded goals, conversation strategy, rationale and observable evaluation criteria. Adapt to confirmed background, goals and audience. Prior reviews are dated observations, not proof of present ability. Do not infer missing career background.',[
  {name:'get_learner_context',description:'Read learner-confirmed context; blank fields are unknown.',parameters:noArgs,run:()=>context},
  {name:'get_relevant_learning_evidence',description:'Read the last review as tentative evidence; use only if relevant to this goal.',parameters:noArgs,run:()=>memory},
  {name:'get_source_inventory',description:'Read bounded source inventory, references and session preferences.',parameters:noArgs,run:()=>({inventory})},
  {name:'get_practice_strategies',description:'Read approved phases and evaluation boundaries.',parameters:noArgs,run:()=>({stages:['brief introduction','independent attempt','requested support','teach-back','fresh application'],notAssessed:['intelligence','mastery','pronunciation','tempo']})},
  {name:'propose_session_plan',description:'Return a proposal for server validation and learner approval.',parameters:z.toJSONSchema(proposalSchema) as Record<string,unknown>,run:args=>proposalSchema.parse(args)},
 ],'propose_session_plan',event)
 return {...proposalSchema.parse(result.proposal),contextSnapshot:context,toolTrace:result.trace,memoryReviewId:memory?.reviewId}
}
