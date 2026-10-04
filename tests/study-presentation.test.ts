import { describe, expect, it } from 'vitest'
import { learnerStudyError } from '../shared/studyPresentation'

describe('learner-facing study errors', () => {
  it('keeps useful product errors and hides service configuration details', () => {
    expect(learnerStudyError({ data: { statusMessage: 'This pilot allows one document per month.' } }, 'Try again.')).toBe('This pilot allows one document per month.')
    expect(learnerStudyError({ data: { statusMessage: 'The configured Amazon Bedrock model is unavailable to this AWS role or region.' } }, 'Amina cannot respond right now. Try again later.')).toBe('Amina cannot respond right now. Try again later.')
    expect(learnerStudyError({ data: { statusMessage: 'Check /api/study/conversations' } }, 'Try again.')).toBe('Try again.')
  })

  it('does not expose request URLs or expired-session internals', () => {
    expect(learnerStudyError({ message: '[GET] http://localhost/api/study failed' }, 'Try again.')).toBe('Try again.')
    expect(learnerStudyError({ statusCode: 401 }, 'Try again.')).toContain('Sign in again')
  })
})
