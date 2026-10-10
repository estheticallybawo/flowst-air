import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const bedrock = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../server/services/studyBedrockTransport', () => ({ requestStudyBedrock: bedrock.request }))
import { groqStudyText } from '../server/services/studyInference'
import { misuReviewOutput, misuReviewSchema, parseMisuReview } from '../server/services/misuEvidenceReview'
import { shouldPauseStudyOnExit } from '../shared/studySessionRecovery'
import type { StudyConversation } from '../shared/study'
import type { StudyPacingState } from '../shared/studyPacing'

beforeEach(() => { vi.stubGlobal('useRuntimeConfig', () => ({ studyTextProvider: 'groq', groqApiKey: 'fixture', groqModel: 'fixture' })); bedrock.request.mockReset() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
const response = (calls: unknown[], finish_reason = 'stop') => new Response(JSON.stringify({ choices: [{ finish_reason, message: { tool_calls: calls } }] }))
const call = { function: { name: 'submit_objective_evidence', arguments: '{"fixture":true}' } }

it.each(['groq', 'aws'])('requests one structured review through %s without a fallback or second dispatch', async provider => {
  vi.stubGlobal('useRuntimeConfig', () => ({ studyTextProvider: provider, groqApiKey: 'fixture', groqModel: 'fixture' }))
  const fetcher = vi.fn(async (_url?: unknown, _init?: RequestInit) => response([call])); vi.stubGlobal('fetch', fetcher)
  bedrock.request.mockResolvedValue(response([call]))
  expect(await groqStudyText('review', [{ role: 'user', content: 'saved input' }], 2400, undefined, misuReviewOutput)).toBe('{"fixture":true}')
  const payload = provider === 'aws' ? bedrock.request.mock.calls[0]![0] : JSON.parse(fetcher.mock.calls[0]![1]!.body as string)
  expect(payload.tool_choice).toEqual({ type: 'function', function: { name: misuReviewOutput.name } })
  expect(payload.tools[0].function.parameters).toEqual(misuReviewOutput.parameters)
  expect(payload.tools[0].function.parameters.required).toHaveLength(8)
  expect(payload.tools[0].function.parameters.properties.learnerTurnIds).toBeUndefined()
  expect(fetcher).toHaveBeenCalledTimes(provider === 'aws' ? 0 : 1)
  expect(bedrock.request).toHaveBeenCalledTimes(provider === 'aws' ? 1 : 0)
})
it.each([{calls:[]}, {calls:[call, call]}, {calls:[{ function: { ...call.function, name: 'wrong_tool' } }]}])('rejects missing, repeated or wrong review calls', async ({calls}) => {
  const fetcher = vi.fn(async (_url?: unknown, _init?: RequestInit) => response(calls)); vi.stubGlobal('fetch', fetcher)
  await expect(groqStudyText('review', [], 2400, undefined, misuReviewOutput)).rejects.toMatchObject({ data: { code: 'AGENT_RESULT_INVALID' } })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('does not use a truncated tool call or repeat its dispatch', async () => {
  const fetcher = vi.fn(async (_url?: unknown, _init?: RequestInit) => response([call], 'length')); vi.stubGlobal('fetch', fetcher)
  await expect(groqStudyText('review', [], 2400, undefined, misuReviewOutput)).rejects.toMatchObject({ data: { code: 'AGENT_OUTPUT_INCOMPLETE' } })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('does not disclose invented field names, values or learner attribution from the model', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  let failure: any
  try { parseMisuReview(JSON.stringify({ PRIVATE_SECRET: 'PRIVATE_VALUE', learnerTurnIds: ['OTHER_LEARNER'] })) } catch (cause) { failure = cause }
  expect(failure.data.code).toBe('MISU_REVIEW_INVALID')
  expect(JSON.stringify(failure)+JSON.stringify(warn.mock.calls)).not.toMatch(/PRIVATE|OTHER_LEARNER/)
  expect(misuReviewSchema.shape).not.toHaveProperty('learnerTurnIds')
})
it('pauses only an owned approved active timer when leaving', () => {
  const study = { ownerId: 'owner', plan: { status: 'APPROVED', approvedBy: 'owner', pacing: {}, activeObjectiveId: 'o1' } } as StudyConversation
  const clock = { revision: 'current', objectiveId: 'o1', phase: 'PRACTICE' } as StudyPacingState
  expect(shouldPauseStudyOnExit(study, clock)).toBe(true)
  expect(shouldPauseStudyOnExit(study, { ...clock, phase: 'BREAK' })).toBe(true)
  for (const invalid of [null, { ...study, plan: { ...study.plan, status: 'FAILED' as const } }, { ...study, plan: { ...study.plan, approvedBy: 'other' } }, { ...study, abandonedAt: 'ended' }]) expect(shouldPauseStudyOnExit(invalid, clock)).toBe(false)
  for (const invalid of [null, { ...clock, phase: 'PAUSED' as const }, { ...clock, objectiveId: 'old' }, { ...clock, revision: '' }]) expect(shouldPauseStudyOnExit(study, invalid)).toBe(false)
})
