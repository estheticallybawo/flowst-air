import { canonicalAirPath } from './airSurface'
/** Only local Flowst Air destinations may be carried through standalone authentication. */
export function airReturnPath(value: unknown, fallback = '/airs') {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\r\n]/.test(value)) return fallback
  try {
    const url = new URL(value, 'https://air.local')
    url.pathname = canonicalAirPath(url.pathname)
    if (url.origin !== 'https://air.local' || !(url.pathname === '/airs' || url.pathname.startsWith('/airs/'))) return fallback
    return url.pathname + url.search + url.hash
  } catch { return fallback }
}
