import type { StudyConversation } from "./study";
import {
  hasStudyObjectiveEvidence,
  studyDocumentObjectivesComplete,
  studySessionReviewReady,
  type StudySavedEvidence,
} from "./studyCompletion";
export interface AirsJourney {
  deferredObjectiveIds?: string[];
  sessionStatus?: 'active' | 'covered' | 'ended_with_gaps';
  completedObjectiveIds: string[];
  totalObjectives: number;
  checkpointReady: boolean;
  kaiReady: boolean;
}
/** Only learner-confirmed checkpoints with source-linked execution evidence fill the journey rail. */
export function deriveAirsJourney(
  study: StudyConversation,
  history: StudySavedEvidence,
): AirsJourney {
  const approved =
    study.plan.status === "APPROVED" && study.plan.approvedBy === study.ownerId;
  const index = study.plan.objectives.findIndex(
    (o) => o.id === study.plan.activeObjectiveId,
  );
  const kaiReady = studySessionReviewReady(study, history);
  const completedObjectiveIds = approved
    ? study.plan.objectives
        .filter(
          (o, i) =>
            (study.objectiveFlow ? study.objectiveFlow.ledger.some(entry => entry.objectiveId === o.id && entry.status === 'met_for_session') : (kaiReady || i < index)) &&
            hasStudyObjectiveEvidence(study, o.id, history),
        )
        .map((o) => o.id)
    : [];
  const r = study.plan.recommendation;
  const checkpointReady = Boolean(
    !study.objectiveFlow && approved &&
    !study.practice.awaitingAnswer &&
    r &&
    r.action !== "REVISIT" &&
    r.basedOnAttemptCount === study.practice.attempts.length &&
    index >= 0 &&
    hasStudyObjectiveEvidence(study, study.plan.activeObjectiveId!, history),
  );
  return {
    ...(study.objectiveFlow ? {deferredObjectiveIds:study.objectiveFlow.ledger.filter(entry => entry.status === 'deferred').map(entry => entry.objectiveId),sessionStatus:study.objectiveFlow.sessionStatus} : {}),
    completedObjectiveIds,
    totalObjectives: study.plan.objectives.length,
    checkpointReady,
    kaiReady,
  };
}
