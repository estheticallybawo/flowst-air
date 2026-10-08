import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { requestStudyBedrock, bedrockConverseInput } from '../server/services/studyBedrockTransport'
import { runAirsAgent } from '../server/services/airsAgentRunner'
import { groqStudyText } from '../server/services/studyInference'
import { askMisu } from '../server/services/studyMisu'
import { streamAminaText } from '../server/services/studyAmina'
import { bedrockReservationMicros, reserveBedrockTestingBudget, BEDROCK_TEST_BUDGET_MICROS } from '../server/services/studyModelBudget'

const state = vi.hoisted(() => ({ ledger: undefined as any, mock: false, failWrite: false, sdkSend: vi.fn(), destroy: vi.fn() }))
vi.mock('../server/services/airsContext', async importOriginal => ({ ...await importOriginal<any>(),
  readAirsArtifact: vi.fn(async () => structuredClone(state.ledger)),
  writeAirsArtifact: vi.fn(async (_owner, _key, value, _event, revision) => {
    if (state.failWrite) throw createError({ statusCode: 503, statusMessage: 'Budget persistence failed' })
    if ((state.ledger?.revision || '') !== revision) throw createError({ statusCode: 409 })
    state.ledger = structuredClone(value)
  }),
}))
vi.mock('../server/services/studyRepository', async importOriginal => ({ ...await importOriginal<any>(), studyStorageResources: () => ({ mock: state.mock }) }))
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({ BedrockRuntimeClient: class { send = state.sdkSend; destroy = state.destroy }, ConverseCommand: class { constructor(public input: unknown) {} } }))
const request = { messages: [{ role: 'user' as const, content: 'Explain this source.' }], max_completion_tokens: 600, temperature: 0.2 }
const response = (text = 'A source-backed reply.') => new Response(JSON.stringify({ stopReason: 'end_turn', output: { message: { content: [{ text }] } }, usage: { inputTokens: 20, outputTokens: 10 } }))
beforeEach(() => {
  state.ledger = undefined; state.mock = false; state.failWrite = false; state.sdkSend.mockReset(); state.destroy.mockReset()
  vi.stubGlobal('useRuntimeConfig', () => ({ studyTextProvider: 'aws', studyBedrockApiKey: 'fixture-private-key', studyBedrockModelId: 'us.amazon.nova-2-lite-v1:0', awsRegion: 'us-east-1' }))
  vi.stubGlobal('fetch', vi.fn(async () => response()))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Bedrock testing transport', () => {
  it('routes Misu evaluation and Amina text through Bedrock with no Groq key', async () => {
    expect(await askMisu('Ground in sources.', 'A saved explanation.', 600)).toBe('A source-backed reply.')
    const parts = []; for await (const text of streamAminaText('Ground in sources.', [], 'Hello')) parts.push(text)
    expect(parts).toEqual(['A source-backed reply.'])
    expect(fetch).toHaveBeenCalledTimes(2)
    for (const [url, init] of vi.mocked(fetch).mock.calls) {
      expect(String(url)).toMatch(/^https:\/\/bedrock-runtime\.us-east-1\.amazonaws\.com\/model\/us.amazon.nova-2-lite-v1%3A0\/converse$/)
      const payload = JSON.parse(String(init!.body)); expect(payload).not.toHaveProperty('reasoning_effort')
      expect(payload.inferenceConfig.maxTokens).toBe(600)
    }
    expect(state.ledger.requests).toBe(2)
  })
  it.each([['MISU', 'propose_session_plan', 'get_source_inventory'], ['KAI', 'propose_evidence_review', 'get_session_evidence']] as const)('retains %s function validation and confirmed tool results', async (agent, name, read) => {
    const validator = vi.fn(args => args), reader = vi.fn(() => ({ source: 'Saved source.' }))
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ stopReason: 'tool_use', output: { message: { content: [{ toolUse: { toolUseId: 'proposal-1', name, input: { title: 'Validated' } } }] } } })))
    await runAirsAgent(agent, 'Use only saved evidence.', [{ name: read, parameters: {}, description: '', run: reader }, { name, parameters: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'], additionalProperties: false, $schema: 'schema' }, description: '', run: validator }], name)
    expect(validator).toHaveBeenCalledExactlyOnceWith({ title: 'Validated' }); expect(reader).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]!.body))
    expect(sent.toolConfig.toolChoice).toEqual({ tool: { name } })
    expect(sent.messages.at(-1).content[0].toolResult.content[0].text).toContain('Saved source.')
    expect(sent.toolConfig.tools.at(-1).toolSpec.inputSchema.json).not.toHaveProperty('$schema')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('maps tool results and merges adjacent user messages without losing content', () => {
    const payload = bedrockConverseInput({ ...request, messages: [{ role: 'system', content: 'Policy' }, { role: 'user', content: 'Source' }, { role: 'user', content: 'Question' }, { role: 'assistant', content: null, tool_calls: [{ id: 'one', function: { name: 'read_source_passage', arguments: '{"sourceId":"p1"}' } }] }, { role: 'tool', tool_call_id: 'one', content: '{"text":"Evidence"}' }] })
    expect(payload.system).toEqual([{ text: 'Policy' }]); expect(payload.messages).toHaveLength(3)
    expect(payload.messages![0]!.content).toEqual([{ text: 'Source' }, { text: 'Question' }])
    expect(payload.messages![1]!.content![0]).toMatchObject({ toolUse: { input: { sourceId: 'p1' } } })
  })
  it.each([403, 413, 429, 503])('retains safe status %s without paid retries or leaking the provider body', async status => {
    vi.mocked(fetch).mockResolvedValue(new Response('private provider prose', { status }))
    const error = await groqStudyText('Policy', [{ role: 'user', content: 'Answer' }], 600).catch(error => error)
    expect(error.data.providerStatus).toBe(status); expect(JSON.stringify(error)).not.toContain('private provider')
    expect(fetch).toHaveBeenCalledTimes(1); expect(state.ledger.requests).toBe(1)
  })
  it('keeps reservations after a timeout and never retries it', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('private transport details'))
    await expect(groqStudyText('', [{ role: 'user', content: 'Answer' }], 600)).rejects.toMatchObject({ data: { code: 'AGENT_CONNECTION_FAILED' } })
    expect(fetch).toHaveBeenCalledTimes(1); expect(state.ledger.reservedMicros).toBeGreaterThan(0)
  })
  it('rejects truncation before using text and rejects blocked outputs', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ stopReason: 'max_tokens', output: { message: { content: [{ text: 'incomplete' }] } } })))
    await expect(groqStudyText('', [{ role: 'user', content: 'Answer' }], 600)).rejects.toMatchObject({ data: { code: 'AGENT_OUTPUT_INCOMPLETE' } })
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ stopReason: 'guardrail_intervened', output: { message: { content: [{ text: 'blocked' }] } } })))
    await expect(requestStudyBedrock(request)).rejects.toMatchObject({ data: { code: 'AGENT_RESULT_INVALID' } })
  })
  it('supports workload identity with SDK retries disabled', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ studyTextProvider: 'aws' }))
    state.sdkSend.mockResolvedValue({ stopReason: 'end_turn', output: { message: { content: [{ text: 'Reply' }] } } })
    expect((await (await requestStudyBedrock(request)).json()).choices[0].message.content).toBe('Reply')
    expect(fetch).not.toHaveBeenCalled(); expect(state.sdkSend).toHaveBeenCalledTimes(1); expect(state.destroy).toHaveBeenCalledTimes(1)
  })
})

describe('shared $20 conservative testing allowance', () => {
  it('caps standalone at $5 so the two separate production tables reserve at most $20 together', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { appSurface: 'air' } }))
    state.ledger = { revision: 'old', requests: 1, reservedMicros: 5_000_000 }
    await expect(reserveBedrockTestingBudget(1000, 600)).rejects.toMatchObject({ data: { code: 'MODEL_TEST_BUDGET_EXHAUSTED' } })
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { appSurface: 'flowst' } }))
    await reserveBedrockTestingBudget(1000, 600)
    expect(state.ledger.reservedMicros).toBeLessThan(15_000_000)
  })
  it('allows only one of two concurrent requests when one reservation remains', async () => {
    const cost = bedrockReservationMicros(1000, 600)
    state.ledger = { revision: 'old', requests: 0, reservedMicros: BEDROCK_TEST_BUDGET_MICROS - cost }
    const outcomes = await Promise.allSettled([reserveBedrockTestingBudget(1000, 600), reserveBedrockTestingBudget(1000, 600)])
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(state.ledger.reservedMicros).toBe(BEDROCK_TEST_BUDGET_MICROS)
    await expect(requestStudyBedrock(request)).rejects.toMatchObject({ data: { code: 'MODEL_TEST_BUDGET_EXHAUSTED' } })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('blocks paid dispatch without durable storage or after a write failure', async () => {
    state.mock = true
    await expect(requestStudyBedrock(request)).rejects.toMatchObject({ data: { code: 'MODEL_BUDGET_STORAGE_REQUIRED' } })
    state.mock = false; state.failWrite = true
    await expect(requestStudyBedrock(request)).rejects.toMatchObject({ statusCode: 503 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('bounds the whole encoded request, output allowance and approved model before spending', async () => {
    await expect(requestStudyBedrock({ ...request, messages: [{ role: 'user', content: '😀'.repeat(25_000) }] })).rejects.toMatchObject({ statusCode: 413 })
    await expect(requestStudyBedrock({ ...request, max_completion_tokens: 4001 })).rejects.toMatchObject({ statusCode: 413 })
    vi.stubGlobal('useRuntimeConfig', () => ({ studyTextProvider: 'aws', studyBedrockModelId: 'arbitrary-marketplace-endpoint' }))
    await expect(requestStudyBedrock(request)).rejects.toMatchObject({ data: { code: 'MODEL_TEST_CONFIGURATION' } })
    expect(fetch).not.toHaveBeenCalled(); expect(state.ledger).toBeUndefined()
  })
})
