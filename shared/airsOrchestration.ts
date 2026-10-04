import { z } from 'zod'
export const learnerContextSchema = z.object({
  background: z.string().trim().max(400).default(''),
  goals: z.string().trim().max(400).default(''),
  audience: z.string().trim().max(200).default(''),
  selfDescription: z.string().max(2000).optional(),
}).strict()
export type LearnerContext = z.infer<typeof learnerContextSchema>
export interface AirsOperation {
 id: string; revision: string; phase: string; completed: string[]
 status: 'PROCESSING' | 'COMPLETE' | 'FAILED'; startedAt: string
}
export interface ContextSnapshot extends LearnerContext {
 origin: 'LEARNER_CONFIRMED'; recordedAt: string; revision?: string
 summary?: string; summaryStatus?: 'NONE' | 'PROCESSING' | 'READY' | 'CONFIRMED' | 'FAILED'
 summaryConfirmedAt?: string; summaryOrigin?: 'MODEL' | 'FIXTURE'; operation?: AirsOperation
}
export function contextDescription(context: LearnerContext) {
 return context.selfDescription ?? [context.background, context.goals, context.audience].filter(Boolean).join('\n')
}
export const evaluationCriteriaSchema = z.array(z.object({
  id: z.enum(['ACCURACY', 'CLARITY', 'RELEVANCE', 'REASONING', 'TRANSFER']),
  description: z.string().min(1).max(250),
}).strict()).min(1).max(5)
export const kaiReviewSchema = z.object({
  observations: z.array(z.object({ text: z.string().min(1).max(500), evidenceIds: z.array(z.string()).min(1).max(5), criterionId: z.enum(['ACCURACY','CLARITY','RELEVANCE','REASONING','TRANSFER']) }).strict()).min(1).max(6),
  notAssessed: z.array(z.string().max(250)).max(6),
  nextPractice: z.object({ goal: z.string().min(1).max(300), exercise: z.string().min(1).max(500), evidenceIds: z.array(z.string()).min(1).max(5) }).strict(),
}).strict()
export type KaiReview = z.infer<typeof kaiReviewSchema> & { evidence?: Array<{id:string;attempt:string}>; id: string; conversationId: string; planVersion: number; basedOnTurnId: string; createdAt: string; nextPracticeStatus: 'PROPOSED' | 'ACCEPTED' | 'DISMISSED' }
export const AIRS_TOOL_ALLOWLIST = {
  MISU: ['get_learner_context','get_relevant_learning_evidence','get_source_inventory','get_practice_strategies','propose_session_plan','propose_context_summary'],
  AMINA: ['get_approved_practice_context','read_source_passage','select_practice_activity'],
  KAI: ['get_approved_evaluation_context','get_session_evidence','propose_evidence_review'],
} as const
export function validateReviewEvidence(review: z.infer<typeof kaiReviewSchema>, evidenceIds: Set<string>, criteria: Set<string>) {
  for (const observation of review.observations) {
    if (!criteria.has(observation.criterionId) || observation.evidenceIds.some(id => !evidenceIds.has(id))) throw new Error('Kai referenced unavailable criteria or evidence.')
  }
  if (review.nextPractice.evidenceIds.some(id => !evidenceIds.has(id))) throw new Error('Kai referenced unavailable next-practice evidence.')
  return review
}
