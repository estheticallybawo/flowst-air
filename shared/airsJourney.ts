import type { StudyConversation } from "./study";
import {
  hasStudyObjectiveEvidence,
  studyDocumentObjectivesComplete,
  type StudySavedEvidence,
} from "./studyCompletion";
export interface AirsJourney {
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
  const kaiReady = studyDocumentObjectivesComplete(study, history);
  const completedObjectiveIds = approved
    ? study.plan.objectives
        .filter(
          (o, i) =>
            (kaiReady || i < index) &&
            hasStudyObjectiveEvidence(study, o.id, history),
        )
        .map((o) => o.id)
    : [];
  const r = study.plan.recommendation;
  const checkpointReady = Boolean(
    approved &&
    !study.practice.awaitingAnswer &&
    r &&
    r.action !== "REVISIT" &&
    r.basedOnAttemptCount === study.practice.attempts.length &&
    index >= 0 &&
    hasStudyObjectiveEvidence(study, study.plan.activeObjectiveId!, history),
  );
  return {
    completedObjectiveIds,
    totalObjectives: study.plan.objectives.length,
    checkpointReady,
    kaiReady,
  };
}
