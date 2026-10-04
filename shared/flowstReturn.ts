/** Operator-owned destination only; query text never supplies a return URL. */
export function flowstReturnDestination(value: unknown, development = false): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash) return null
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(development && local && url.protocol === 'http:')) return null
    if (!development && local) return null
    return url.href
  } catch { return null }
}
