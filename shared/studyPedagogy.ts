import { z } from 'zod'
import { evaluationModeSchema, objectiveStatusSchema, objectiveActionSchema, semanticEvidenceSchema } from './studyObjectivePolicy'

export const studyFunctionRefSchema = z.object({
  id: z.string().min(1), version: z.string().min(1), kind: z.enum(['framework', 'technique']),
}).strict()

export const studyInstructionPacketSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]), agent: z.literal('AMIRA'), conversationId: z.string().min(1),
  planVersion: z.number().int().positive(),
  approval: z.object({ kind: z.literal('PERSONAL_STUDY'), legacy: z.boolean() }).strict(),
  objective: z.object({ id: z.string().min(1), title: z.string().min(1), outcome: z.string().min(1) }).strict(),
  mode: z.enum(['DISCUSSION', 'ORAL_EXAM', 'SCENARIO']),
  stage: z.enum(['INTRODUCTION', 'GUIDED_PRACTICE', 'INDEPENDENT_EXPLANATION']),
  functionRefs: z.array(studyFunctionRefSchema).min(1).max(2),
  requiredBehaviors: z.array(z.string().min(1)).min(1),
  prohibitedBehaviors: z.array(z.string().min(1)).min(1),
  evidenceToCapture: z.array(z.string().min(1)).min(1),
  sourceIds: z.array(z.string().min(1)).min(1),
  controller: z.object({ version: z.literal('0.2'), objectiveStatus: objectiveStatusSchema, evaluationMode: evaluationModeSchema,
    requiredMeaning: z.array(z.string()), lexicalMatchRequired: z.boolean(), minimumEvidence: z.number().int(), targetId: z.string().optional(),
    attemptNumber: z.number().int(), maxAttemptsForSameTarget: z.literal(2), allowedAdaptations: z.array(z.string()), nextAction: objectiveActionSchema,
    neuroMapPhase: z.string(), interactionTechnique: z.string(), acknowledgementRequiredOnSuccess: z.boolean(),
    nextPrompt: z.object({objectiveId:z.string(),targetId:z.string(),question:z.string(),evaluationMode:evaluationModeSchema,requiredMeaning:z.array(z.string()),attemptsRemaining:z.number().int().min(0).max(2)}).strict().optional(),
  }).strict().optional(),
}).strict()

export const studyExecutionTraceSchema = z.object({
  id: z.string().uuid(), conversationId: z.string().min(1), planVersion: z.number().int().positive(),
  objectiveId: z.string().min(1), functionRefs: z.array(studyFunctionRefSchema).min(1).max(2),
  packetHash: z.string().length(64), packet: studyInstructionPacketSchema,
  agent: z.literal('AMIRA'), provider: z.enum(['bedrock', 'groq', 'controller']), model: z.string().min(1),
  status: z.enum(['COMPILED', 'EXECUTED', 'FAILED']), inputTurnId: z.string().uuid(),
  outputTurnId: z.string().uuid().optional(), evidenceRefs: z.array(z.string().uuid()),
  errorCode: z.string().max(100).optional(), createdAt: z.string().datetime(),
}).strict()

export const studyLearningEvidenceSchema = z.object({
  id: z.string().uuid(), traceId: z.string().uuid(), conversationId: z.string().min(1),
  objectiveId: z.string().min(1), kind: z.literal('LEARNER_EXPLANATION'),
  learnerTurnId: z.string().uuid(), feedbackTurnId: z.string().uuid(),
  sourceIds: z.array(z.string().min(1)), createdAt: z.string().datetime(),
  targetId: z.string().optional(), evaluationMode: evaluationModeSchema.optional(),
  semantic: semanticEvidenceSchema.optional(), promptsUsed: z.number().int().nonnegative().nullable().optional(),
  hintsUsed: z.number().int().nonnegative().nullable().optional(), selfCorrections: z.number().int().nonnegative().nullable().optional(),
}).strict()

export type StudyFunctionRef = z.infer<typeof studyFunctionRefSchema>
export type StudyInstructionPacket = z.infer<typeof studyInstructionPacketSchema>
export type StudyExecutionTrace = z.infer<typeof studyExecutionTraceSchema>
export type StudyLearningEvidence = z.infer<typeof studyLearningEvidenceSchema>
