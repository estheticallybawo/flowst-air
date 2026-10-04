type ErrorDetails = {
  name?: string
  message?: unknown
  statusCode?: number
  status?: number
  response?: { status?: number }
  data?: { statusCode?: number; statusMessage?: unknown; message?: unknown }
}

export function responseErrorStatus(cause: unknown): number {
  const error = cause as ErrorDetails | null
  return Number(error?.statusCode || error?.status || error?.response?.status || error?.data?.statusCode || 0)
}

const technicalDetail = /https?:\/\/|\/api\/|\[(?:GET|POST|PUT|PATCH|DELETE|HEAD)\]|<no response>|failed to fetch|fetch failed|networkerror|load failed|\b(?:amazon|amazonaws|aws|bedrock|polly|transcribe|elevenlabs|groq|cognito|dynamodb|iam|inference profile|credential|access key|model id|region|role arn|server log|stack trace|internal server error|bad gateway|service unavailable|exception|ECONNREFUSED|ENOTFOUND|ETIMEDOUT)\b|arn:aws:|\b\w+(?:Exception|Error):|\b(?:request|trace)[-_ ]?id\b/i

/** Only accepts short product guidance. Never use an exception as the fallback. */
export function safeProductMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const message = value.trim()
  if (/^(?:internal )?server error[.!]?$/i.test(message)) return fallback
  if (!message || message.length > 240 || technicalDetail.test(message) || /\n|\r|\bat (?:async )?\w+\s*\(/i.test(message)) return fallback
  return message
}

type AccountOperation = 'sign-in' | 'register' | 'verify' | 'recover' | 'reset' | 'session' | 'account'
const accountFallbacks: Record<AccountOperation, string> = {
  'sign-in': 'We couldn’t sign you in right now. Please try again.',
  register: 'We couldn’t create your account right now. Please try again.',
  verify: 'We couldn’t verify your email right now. Please try again.',
  recover: 'We couldn’t send a recovery code right now. Please try again.',
  reset: 'We couldn’t change your password right now. Please try again.',
  session: 'We couldn’t restore your session. Please sign in again.',
  account: 'We couldn’t open your account right now. Please try signing in again.',
}

// Distinguish a failed account read after authentication from incorrect credentials.
export class AccountLoadError extends Error {
  constructor(cause: unknown) { super('Account details could not be loaded.', { cause }) }
}

export function accountError(cause: unknown, operation: AccountOperation): string {
  if (cause instanceof AccountLoadError) return accountError(cause.cause, 'account')
  const error = cause as ErrorDetails | null
  const status = responseErrorStatus(cause)
  if (status === 429) return 'There have been too many attempts. Wait a moment, then try again.'
  if (!status && (error?.name === 'FetchError' || error?.name === 'TimeoutError' || error?.name === 'AbortError' || /fetch|network|connection|timeout/i.test(String(error?.message || '')))) {
    return 'We couldn’t connect. Check your internet connection and try again.'
  }
  if (status >= 500) return accountFallbacks[operation]
  // Match known conditions, but always render copy owned by the application.
  const message = error?.data?.statusMessage
  if (operation === 'sign-in' && (status === 401 || message === 'The email or password is incorrect.')) return 'Check your email and password, then try again.'
  if (operation === 'register' && (status === 409 || message === 'An account already exists for this email.')) return 'An account already uses this email. Sign in or reset your password.'
  if (message === 'Use at least 10 characters with upper-case, lower-case, and number characters.') return 'Choose a password with at least 10 characters, including uppercase and lowercase letters and a number.'
  if (message === 'The verification code is invalid or expired.' || message === 'The recovery code is invalid or expired.') return 'That code is incorrect or has expired. Check the latest code in your email and try again.'
  if (status === 400) {
    if (operation === 'verify' || operation === 'reset') return 'Check your email and code, then try again.'
    if (operation === 'register') return 'Check your email and password requirements, then try again.'
    if (operation === 'recover') return 'Check your email address, then try again.'
  }
  return accountFallbacks[operation]
}

export function microphoneError(cause: unknown): string {
  const name = (cause as ErrorDetails | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Allow microphone access in your browser, then try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No available microphone was found. Connect a microphone and try again.'
  if (name === 'NotReadableError') return 'Your microphone is unavailable. Check whether another app is using it, then try again.'
  return 'We couldn’t start your microphone. Check your microphone settings and try again.'
}
