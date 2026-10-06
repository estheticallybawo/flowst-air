import { z } from 'zod'
import type { StudyConversation, StudyObjective } from './study'

export const OBJECTIVE_POLICY_VERSION = '0.2' as const
export const evaluationModeSchema = z.enum(['comprehension', 'retrieval', 'source_fidelity', 'application', 'reasoning', 'transfer'])
export const objectiveStatusSchema = z.enum(['not_started', 'active', 'partially_met', 'met_for_session', 'needs_revisit', 'deferred'])
export const semanticResultSchema = z.enum(['met', 'partial', 'not_met'])
export const interactionStateSchema = z.enum(['correct', 'progress', 'partial', 'uncertain', 'stuck', 'self_corrected', 'transcription_noise', 'fatigue_explicitly_stated', 'frustration_explicitly_stated'])
export const objectiveActionSchema = z.enum(['ask', 'acknowledge_and_advance', 'scaffold', 'switch_technique', 'explain', 'clarify', 'respond', 'replay', 'defer', 'pause', 'close_session'])
export const objectiveTargetSchema = z.object({
  id: z.string().min(1).max(150), title: z.string().min(1).max(250),
  requiredMeaning: z.array(z.string().min(1).max(600)).min(1).max(6),
  question: z.string().min(1).max(600).refine(value => (value.match(/\?/g) || []).length <= 1, 'Use one learning question per target.'), sourceIds: z.array(z.string().min(1)).min(1).max(4),
}).strict()
export const objectivePolicySchema = z.object({
  version: z.literal(OBJECTIVE_POLICY_VERSION), evaluationMode: evaluationModeSchema,
  successCriteria: z.object({requiredMeaning: z.array(z.string().min(1).max(600)).min(1).max(6), lexicalMatchRequired: z.boolean(), minimumEvidence: z.number().int().min(1).max(2)}).strict(),
  evidenceTargets: z.array(objectiveTargetSchema).min(1).max(4),
  maxAttemptsForSameTarget: z.literal(2),
  allowedAdaptations: z.array(z.enum(['hint', 'worked_example', 'different_activity', 'revisit_source', 'defer', 'pause'])).min(1).max(6),
}).strict().superRefine((value, ctx) => {
  if (value.successCriteria.lexicalMatchRequired && value.evaluationMode !== 'source_fidelity') ctx.addIssue({code: 'custom', message: 'Exact wording is only permitted for source fidelity.'})
  const meanings = value.evidenceTargets.flatMap(target => target.requiredMeaning)
  if (new Set(value.evidenceTargets.map(target => target.id)).size !== value.evidenceTargets.length || new Set(meanings).size !== meanings.length || meanings.length !== value.successCriteria.requiredMeaning.length || meanings.some(meaning => !value.successCriteria.requiredMeaning.includes(meaning))) ctx.addIssue({code: 'custom', message: 'Every required meaning must belong to exactly one stable evidence target.'})
})
export type ObjectivePolicy = z.infer<typeof objectivePolicySchema>
export type EvaluationMode = z.infer<typeof evaluationModeSchema>
export type ObjectiveStatus = z.infer<typeof objectiveStatusSchema>
export type ObjectiveAction = z.infer<typeof objectiveActionSchema>
export type InteractionState = z.infer<typeof interactionStateSchema>

export const semanticEvidenceSchema = z.object({
  semanticAcceptance: semanticResultSchema, demonstrated: z.array(z.string().min(1).max(600)).max(6), unresolved: z.array(z.string().min(1).max(600)).max(6),
  reason: z.string().min(1).max(500), sourceRefs: z.array(z.string().min(1)).max(4), learnerQuotes: z.array(z.string().min(1).max(1000)).max(4),
  transcriptionUncertainty: z.array(z.string().min(1).max(250)).max(4), interactionState: interactionStateSchema,
  learnerTurnIds: z.array(z.string().min(1)).max(8).optional(),
}).strict()
export type SemanticEvidence = z.infer<typeof semanticEvidenceSchema>
export interface ObjectiveTargetState {
  targetId: string; attempts: number; promptsUsed: number; hintsUsed: number | null; selfCorrections: number | null
  semanticAcceptance?: SemanticEvidence['semanticAcceptance']; demonstrated: string[]; evidenceIds: string[]; techniquesUsed: string[]
}
export interface ObjectiveLedgerEntry {
  legacyReviewPending?: boolean;
  objectiveId: string; status: ObjectiveStatus; policy: ObjectivePolicy; targets: ObjectiveTargetState[]
  nextAction: ObjectiveAction; metAtTurnId?: string; unmetReason?: string; deferReason?: 'learner_skipped' | 'learner_deferred' | 'learner_ended'
}
export interface ObjectiveFlowState {
  version: typeof OBJECTIVE_POLICY_VERSION; planVersion: number; ledger: ObjectiveLedgerEntry[]
  pendingOperationId?: string; interruptOperationId?: string; pendingReview?: boolean; error?: string
  paused?: boolean;
  sessionStatus: 'active' | 'covered' | 'ended_with_gaps'; endedAt?: string
  lastTransition?: {fromObjectiveId: string; toObjectiveId?: string; action: ObjectiveAction; reason: string; turnId: string}
}
export interface ObjectiveDirective {
  action: ObjectiveAction; objectiveId: string; targetId?: string; nextObjectiveId?: string
  acknowledgement: string; interactionState: InteractionState; question?: string; technique: string; neuroMapPhase: 'Activate' | 'Model' | 'Connect' | 'Explain' | 'Retrieve' | 'Apply' | 'Reflect'
}

/** A compatibility interpretation of the approved outcome, never a new learning goal. */
export function defaultObjectivePolicy(objective: StudyObjective): ObjectivePolicy {
  const outcome = objective.outcome.slice(0, 600)
  const mode: EvaluationMode = /\b(verbatim|exact wording|quote precisely)\b/i.test(outcome) ? 'source_fidelity' : /\btransfer|novel situation\b/i.test(outcome) ? 'transfer' : /\bapply|application|scenario\b/i.test(outcome) ? 'application' : /\bjustify|reasoning|why\b/i.test(outcome) ? 'reasoning' : /\brecall|retrieve|without notes\b/i.test(outcome) ? 'retrieval' : 'comprehension'
  return objectivePolicySchema.parse({version: OBJECTIVE_POLICY_VERSION, evaluationMode: mode,
    successCriteria: {requiredMeaning: [outcome], lexicalMatchRequired: mode === 'source_fidelity', minimumEvidence: 1},
    evidenceTargets: [{id: objective.id + ':target:1', title: objective.title, requiredMeaning: [outcome], question: `How would you ${outcome.replace(/^the learner can\s+/i, '').replace(/[.!?]+$/, '').replace(/^explain\s+/i, 'explain ')}?`, sourceIds: objective.sources.map(source => source.id).slice(0, 4)}],
    maxAttemptsForSameTarget: 2, allowedAdaptations: ['hint', 'worked_example', 'different_activity', 'revisit_source', 'defer', 'pause']})
}
export function createObjectiveLedger(study: StudyConversation): ObjectiveLedgerEntry[] {
  return study.plan.objectives.map(objective => {
    const policy = objective.policy ? objectivePolicySchema.parse(objective.policy) : defaultObjectivePolicy(objective)
    return {objectiveId: objective.id, status: objective.id === study.plan.activeObjectiveId ? 'active' : 'not_started', policy, nextAction: 'ask',
      targets: policy.evidenceTargets.map(target => ({targetId: target.id, attempts: 0, promptsUsed: 0, hintsUsed: 0, selfCorrections: 0, demonstrated: [], evidenceIds: [], techniquesUsed: []}))}
  })
}
export function nextAvailableTarget(entry: ObjectiveLedgerEntry) {
  return entry.policy.evidenceTargets.find(target => {
    const state = entry.targets.find(item => item.targetId === target.id)!
    return state.semanticAcceptance !== 'met' && state.attempts < 2 && state.promptsUsed < 2
  })
}
export function applySemanticEvidence(entry: ObjectiveLedgerEntry, targetId: string, evidence: SemanticEvidence, evidenceId: string, turnId: string) {
  const next = structuredClone(entry)
  const target = next.policy.evidenceTargets.find(item => item.id === targetId)
  const state = next.targets.find(item => item.targetId === targetId)
  if (!target || !state || state.semanticAcceptance === 'met' || state.attempts >= 2) throw new Error('This target no longer accepts another attempt.')
  if (evidence.demonstrated.some(meaning => !target.requiredMeaning.includes(meaning)) || evidence.unresolved.some(meaning => !target.requiredMeaning.includes(meaning)) || evidence.sourceRefs.some(id => !target.sourceIds.includes(id))) throw new Error('Semantic evidence references an unavailable criterion or source.')
  if (evidence.semanticAcceptance === 'met' && (!evidence.sourceRefs.length || !evidence.learnerQuotes.length || target.requiredMeaning.some(meaning => !evidence.demonstrated.includes(meaning)) || evidence.unresolved.length || evidence.transcriptionUncertainty.length)) throw new Error('A met decision needs complete, source-backed, unambiguous evidence.')
  state.attempts++
  state.evidenceIds.push(evidenceId)
  state.demonstrated = [...new Set([...state.demonstrated, ...evidence.demonstrated])]
  state.semanticAcceptance = evidence.semanticAcceptance === 'met' && state.evidenceIds.length >= next.policy.successCriteria.minimumEvidence ? 'met' : evidence.demonstrated.length ? 'partial' : 'not_met'
  if (evidence.interactionState === 'self_corrected' && state.selfCorrections !== null) state.selfCorrections++
  const allMet = next.targets.every(item => item.semanticAcceptance === 'met')
  next.status = allMet ? 'met_for_session' : state.attempts >= 2 && state.semanticAcceptance !== 'met' ? 'needs_revisit' : state.semanticAcceptance === 'partial' ? 'partially_met' : 'active'
  next.nextAction = allMet ? 'acknowledge_and_advance' : state.attempts >= 2 ? 'switch_technique' : 'scaffold'
  if (allMet) next.metAtTurnId = turnId
  else next.unmetReason = evidence.reason
  return next
}
export function objectiveSessionClosed(flow?: ObjectiveFlowState) { return Boolean(flow && !flow.pendingOperationId && !flow.interruptOperationId && flow.sessionStatus !== 'active' && flow.ledger.length > 0 && Number.isFinite(Date.parse(flow.endedAt || ''))) }
export function closeObjectiveSession(flow: ObjectiveFlowState, now: string) {
  if (flow.ledger.length && flow.ledger.every(entry => entry.status === 'met_for_session' || entry.status === 'deferred')) {
    flow.sessionStatus = flow.ledger.every(entry => entry.status === 'met_for_session') ? 'covered' : 'ended_with_gaps'
    flow.endedAt = now
  }
}
export const objectiveControlSchema = z.enum(['REPEAT', 'EXPLAIN_AGAIN', 'CHANGE_APPROACH', 'HINT', 'SKIP', 'DEFER', 'PAUSE', 'RESUME', 'END'])
export type ObjectiveControl = z.infer<typeof objectiveControlSchema>
export function explicitObjectiveControl(input: string): ObjectiveControl | undefined {
  const original = input.trim().toLowerCase().replace(/’/g,"'").replace(/[.!?]+$/, '').replace(/^please\s+/, '')
  if (original === 'i want to stop') return 'END'
  const text = original.replace(/^(?:i(?:'d| would) like to|i want to|let(?:'s| us)|can (?:we|you)|could (?:we|you))\s+/, '')
  if (/^(repeat(?: the (?:question|last question))?|say that again)$/.test(text)) return 'REPEAT'
  if (/^(explain (?:that|it|this)(?: again)?|give me (?:an explanation|a worked example))$/.test(text)) return 'EXPLAIN_AGAIN'
  if (/^(change (?:the )?approach|try (?:a different|another) (?:approach|example|activity))$/.test(text)) return 'CHANGE_APPROACH'
  if (/^(give me a hint|i need a hint|hint)$/.test(text)) return 'HINT'
  if (/^(skip(?: this(?: objective|topic)?)?|skip to the next (?:objective|topic))$/.test(text)) return 'SKIP'
  if (/^(defer(?: this(?: objective|topic)?)?|revisit (?:this|it) later|move on for now)$/.test(text)) return 'DEFER'
  if (/^(pause(?: (?:the )?(?:session|practice))?|take a break|i need a break|i(?:'m| am) tired)$/.test(text)) return 'PAUSE'
  if (/^(resume(?: (?:the )?session)?|continue practice)$/.test(text)) return 'RESUME'
  if (/^(end (?:the |my )?session|finish here|stop (?:the |my )?session|i want to stop)$/.test(text)) return 'END'
}
