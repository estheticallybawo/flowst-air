import { canonicalAirsPath } from './airsSurface'
/** Only local Flowst Airs destinations may be carried through standalone authentication. */
export function airsReturnPath(value: unknown, fallback = '/airs') {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\r\n]/.test(value)) return fallback
  try {
    const url = new URL(value, 'https://airs.local')
    url.pathname = canonicalAirsPath(url.pathname)
    if (url.origin !== 'https://airs.local' || !(url.pathname === '/airs' || url.pathname.startsWith('/airs/'))) return fallback
    return url.pathname + url.search + url.hash
  } catch { return fallback }
}
