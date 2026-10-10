import type { StudyConversation } from './study'
import type { StudyExecutionTrace, StudyLearningEvidence } from './studyPedagogy'
import { objectiveSessionClosed } from './studyObjectivePolicy'

export interface StudySavedEvidence { traces: StudyExecutionTrace[]; evidence: StudyLearningEvidence[] }

/** Completion is an activity checkpoint, not a judgement of mastery. */
export function hasStudyObjectiveEvidence(study: StudyConversation, objectiveId: string, history: StudySavedEvidence) {
  const objective = study.plan.objectives.find(item => item.id === objectiveId)
  if (!objective?.sources.length) return false
  const allowed = new Set(objective.sources.map(source => source.id))
  return study.practice.attempts.some(attempt => {
    if (attempt.objectiveId !== objectiveId || attempt.mode !== 'DISCUSSION' || !attempt.answer.trim() || !attempt.feedback.trim()) return false
    const evidence = history.evidence.find(item => item.id === attempt.evidenceId && item.traceId === attempt.traceId && item.objectiveId === objectiveId)
    const trace = history.traces.find(item => item.id === attempt.traceId && item.status === 'EXECUTED' && item.planVersion === study.plan.version && item.objectiveId === objectiveId)
    if (!evidence || !trace || trace.conversationId !== study.id || evidence.conversationId !== study.id
      || trace.inputTurnId !== evidence.learnerTurnId || trace.outputTurnId !== evidence.feedbackTurnId
      || !trace.evidenceRefs.includes(evidence.id) || !evidence.sourceIds.some(id => allowed.has(id))) return false
    const learner = study.turns.find(turn => turn.id === evidence.learnerTurnId && turn.role === 'USER')
    const reply = study.turns.find(turn => turn.id === evidence.feedbackTurnId && turn.role === 'AMIRA')
    return learner?.text === attempt.answer && reply?.text === attempt.feedback && attempt.sources.some(source => allowed.has(source.id))
  })
}

export function studyObjectivesHaveEvidence(study: StudyConversation, history: StudySavedEvidence) {
  return study.plan.objectives.length > 0 && study.plan.objectives.every(objective => hasStudyObjectiveEvidence(study, objective.id, history))
}

export function studyDocumentObjectivesComplete(study: StudyConversation, history: StudySavedEvidence) {
  if (study.objectiveFlow) return validObjectiveClosure(study) && study.objectiveFlow.sessionStatus === 'covered' && objectiveSessionClosed(study.objectiveFlow)
    && study.objectiveFlow.ledger.every(entry => entry.status === 'met_for_session' && hasStudyObjectiveEvidence(study, entry.objectiveId, history))
  return study.plan.status === 'APPROVED' && study.plan.approvedBy === study.ownerId
    && study.plan.courseCompletedBy === study.ownerId && Number.isFinite(Date.parse(study.plan.courseCompletedAt || ''))
    && studyObjectivesHaveEvidence(study, history)
}

export function studySessionReviewReady(study: StudyConversation, history: StudySavedEvidence) {
  if (!study.objectiveFlow) return studyDocumentObjectivesComplete(study, history)
  return validObjectiveClosure(study) && objectiveSessionClosed(study.objectiveFlow)
    && study.objectiveFlow.ledger.every(entry => entry.status === 'deferred' || entry.status === 'met_for_session' && hasStudyObjectiveEvidence(study, entry.objectiveId, history))
}

function validObjectiveClosure(study: StudyConversation) {
  const flow = study.objectiveFlow
  return Boolean(flow && flow.planVersion === study.plan.version && study.plan.status === 'APPROVED' && study.plan.approvedBy === study.ownerId
    && study.plan.objectives.length > 0 && flow.ledger.length === study.plan.objectives.length
    && new Set(flow.ledger.map(entry => entry.objectiveId)).size === flow.ledger.length
    && study.plan.objectives.every(objective => flow.ledger.some(entry => entry.objectiveId === objective.id)))
}
