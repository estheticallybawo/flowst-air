import { responseErrorStatus } from './userErrors'

/** A UI cooldown, not a claim about when the provider's quota will reset. */
export function studyRetryAt(cause: unknown, now = Date.now()) {
  const error = cause as { data?: { code?: string; retryAfterSeconds?: unknown; data?: { code?: string; retryAfterSeconds?: unknown } } } | null
  const detail = error?.data?.data || error?.data
  if (responseErrorStatus(cause) !== 429 || detail?.code !== 'AGENT_PROVIDER_RATE_LIMITED') return 0
  const delay = detail.retryAfterSeconds
  return now + (typeof delay === 'number' && Number.isFinite(delay) && delay > 0 && delay <= 86400 ? Math.ceil(delay) : 60) * 1000
}
