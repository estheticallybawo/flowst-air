import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { requestStudyBedrock } from '../server/services/studyBedrockTransport'

const state = vi.hoisted(() => ({ ledger: { requests: 0 }, sdkSend: vi.fn(), destroy: vi.fn() }))
vi.mock('../server/services/awsClientConfig', () => ({ awsClientConfig: () => ({}) }))
vi.mock('../server/services/studyModelBudget', () => ({ reserveBedrockTestingBudget: vi.fn(async () => { state.ledger.requests++ }) }))
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class { send = state.sdkSend; destroy = state.destroy },
  ConverseCommand: class { constructor(public input: unknown) {} },
}))
const request = { messages: [{ role: 'user' as const, content: 'Synthetic saved explanation.' }], max_completion_tokens: 600, temperature: 0.2 }
beforeEach(() => {
  state.ledger = { requests: 0 }
  state.sdkSend.mockReset()
  state.destroy.mockReset()
  vi.stubGlobal('useRuntimeConfig', () => ({ studyTextProvider: 'aws', studyBedrockApiKey: 'fixture-key', awsRegion: 'us-east-1' }))
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it.each([
  ['malformed_tool_use', 'AGENT_RESULT_INVALID', 502],
  ['malformed_model_output', 'AGENT_RESULT_INVALID', 502],
  ['guardrail_intervened', 'AGENT_RESPONSE_BLOCKED', 502],
  ['content_filtered', 'AGENT_RESPONSE_BLOCKED', 502],
  ['model_context_window_exceeded', 'AGENT_CONTEXT_TOO_LARGE', 413],
])('identifies %s without accepting private output or repeating a paid request', async (stopReason, code, statusCode) => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ stopReason, output: { message: { content: [{ text: 'private learner material' }, { toolUse: { name: 'propose_evidence_review', input: { private: 'unusable review' } } }] } } }), { headers: { 'x-amzn-requestid': 'fixture-request-123' } }))
  const error = await requestStudyBedrock(request).catch(error => error)
  expect(error).toMatchObject({ statusCode, data: { code, providerReason: stopReason } })
  expect(error.data.reference).toMatch(/^[a-f0-9-]{36}$/)
  expect(error.statusMessage).toContain(error.data.reference)
  expect(console.error).toHaveBeenCalledWith('Study model response unusable', expect.objectContaining({ code, providerReason: stopReason, providerRequestId: 'fixture-request-123', reference: error.data.reference }))
  expect(JSON.stringify(error) + JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private learner material|unusable review/)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(state.ledger.requests).toBe(1)
})
it('bounds unknown provider diagnostics and supports SDK request correlation', async () => {
  vi.stubGlobal('useRuntimeConfig', () => ({ studyTextProvider: 'aws' }))
  state.sdkSend.mockResolvedValue({ stopReason: 'private unrecognised provider text', $metadata: { requestId: 'fixture-sdk-request-123' }, output: { message: { content: [{ text: 'private output' }] } } })
  const error = await requestStudyBedrock(request).catch(error => error)
  expect(error).toMatchObject({ statusCode: 502, data: { code: 'AGENT_RESULT_INVALID', providerReason: 'unknown' } })
  expect(console.error).toHaveBeenCalledWith('Study model response unusable', expect.objectContaining({ providerReason: 'unknown', providerRequestId: 'fixture-sdk-request-123' }))
  expect(JSON.stringify(error) + JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private unrecognised|private output/)
  expect(state.sdkSend).toHaveBeenCalledTimes(1)
  expect(state.destroy).toHaveBeenCalledTimes(1)
})
