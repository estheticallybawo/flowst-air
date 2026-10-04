/** Normalize only the retired product route prefix; preserve query/hash and agent IDs. */
export function canonicalAirPath(path: string) { return path.replace(/^\/amira(?=\/|\?|#|$)/, '/air') }

const authPages = new Set(['/auth/sign-in', '/auth/register', '/auth/verify', '/auth/recover'])
const authApis = new Set([
  '/api/auth/session',
  '/api/auth/sign-in',
  '/api/auth/sign-out',
  '/api/auth/register',
  '/api/auth/verify',
  '/api/auth/recover',
  '/api/auth/recover-confirm',
])

export const isAirStandalone = (surface: unknown) => surface === 'air' || surface === 'amira'

export function isAirPublicPage(path: string) {
  const normalized = canonicalAirPath(path).replace(/\/+$/, '') || '/'
  return normalized === '/' || normalized === '/air/pricing' || normalized === '/air/about' || authPages.has(normalized)
}

export function isAirStandalonePage(path: string) {
  const normalized = path.replace(/\/+$/, '') || '/'
  return normalized === '/' || normalized === '/air' || normalized.startsWith('/air/') || authPages.has(normalized)
}

export function isAirStandaloneApi(path: string) {
  const normalized = path.replace(/\/+$/, '')
  return normalized === '/api/me' || normalized === '/api/health' || (normalized === '/api/air/access' || normalized === '/api/amira/access') || authApis.has(normalized)
    || normalized === '/api/study' || normalized.startsWith('/api/study/')
}
