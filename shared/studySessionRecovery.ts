import type { StudyConversation } from './study'
import type { StudyPacingState } from './studyPacing'

/** A proposed pacing setting is not proof that a timer was ever started. */
export function shouldPauseStudyOnExit(study: StudyConversation | null, clock: StudyPacingState | null) {
  return Boolean(study && study.plan.status === 'APPROVED' && study.plan.approvedBy === study.ownerId &&
    study.plan.pacing && !study.abandonedAt && !study.plan.courseCompletedAt && !study.objectiveFlow?.endedAt &&
    clock?.revision && clock.objectiveId === study.plan.activeObjectiveId && clock.phase !== 'PAUSED')
}
