import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib'
import ipaddr from 'ipaddr.js'

export class SourceError extends Error {
  constructor(public statusCode: number, public statusMessage: string) { super(statusMessage) }
}
export interface PublicResponse { url: string; status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }
export interface ReadOptions { maxBytes?: number; timeoutMs?: number; redirects?: number; hosts?: string[]; headers?: Record<string, string> }
export type PublicReader = (url: string, options?: ReadOptions) => Promise<PublicResponse>

export function publicAddress(address: string) {
  try { return ipaddr.process(address).range() === 'unicast' } catch { return false }
}
export function publicUrl(input: string, hosts?: string[]) {
  let url: URL
  try { url = new URL(input) } catch { throw new SourceError(400, 'Enter a complete public HTTPS link.') }
  if (input.length > 2048 || url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      url.hostname.endsWith('.') || (hosts && !hosts.includes(url.hostname.toLowerCase()))) {
    throw new SourceError(400, 'Use a supported public HTTPS link without credentials.')
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (ipaddr.isValid(hostname) && !publicAddress(hostname)) throw new SourceError(400, 'Private network addresses cannot be used as study sources.')
  url.hash = ''
  return url
}

/** Resolve once, reject mixed public/private answers, and pin TLS to a validated IP.
 * No ambient cookies, proxies, JavaScript, or redirects with forwarded credentials. */
export const readPublic: PublicReader = async (input, options = {}) => {
  const maximum = options.maxBytes ?? 2 * 1024 * 1024
  const signal = AbortSignal.timeout(options.timeoutMs ?? 20_000)
  let url = publicUrl(input, options.hosts)
  try {
    for (let hop = 0; ; hop++) {
      const addresses = await Promise.race([
        lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true, verbatim: true }),
        new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
      ])
      signal.throwIfAborted()
      if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new SourceError(400, 'This source does not resolve to a public address.')
      const selected = addresses[0]!
      const result = await new Promise<PublicResponse>((resolve, reject) => {
        const req = request(url, {
          method: 'GET', signal, agent: false, family: selected.family,
          lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
          headers: { 'user-agent': 'Flowst-Airs-Source/1.0', accept: 'text/html,application/json;q=0.9,text/plain;q=0.8', 'accept-encoding': 'gzip,br,deflate', ...options.headers },
        }, response => {
          const chunks: Buffer[] = []; let length = 0
          if (Number(response.headers['content-length'] || 0) > maximum) { response.destroy(); reject(new SourceError(413, 'The source response is too large. Choose a smaller source.')); return }
          response.on('error', reject)
          response.on('data', (chunk: Buffer) => {
            length += chunk.length
            if (length > maximum) { response.destroy(); reject(new SourceError(413, 'The source response is too large. Choose a smaller source.')) }
            else chunks.push(chunk)
          })
          response.on('end', () => {
            try {
              let body = Buffer.concat(chunks)
              const encoding = response.headers['content-encoding']?.toLowerCase()
              if (encoding === 'gzip') body = gunzipSync(body, { maxOutputLength: maximum })
              else if (encoding === 'br') body = brotliDecompressSync(body, { maxOutputLength: maximum })
              else if (encoding === 'deflate') body = inflateSync(body, { maxOutputLength: maximum })
              else if (encoding && encoding !== 'identity') throw new SourceError(415, 'This source uses an unsupported response encoding.')
              if (body.length > maximum) throw new SourceError(413, 'The extracted response is too large.')
              resolve({ url: url.href, status: response.statusCode || 502, headers: response.headers, body })
            } catch (cause) { reject(cause instanceof SourceError ? cause : new SourceError(413, 'This compressed response could not be safely read.')) }
          })
        })
        req.on('error', reject); req.end()
      })
      if ([301, 302, 303, 307, 308].includes(result.status)) {
        if (hop >= (options.redirects ?? 3) || !result.headers.location) throw new SourceError(422, 'This source redirected too many times or to an unsupported location.')
        const next = publicUrl(new URL(String(result.headers.location), url).href, options.hosts)
        if (options.headers?.authorization && next.origin !== url.origin) throw new SourceError(422, 'An authenticated source request cannot redirect to another host.')
        url = next; continue
      }
      if (result.status === 429 || result.status === 403) throw new SourceError(429, 'The source provider refused this request or reached its limit. Try later or supply the text.')
      if (result.status < 200 || result.status >= 300) throw new SourceError(422, 'This public source could not be read. Check the link or supply the text.')
      return result
    }
  } catch (cause) {
    if (cause instanceof SourceError) throw cause
    throw new SourceError(422, signal.aborted ? 'Source retrieval timed out. Try again or supply the text.' : 'This source could not be reached safely. Try another link or supply the text.')
  }
}
