import { responseErrorStatus, safeProductMessage } from './userErrors'

/** Keep service diagnostics out of the learner's study room. */
export function learnerStudyError(cause: unknown, fallback: string): string {
  const response = cause as { data?: { statusMessage?: unknown; message?: unknown } } | null
  if (responseErrorStatus(cause) === 401) return 'Your session ended. Sign in again to keep studying.'
  return safeProductMessage(response?.data?.statusMessage || response?.data?.message, fallback)
}
