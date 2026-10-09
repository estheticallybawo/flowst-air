import { createError } from 'h3'
import { z } from 'zod'
import type { H3Event } from 'h3'
import { evaluationCriteriaSchema } from '../../shared/airsOrchestration'
import { getAirsContext, relevantAirsMemory } from './airsContext'
import { runAirsAgent, noArgs } from './airsAgentRunner'
import { objectivePolicySchema } from '../../shared/studyObjectivePolicy'
const proposalSchema=z.object({
 title:z.string().max(200).optional(),
 objectives:z.array(z.object({title:z.string().min(1).max(200),outcome:z.string().min(1).max(600),sourceIds:z.array(z.string()).min(1),estimatedMinutes:z.number().int().positive(),planningNote:z.string().max(400).optional(),policy:objectivePolicySchema.optional()}).strict()).min(1).max(6),
 rationale:z.string().min(1).max(700),conversationStrategy:z.string().min(1).max(700),evaluationCriteria:evaluationCriteriaSchema,
}).strict()
/** Bound display prose only. Objectives, citations and supplied custom policies remain strictly validated. */
function normalizePlanPresentation(value: unknown) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return value
 const result = { ...value } as Record<string, unknown>
 const bounded = (text: string, limit: number) => text.length > limit ? text.slice(0, limit - 1).trimEnd() + '…' : text
 for (const [field, limit] of [['title', 200], ['rationale', 700], ['conversationStrategy', 700]] as const) {
  if (typeof result[field] === 'string') result[field] = bounded(result[field] as string, limit)
 }
 if (result.title === null) delete result.title
 if (Array.isArray(result.objectives)) result.objectives = result.objectives.map(objective =>
  objective && typeof objective === 'object' && !Array.isArray(objective) && typeof objective.planningNote === 'string'
   ? { ...objective, planningNote: bounded(objective.planningNote, 400) } : objective)
 return result
}
export async function planWithAirsFunctions(ownerId:string,policy:string,inventory:string,event?:H3Event){
 const context=await getAirsContext(ownerId,event),memory=await relevantAirsMemory(ownerId,event)
 const result=await runAirsAgent('MISU',policy+' Propose source-grounded goals, conversation strategy, rationale and observable evaluation criteria. Keep rationale and conversationStrategy within 700 characters. The title and each objective\'s custom policy are optional; when omitted the server derives a title and one practice check from the validated objective outcome and source references. A supplied custom policy must use version 0.2: choose comprehension, retrieval, source_fidelity, application, reasoning or transfer; define successCriteria {requiredMeaning: exact short criterion strings, lexicalMatchRequired:false except explicit source fidelity, minimumEvidence:1}; evidenceTargets [{id:unique-target-id,title,requiredMeaning:criterion strings,question:one natural source-grounded question,sourceIds:exact supplied IDs}], maxAttemptsForSameTarget:2, allowedAdaptations:[hint,worked_example,different_activity,revisit_source,defer,pause]. Use one target for a simple outcome, up to four for genuinely distinct requirements. Every criterion belongs to exactly one target. Do not create different targets that demand the same meaning. Only choose source_fidelity if the goal explicitly requires exact reproduction. Adapt to confirmed background, goals and audience. Prior reviews are dated observations, not proof of present ability. Do not infer missing career background.',[
  {name:'get_learner_context',description:'Read learner-confirmed context; blank fields are unknown.',parameters:noArgs,run:()=>context},
  {name:'get_relevant_learning_evidence',description:'Read the last review as tentative evidence; use only if relevant to this goal.',parameters:noArgs,run:()=>memory},
  {name:'get_source_inventory',description:'Read bounded source inventory, references and session preferences.',parameters:noArgs,run:()=>({inventory})},
  {name:'get_practice_strategies',description:'Read approved phases and evaluation boundaries.',parameters:noArgs,run:()=>({stages:['brief introduction','independent attempt','requested support','teach-back','fresh application'],notAssessed:['intelligence','mastery','pronunciation','tempo']})},
  {name:'propose_session_plan',description:'Return a proposal for server validation and learner approval.',parameters:z.toJSONSchema(proposalSchema) as Record<string,unknown>,run:args=>proposalSchema.parse(normalizePlanPresentation(args))},
 ],'propose_session_plan',event)
 return {...proposalSchema.parse(result.proposal),contextSnapshot:context,toolTrace:result.trace,memoryReviewId:memory?.reviewId}
}
