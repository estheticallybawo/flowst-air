import { createError } from 'h3'
import type { StudyConversation } from '../../../shared/study'
import { COURSE_ASSESSMENT_ID, ORAL_ANSWER_COUNT, deriveStudyProgression } from '../../../shared/studyProgression'
import { studyInstructionPacketSchema, type StudyFunctionRef, type StudyInstructionPacket } from '../../../shared/studyPedagogy'
import { nextAvailableTarget } from '../../../shared/studyObjectivePolicy'

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
  'explicit-instruction@2': publishFunction({
    ref: {id:'explicit-instruction',version:'2',kind:'framework'}, stages:['INTRODUCTION','GUIDED_PRACTICE','INDEPENDENT_EXPLANATION'],
    requiredBehaviors:['Introduce the source-backed idea briefly, then ask the backend-selected evidence-target question.','Misu’s current semantic decision governs acknowledgement and automatic advancement through the approved goals.','Respect pause, end, breaks and requested explanations.'],
    prohibitedBehaviors:['Do not invent evidence targets, advance outside the approved sequence, declare mastery or assign a grade.','Do not ask a met target or an exhausted target.'], evidenceToCapture:['Source-linked learner meaning','Support and uncertainty','Objective-state transitions'],
  }),
  'self-explanation-teach-back@3': publishFunction({
    ref:{id:'self-explanation-teach-back',version:'3',kind:'technique'}, stages:['GUIDED_PRACTICE','INDEPENDENT_EXPLANATION'],
    requiredBehaviors:['Accept source-faithful semantic paraphrases and recoverable speech disfluencies.','Acknowledge the specific demonstrated meaning selected by Misu.','After two incomplete attempts, explain or change support and offer deferral; do not request the same evidence again.'],
    prohibitedBehaviors:['Do not invent a gap, require unnecessary rewording, or make progress depend on generic praise.','Do not override the backend next action or infer intelligence, emotion, accent, pronunciation or durable mastery.'], evidenceToCapture:['Demonstrated and unresolved meanings','Exact learner quotes and source references','Prompts, hints, self-corrections and material transcription uncertainty'],
  }),
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
  'self-explanation-teach-back@2': publishFunction({
    ref: { id: 'self-explanation-teach-back', version: '2', kind: 'technique' as const },
    stages: ['GUIDED_PRACTICE', 'INDEPENDENT_EXPLANATION'] as StudyInstructionPacket['stage'][],
    requiredBehaviors: [
      'Invite an explanation in the learner’s own words; accept faithful paraphrases and ordinary transcription disfluencies.',
      'After an attempt, identify supported strengths and name a gap only when the learner’s meaning and source evidence demonstrate one.',
      'Use one fresh why, how or application probe when the outcome needs that evidence; do not keep demanding the same explanation or exact source wording.',
      'When a supported explanation covers the approved outcome, acknowledge it and leave checkpoint review and advancement to Misu and the learner.',
    ],
    prohibitedBehaviors: [
      'Do not invent a gap to fill a feedback template.',
      'Do not mistake a semantically equivalent explanation or harmless speech recognition error for a misconception.',
      'Do not supply the full answer before the learner has a chance to attempt it.',
      'Do not declare mastery or advance the objective without learner confirmation.',
    ],
    evidenceToCapture: ['Explanation linked to the learner turn', 'Source-backed feedback linked to the agent turn', 'Actual reasoning or application evidence requested by the objective'],
  }),
})

export const DEFAULT_STUDY_FUNCTION_REFS: readonly Readonly<StudyFunctionRef>[] = Object.freeze([
  Object.freeze({ id: 'explicit-instruction', version: '2', kind: 'framework' as const }),
  Object.freeze({ id: 'self-explanation-teach-back', version: '3', kind: 'technique' as const }),
])

export function compileAirStudyPacket(conversation: StudyConversation): StudyInstructionPacket {
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
  if (refs.length !== 2
    || refs[0]!.id !== 'explicit-instruction' || !['1','2'].includes(refs[0]!.version) || refs[0]!.kind !== 'framework'
    || refs[1]!.id !== 'self-explanation-teach-back' || !['1', '2','3'].includes(refs[1]!.version) || refs[1]!.kind !== 'technique')
    throw createError({ statusCode: 409, statusMessage: 'This plan contains unpublished or incompatible NeuroMap functions.' })
  const controlled = conversation.objectiveFlow && !courseAssessment
  const framework = STUDY_FUNCTION_REGISTRY[controlled ? 'explicit-instruction@2' : `${refs[0]!.id}@${refs[0]!.version}`]!
  const technique = STUDY_FUNCTION_REGISTRY[controlled ? 'self-explanation-teach-back@3' : `${refs[1]!.id}@${refs[1]!.version}`]!
  const entry = controlled ? conversation.objectiveFlow!.ledger.find(item => item.objectiveId === objective.id) : undefined
  const target = entry ? nextAvailableTarget(entry) : undefined
  const targetState = entry?.targets.find(item => item.targetId === target?.id)
  const objectiveAttempts = conversation.practice.attempts.filter(item => item.objectiveId === objective.id).length
  const hasIntroduction = conversation.turns.some(turn => turn.role === 'AMIRA' && turn.kind === 'INTRO'
    && (turn.objectiveId === objective.id || turn.nextPrompt?.objectiveId === objective.id || !turn.objectiveId && objective.id === plan.objectives[0]?.id))
  const stage: StudyInstructionPacket['stage'] = !courseAssessment && !hasIntroduction
    ? 'INTRODUCTION' : objectiveAttempts ? 'INDEPENDENT_EXPLANATION' : 'GUIDED_PRACTICE'
  if (!framework.stages.includes(stage) || (stage !== 'INTRODUCTION' && !technique.stages.includes(stage)))
    throw createError({ statusCode: 409, statusMessage: 'The approved pedagogy functions are incompatible with this study stage.' })
  return studyInstructionPacketSchema.parse({
    version: controlled ? 2 : 1, agent: 'AMIRA', conversationId: conversation.id, planVersion: plan.version,
    approval: { kind: 'PERSONAL_STUDY', legacy: false },
    objective: { id: objective.id, title: objective.title, outcome: objective.outcome },
    mode: conversation.mode, stage, functionRefs: stage === 'INTRODUCTION' ? [framework.ref] : [framework.ref, technique.ref],
    requiredBehaviors: stage === 'INTRODUCTION' ? framework.requiredBehaviors : [...framework.requiredBehaviors, ...technique.requiredBehaviors],
    prohibitedBehaviors: stage === 'INTRODUCTION' ? framework.prohibitedBehaviors : [...framework.prohibitedBehaviors, ...technique.prohibitedBehaviors],
    evidenceToCapture: stage === 'INTRODUCTION' ? framework.evidenceToCapture : [...framework.evidenceToCapture, ...technique.evidenceToCapture],
    sourceIds: objective.sources.map(source => source.id),
    ...(entry ? {controller:{version:'0.2',objectiveStatus:entry.status,evaluationMode:entry.policy.evaluationMode,requiredMeaning:entry.policy.successCriteria.requiredMeaning,lexicalMatchRequired:entry.policy.successCriteria.lexicalMatchRequired,minimumEvidence:entry.policy.successCriteria.minimumEvidence,targetId:target?.id,attemptNumber:(targetState?.attempts || 0)+1,maxAttemptsForSameTarget:2,allowedAdaptations:entry.policy.allowedAdaptations,nextAction:entry.nextAction,neuroMapPhase:entry.status==='met_for_session' ? 'Reflect' : entry.nextAction==='switch_technique' ? 'Model' : entry.policy.evaluationMode==='retrieval' ? 'Retrieve' : ['application','transfer'].includes(entry.policy.evaluationMode) ? 'Apply' : 'Explain',interactionTechnique:entry.nextAction==='switch_technique' ? 'worked_example' : 'teach_back',acknowledgementRequiredOnSuccess:true}} : {}),
  })
}
