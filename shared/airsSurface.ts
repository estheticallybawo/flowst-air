/** Normalize only the retired product route prefix; preserve query/hash and agent IDs. */
export function canonicalAirsPath(path: string) { return path.replace(/^\/(?:air|amira)(?=\/|\?|#|$)/, '/airs') }

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

export const isAirsStandalone = (surface: unknown) => surface === 'airs' || surface === 'air' || surface === 'amira'

export function isAirsPublicPage(path: string) {
  const normalized = canonicalAirsPath(path).replace(/\/+$/, '') || '/'
  return normalized === '/' || normalized === '/airs/pricing' || normalized === '/airs/about' || authPages.has(normalized)
}

export function isAirsStandalonePage(path: string) {
  const normalized = path.replace(/\/+$/, '') || '/'
  return normalized === '/' || normalized === '/airs' || normalized.startsWith('/airs/') || authPages.has(normalized)
}

export function isAirsStandaloneApi(path: string) {
  const normalized = path.replace(/\/+$/, '')
  return normalized === '/api/me' || normalized === '/api/health' || (normalized === '/api/airs/access' || normalized === '/api/air/access' || normalized === '/api/amira/access') || authApis.has(normalized)
    || normalized === '/api/study' || normalized.startsWith('/api/study/')
}
