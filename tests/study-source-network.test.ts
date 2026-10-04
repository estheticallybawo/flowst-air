import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { gzipSync } from 'node:zlib'
const state = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }))
vi.mock('node:dns/promises', () => ({ lookup: state.lookup }))
vi.mock('node:https', () => ({ request: state.request }))
import { readPublic } from '../server/services/sources/network'

beforeEach(() => { state.lookup.mockReset().mockResolvedValue([{ address: '1.1.1.1', family: 4 }]); state.request.mockReset() })
afterEach(() => vi.restoreAllMocks())
function respond(status: number, headers: Record<string, string> = {}, body = Buffer.from('Readable source')) {
  state.request.mockImplementationOnce((_url: URL, options: any, callback: (response: any) => void) => {
    options.lookup('example.com', {}, (_error: unknown, address: string) => expect(address).toBe('1.1.1.1'))
    const req = new EventEmitter() as EventEmitter & { end: () => void }
    req.end = () => {
      const response = Object.assign(new PassThrough(), { statusCode: status, headers })
      callback(response); queueMicrotask(() => response.end(body))
    }
    return req
  })
}
describe('public HTTP connection boundary', () => {
  it('pins the validated address and retains the original TLS hostname', async () => {
    respond(200)
    expect((await readPublic('https://example.com/lesson')).body.toString()).toContain('Readable')
    expect(state.lookup).toHaveBeenCalledTimes(1)
    expect(state.request.mock.calls[0]?.[0].hostname).toBe('example.com')
    expect(state.request.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', agent: false, family: 4 })
  })
  it('rejects mixed public/private DNS before connecting', async () => {
    state.lookup.mockResolvedValue([{ address: '1.1.1.1', family: 4 }, { address: '127.0.0.1', family: 4 }])
    await expect(readPublic('https://example.com')).rejects.toMatchObject({ statusCode: 400 })
    expect(state.request).not.toHaveBeenCalled()
  })
  it('rejects private redirects and DNS rebinding on a later redirect', async () => {
    respond(302, { location: 'https://127.0.0.1/metadata' })
    await expect(readPublic('https://example.com')).rejects.toMatchObject({ statusCode: 400 })
    state.lookup.mockReset().mockResolvedValueOnce([{ address: '1.1.1.1', family: 4 }]).mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }])
    respond(302, { location: 'https://example.com/second' })
    await expect(readPublic('https://example.com')).rejects.toMatchObject({ statusCode: 400 })
    expect(state.request).toHaveBeenCalledTimes(2)
  })
  it('bounds compressed and decompressed bodies and refuses authenticated host changes', async () => {
    respond(200, {}, Buffer.alloc(1100, 'x'))
    await expect(readPublic('https://example.com', { maxBytes: 1000 })).rejects.toMatchObject({ statusCode: 413 })
    respond(200, { 'content-encoding': 'gzip' }, gzipSync(Buffer.alloc(10_000, 'x')))
    await expect(readPublic('https://example.com', { maxBytes: 1000 })).rejects.toMatchObject({ statusCode: 413 })
    respond(302, { location: 'https://other.example/receive' })
    await expect(readPublic('https://example.com', { headers: { authorization: 'Bearer test-token' } })).rejects.toMatchObject({ statusCode: 422 })
  })
})
