import { createError } from 'h3'
import type { StudyConversation } from '../../../shared/study'
import { COURSE_ASSESSMENT_ID, ORAL_ANSWER_COUNT, deriveStudyProgression } from '../../../shared/studyProgression'
import { studyInstructionPacketSchema, type StudyFunctionRef, type StudyInstructionPacket } from '../../../shared/studyPedagogy'

interface StudyFunctionDefinition {
  readonly ref: Readonly<StudyFunctionRef>
  readonly stages: readonly StudyInstructionPacket['stage'][]
  readonly requiredBehaviors: readonly string[]
  readonly prohibitedBehaviors: readonly string[]
  readonly evidenceToCapture: readonly string[]
}

function publishFunction(definition: StudyFunctionDefinition): Readonly<StudyFunctionDefinition> {
  return Object.freeze({
    ref: Object.freeze({ ...definition.ref }),
    stages: Object.freeze([...definition.stages]),
    requiredBehaviors: Object.freeze([...definition.requiredBehaviors]),
    prohibitedBehaviors: Object.freeze([...definition.prohibitedBehaviors]),
    evidenceToCapture: Object.freeze([...definition.evidenceToCapture]),
  })
}

// Published functions are deeply immutable: changing behavior requires a new version.
export const STUDY_FUNCTION_REGISTRY: Readonly<Record<string, StudyFunctionDefinition>> = Object.freeze({
  'explicit-instruction@1': publishFunction({
    ref: { id: 'explicit-instruction', version: '1', kind: 'framework' as const },
    stages: ['INTRODUCTION', 'GUIDED_PRACTICE', 'INDEPENDENT_EXPLANATION'] as StudyInstructionPacket['stage'][],
    requiredBehaviors: [
      'Introduce the source-backed concept clearly before asking for independent explanation.',
      'Move from a short model to guided practice, then invite the learner to explain independently.',
      'Give specific corrective feedback after an attempt and allow a revised explanation.',
    ],
    prohibitedBehaviors: ['Do not declare mastery or assign a grade.', 'Do not advance the objective without learner confirmation.'],
    evidenceToCapture: ['Learner explanation', 'Support or hint needed', 'Correction and revised explanation'],
  }),
  'self-explanation-teach-back@1': publishFunction({
    ref: { id: 'self-explanation-teach-back', version: '1', kind: 'technique' as const },
    stages: ['GUIDED_PRACTICE', 'INDEPENDENT_EXPLANATION'] as StudyInstructionPacket['stage'][],
    requiredBehaviors: [
      'Ask the learner to explain the idea in their own words to someone unfamiliar with it.',
      'Probe the reasoning behind a claim rather than accepting fluent wording alone.',
      'After an attempt, point to one supported strength and one gap, then invite a clearer teach-back.',
    ],
    prohibitedBehaviors: ['Do not supply the full answer before the learner has a chance to attempt it.'],
    evidenceToCapture: ['Explanation linked to the learner turn', 'Source-backed feedback linked to the agent turn'],
  }),
})

export const DEFAULT_STUDY_FUNCTION_REFS: readonly Readonly<StudyFunctionRef>[] = Object.freeze([
  Object.freeze({ id: 'explicit-instruction', version: '1', kind: 'framework' as const }),
  Object.freeze({ id: 'self-explanation-teach-back', version: '1', kind: 'technique' as const }),
])

export function compileAirsStudyPacket(conversation: StudyConversation): StudyInstructionPacket {
  const plan = conversation.plan
  const courseAssessment = conversation.mode !== 'DISCUSSION'
  const approvedObjective = plan.objectives.find(item => item.id === plan.activeObjectiveId)
  const objective = courseAssessment ? {
    id: COURSE_ASSESSMENT_ID,
    title: 'Whole-course practice',
    outcome: `Explain and apply the approved objectives across this document: ${plan.objectives.map(item => item.title).join('; ')}`,
    sources: [...new Map(plan.objectives.flatMap(item => item.sources).map(source => [source.id, source])).values()],
  } : approvedObjective
  if (plan.status !== 'APPROVED' || !objective || !objective.sources.length || plan.version < 1)
    throw createError({ statusCode: 409, statusMessage: 'Approve a source-backed Misu plan before Amina practices.' })
  if (courseAssessment && (!plan.courseCompletedAt || plan.courseCompletedBy !== conversation.ownerId
    || (conversation.mode === 'SCENARIO' && deriveStudyProgression(conversation).oralAnswersCompleted < ORAL_ANSWER_COUNT)))
    throw createError({ statusCode: 409, statusMessage: 'Finish and confirm the course, then complete the oral exam before scenario practice.' })
  if (!plan.approvedBy || !plan.approvedAt || plan.approvedBy !== conversation.ownerId || !plan.functionRefs)
    throw createError({ statusCode: 409, statusMessage: 'This plan predates NeuroMap function approval. Start a new study chat and approve its plan.' })
  const refs = plan.functionRefs
  if (refs.length !== 2 || refs.some((ref, index) => {
    const expected = DEFAULT_STUDY_FUNCTION_REFS[index]!
    return ref.id !== expected.id || ref.version !== expected.version || ref.kind !== expected.kind
  })) throw createError({ statusCode: 409, statusMessage: 'This plan contains unpublished or incompatible NeuroMap functions.' })
  const framework = STUDY_FUNCTION_REGISTRY[`${refs[0]!.id}@${refs[0]!.version}`]!
  const technique = STUDY_FUNCTION_REGISTRY[`${refs[1]!.id}@${refs[1]!.version}`]!
  const objectiveAttempts = conversation.practice.attempts.filter(item => item.objectiveId === objective.id).length
  const stage: StudyInstructionPacket['stage'] = !conversation.turns.some(turn => turn.kind === 'INTRO')
    ? 'INTRODUCTION' : objectiveAttempts ? 'INDEPENDENT_EXPLANATION' : 'GUIDED_PRACTICE'
  if (!framework.stages.includes(stage) || (stage !== 'INTRODUCTION' && !technique.stages.includes(stage)))
    throw createError({ statusCode: 409, statusMessage: 'The approved pedagogy functions are incompatible with this study stage.' })
  return studyInstructionPacketSchema.parse({
    version: 1, agent: 'AMIRA', conversationId: conversation.id, planVersion: plan.version,
    approval: { kind: 'PERSONAL_STUDY', legacy: false },
    objective: { id: objective.id, title: objective.title, outcome: objective.outcome },
    mode: conversation.mode, stage, functionRefs: stage === 'INTRODUCTION' ? [framework.ref] : [framework.ref, technique.ref],
    requiredBehaviors: stage === 'INTRODUCTION' ? framework.requiredBehaviors : [...framework.requiredBehaviors, ...technique.requiredBehaviors],
    prohibitedBehaviors: stage === 'INTRODUCTION' ? framework.prohibitedBehaviors : [...framework.prohibitedBehaviors, ...technique.prohibitedBehaviors],
    evidenceToCapture: stage === 'INTRODUCTION' ? framework.evidenceToCapture : [...framework.evidenceToCapture, ...technique.evidenceToCapture],
    sourceIds: objective.sources.map(source => source.id),
  })
}
