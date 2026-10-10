import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { groqStudyText } from '../server/services/studyInference'
import { buildMisuSourceInventory } from '../server/services/studyPlanningInventory'
import { studyRetryAt } from '../shared/studyRetry'
import { runAirsAgent } from '../server/services/airsAgentRunner'

beforeEach(() => {
  vi.stubGlobal('useRuntimeConfig', () => ({ groqApiKey: 'fixture', groqModel: 'fixture', studyTextProvider: 'groq' }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('provider limit recovery', () => {
  it('preserves a safe retry delay from the inventory/text path without disclosing provider prose', async () => {
    const fetcher = vi.fn(async () => new Response('private provider/learner details', { status: 429, headers: { 'retry-after': '17' } }))
    vi.stubGlobal('fetch', fetcher)
    const error = await groqStudyText('fixture', [], 550).catch(cause => cause)
    expect(error).toMatchObject({ statusCode: 429, data: { code: 'AGENT_PROVIDER_RATE_LIMITED', retryAfterSeconds: 17, providerStatus: 429 } })
    expect(error.statusMessage).toContain('request or token limit')
    expect(JSON.stringify(error)).not.toContain('private')
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('prepares a large document inventory without any model request', () => {
    const fetcher = vi.fn(async () => new Response('', { status: 429 }))
    vi.stubGlobal('fetch', fetcher)
    const chunks = Array.from({ length: 74 }, (_, position) => ({ id: 'chunk-' + position, label: 'Section ' + position, text: 'A source-backed idea.', excerpt: 'A source-backed idea.', position }))
    const result = buildMisuSourceInventory(chunks)
    expect(result.chunks).toHaveLength(74)
    expect(result.text).toContain('"id":"chunk-73"')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('keeps small document inventories local and preserves exact source references', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    expect(buildMisuSourceInventory([{ id: 'p-1', label: 'Page 1', position: 0, text: 'Read the original.', excerpt: 'Read the original.' }]).text).toContain('{"id":"p-1","label":"Page 1","text":"Read the original."}')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('does not accept a truncated output or retry a timed-out dispatch', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: 'unfinished' } }] }))).mockRejectedValueOnce(new Error('private timeout'))
    vi.stubGlobal('fetch', fetcher)
    await expect(groqStudyText('', [], 550)).rejects.toMatchObject({ statusCode: 502, data: { code: 'AGENT_OUTPUT_INCOMPLETE' } })
    await expect(groqStudyText('', [], 550)).rejects.toMatchObject({ statusCode: 503, data: { code: 'AGENT_CONNECTION_FAILED' } })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('requests Kai’s proposal immediately after confirmed reads and retains the validator', async () => {
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ id: 'proposal', function: { name: 'propose_evidence_review', arguments: '{"result":"fixture"}' } }] } }] })))
    vi.stubGlobal('fetch', fetcher)
    const reads = ['get_approved_evaluation_context', 'get_session_evidence'].map(name => ({ name, description: '', parameters: {}, run: vi.fn(() => ({ data: 'saved' })) }))
    const validate = vi.fn(args => args)
    const result = await runAirsAgent('KAI', '', [...reads, { name: 'propose_evidence_review', description: '', parameters: { required: ['result'] }, run: validate }], 'propose_evidence_review')
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string).tool_choice).toEqual({ type: 'function', function: { name: 'propose_evidence_review' } })
    expect(fetcher).toHaveBeenCalledTimes(1)
    for (const read of reads) expect(read.run).toHaveBeenCalledTimes(1)
    expect(validate).toHaveBeenCalledExactlyOnceWith({ result: 'fixture' })
    expect(result.proposal).toEqual({ result: 'fixture' })
  })
  it('retains bounded UI cooldowns for direct and serialized errors without treating unrelated errors as limits', () => {
    expect(studyRetryAt({ statusCode: 429, data: { code: 'AGENT_PROVIDER_RATE_LIMITED', retryAfterSeconds: 17 } }, 1000)).toBe(18000)
    expect(studyRetryAt({ response: { status: 429 }, data: { data: { code: 'AGENT_PROVIDER_RATE_LIMITED', retryAfterSeconds: 2.3 } } }, 1000)).toBe(4000)
    for (const delay of [undefined, '99', -5, Infinity, 86401]) expect(studyRetryAt({ statusCode: 429, data: { code: 'AGENT_PROVIDER_RATE_LIMITED', retryAfterSeconds: delay } }, 1000)).toBe(61000)
    expect(studyRetryAt({ statusCode: 502, data: { code: 'KAI_EVIDENCE_INVALID' } }, 1000)).toBe(0)
    expect(studyRetryAt({ statusCode: 429, data: { code: 'APP_DAILY_ALLOWANCE' } }, 1000)).toBe(0)
  })
})
