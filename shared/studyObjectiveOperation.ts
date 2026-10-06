import type { StudyPlan, StudyTurn } from './study'
import type { StudyExecutionTrace, StudyLearningEvidence } from './studyPedagogy'
import type { ObjectiveControl, ObjectiveDirective, ObjectiveFlowState, SemanticEvidence } from './studyObjectivePolicy'
export interface StudyObjectiveOperation {
  id: string; inputHash: string; planVersion: number; objectiveId: string; targetId?: string
  recordingHash?: string;
  recordedClaim?: {recordingId:string;audioHash:string;claimId:string};
  reviewLeaseId?: string; reviewLeaseUntil?: number;
  status: 'PENDING' | 'REVIEWED' | 'COMPLETE' | 'CANCELLED'; userTurn: StudyTurn; traceId: string; evidenceId: string
  control?: ObjectiveControl; semantic?: SemanticEvidence; directive?: ObjectiveDirective
  interruptsOperationId?: string
  flowAfter?: ObjectiveFlowState; planAfter?: StudyPlan; trace?: StudyExecutionTrace; evidence?: StudyLearningEvidence; agentTurn?: StudyTurn
  error?: string; createdAt: string
}

/** These requests have a complete backend response and need no generative prose. */
export function objectiveReplyUsesModel(operation: StudyObjectiveOperation) {
  return operation.status !== 'COMPLETE' && !['END', 'PAUSE', 'RESUME', 'SKIP', 'DEFER', 'REPEAT'].includes(operation.control || '')
}
