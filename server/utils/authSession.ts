import type { H3Event } from 'h3'

export const refreshCookieName = 'flowst_refresh'

export const setRefreshCookie = (event: H3Event, value: string) => setCookie(event, refreshCookieName, value, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
})

export const clearRefreshCookie = (event: H3Event) => deleteCookie(event, refreshCookieName, { path: '/' })

export const getRefreshCookie = (event: H3Event) => getCookie(event, refreshCookieName) || ''

export const authFailure = (cause: unknown, fallback: string) => {
  const name = typeof cause === 'object' && cause && 'name' in cause ? String(cause.name) : ''
  if (name === 'NotAuthorizedException') return createError({ statusCode: 401, statusMessage: 'The email or password is incorrect.' })
  if (name === 'UsernameExistsException') return createError({ statusCode: 409, statusMessage: 'An account already exists for this email.' })
  if (name === 'CodeMismatchException' || name === 'ExpiredCodeException') return createError({ statusCode: 400, statusMessage: 'The verification code is invalid or expired.' })
  if (name === 'InvalidPasswordException') return createError({ statusCode: 400, statusMessage: 'Use at least 10 characters with upper-case, lower-case, and number characters.' })
  if (cause && typeof cause === 'object' && 'statusCode' in cause) return cause
  return createError({ statusCode: 502, statusMessage: fallback })
}
