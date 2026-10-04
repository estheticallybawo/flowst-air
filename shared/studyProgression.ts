import type { StudyConversation, StudyProgression } from './study'

/** Synthetic scope for assessments spanning every approved Misu objective. */
export const COURSE_ASSESSMENT_ID = 'course-assessment'
export const ORAL_ANSWER_COUNT = 5

export function deriveStudyProgression(study: Pick<StudyConversation, 'mode' | 'plan' | 'practice'>): StudyProgression {
  const oralAnswersCompleted = study.practice.attempts.filter(attempt =>
    attempt.objectiveId === COURSE_ASSESSMENT_ID && attempt.mode === 'ORAL_EXAM').length
  const scenarioAttemptCompleted = study.practice.attempts.some(attempt =>
    attempt.objectiveId === COURSE_ASSESSMENT_ID && attempt.mode === 'SCENARIO')
  const base = { oralAnswersCompleted, oralAnswersRequired: ORAL_ANSWER_COUNT, scenarioAttemptCompleted }
  if (study.plan.status !== 'APPROVED') return { ...base, stage: 'PLAN', availableModes: [] }
  if (!study.plan.courseCompletedAt || study.plan.courseCompletedBy !== study.plan.approvedBy)
    return { ...base, stage: 'COURSE', availableModes: ['DISCUSSION'] }
  if (study.mode === 'DISCUSSION') return { ...base, stage: 'COURSE', availableModes: ['DISCUSSION', 'ORAL_EXAM'] }
  if (study.mode === 'ORAL_EXAM') return { ...base, stage: 'ORAL_EXAM', availableModes: oralAnswersCompleted >= ORAL_ANSWER_COUNT && !study.practice.awaitingAnswer
    ? ['ORAL_EXAM', 'SCENARIO'] : ['ORAL_EXAM'] }
  return { ...base, stage: scenarioAttemptCompleted ? 'COMPLETE' : 'SCENARIO', availableModes: ['SCENARIO'] }
}
