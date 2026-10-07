import { describe, expect, it } from 'vitest'
import { airsProviderFailureReason, airsRetryAfterSeconds, classifyAirsProviderFailure } from '../server/services/airsProviderFailure'

describe('safe Airs provider failure classification', () => {
  it.each([418, 500, 502, 503, 529])('uses an unavailable outcome for unknown or server status %s', providerStatus => {
    expect(classifyAirsProviderFailure({ providerStatus })).toMatchObject({
      statusCode: 503,
      data: { code: 'AGENT_PROVIDER_UNAVAILABLE', providerStatus, retryable: true },
    })
  })

  it('accepts only a fixed tool failure reason on the applicable status', () => {
    expect(classifyAirsProviderFailure({ providerStatus: 400, providerReason: 'tool_use_failed' }).data.code).toBe('AGENT_PROVIDER_RESULT_INVALID')
    expect(classifyAirsProviderFailure({ providerStatus: 403, providerReason: 'tool_use_failed' }).data.code).toBe('AGENT_PROVIDER_CONFIGURATION')
  })

  it('bounds numeric and dated retry delays and never repeats their raw text', () => {
    const nowMs = Date.parse('2026-10-07T10:00:00Z')
    expect(airsRetryAfterSeconds(' 12 ', nowMs)).toBe(12)
    expect(airsRetryAfterSeconds('0.5', nowMs)).toBe(1)
    expect(airsRetryAfterSeconds('Wed, 07 Oct 2026 10:01:00 GMT', nowMs)).toBe(60)
    for (const value of [undefined, null, '', 'private diagnostic', '0', '-1', 'Infinity', '86401', 'Wed, 07 Oct 2026 09:59:00 GMT']) {
      expect(airsRetryAfterSeconds(value, nowMs)).toBeUndefined()
    }
    expect(classifyAirsProviderFailure({ providerStatus: 401, retryAfter: '12' }).data).not.toHaveProperty('retryAfterSeconds')
    expect(classifyAirsProviderFailure({ providerStatus: 429, retryAfter: 'private diagnostic' }).data).not.toHaveProperty('retryAfterSeconds')
  })

  it('reads only the allowlisted tool error code and ignores all provider prose', async () => {
    const known = new Response(JSON.stringify({ error: { code: 'tool_use_failed', message: 'Private learner content', failed_generation: 'Private output' } }), { status: 400 })
    expect(await airsProviderFailureReason(known)).toBe('tool_use_failed')
    expect(await airsProviderFailureReason(new Response(JSON.stringify({ error: { code: 'Private unknown code' } }), { status: 400 }))).toBeUndefined()
    expect(await airsProviderFailureReason(new Response('not json', { status: 400 }))).toBeUndefined()
    expect(await airsProviderFailureReason(new Response(JSON.stringify({ error: { code: 'tool_use_failed' } }), { status: 503 }))).toBeUndefined()
  })

  it('stops reading oversized failure bodies instead of inspecting embedded generation', async () => {
    const body = JSON.stringify({ error: { code: 'tool_use_failed', message: 'x'.repeat(8192) } })
    expect(await airsProviderFailureReason(new Response(body, { status: 400 }))).toBeUndefined()
  })
})
