import { expect, it } from 'vitest'
import { studyCompletionInvitation } from '../shared/studyCompletionInvitation'
import type { KaiReview } from '../shared/airsOrchestration'

const review: KaiReview = {
  id: 'review', conversationId: 'session', planVersion: 1, basedOnTurnId: 'turn', createdAt: '2026-10-07T00:00:00Z', nextPracticeStatus: 'PROPOSED',
  observations: [], notAssessed: [], nextPractice: { goal: 'Apply the idea', exercise: 'Try a new example.', evidenceIds: ['evidence'] },
  sessionStatus: 'covered', objectiveOutcomes: [{ objectiveId: 'purpose', title: 'Purpose', status: 'met_for_session', attempts: 1, hintsUsed: 0 }],
  evidence: [{ id: 'evidence', attempt: 'A saved learner explanation.' }],
}
it('celebrates covered objectives without claiming mastery or improvement', () => {
  const result = studyCompletionInvitation(review)
  expect(result.celebrate).toBe(true)
  expect(result.title).toBe('You covered your session objectives')
  expect(result.message).not.toMatch(/master|improv|intelligen/i)
})
it('keeps deferred and zero-evidence closures factual, including inconsistent covered labels', () => {
  const gaps = studyCompletionInvitation({ ...review, sessionStatus: 'ended_with_gaps', objectiveOutcomes: [{ ...review.objectiveOutcomes![0]!, status: 'deferred' }] })
  expect(gaps.celebrate).toBe(false)
  expect(gaps.message).toContain('remaining gaps')
  const empty = studyCompletionInvitation({ ...review, closureOnly: true, evidence: [] })
  expect(empty.celebrate).toBe(false)
  expect(empty.message).toContain('understanding was not assessed')
  expect(studyCompletionInvitation({ ...review, evidence: [] }).celebrate).toBe(false)
  expect(studyCompletionInvitation({ ...review, objectiveOutcomes: [{ ...review.objectiveOutcomes![0]!, status: 'deferred' }] }).celebrate).toBe(false)
})
