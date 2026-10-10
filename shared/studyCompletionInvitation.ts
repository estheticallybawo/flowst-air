import type { KaiReview } from './airsOrchestration'

/** Celebration is supported only by a saved review whose objective outcomes contain no gaps. */
export function studyCompletionInvitation(review: KaiReview) {
  const covered = !review.closureOnly && review.sessionStatus === 'covered'
    && Boolean(review.objectiveOutcomes?.length)
    && review.objectiveOutcomes!.every(item => item.status === 'met_for_session')
    && Boolean(review.evidence?.length)
  return {
    celebrate: covered,
    title: covered ? 'You covered your session objectives' : 'Your session is saved',
    message: covered
      ? 'You’ve finished this session and reviewed Kai’s feedback. Would you like to practise this source again, or explore something new?'
      : review.closureOnly
        ? 'This session ended without learning evidence, so understanding was not assessed. Would you like to try this source again, or choose a new one?'
        : 'Your feedback and remaining gaps stay in this session. Would you like to revisit this source, or choose something new?',
  }
}
