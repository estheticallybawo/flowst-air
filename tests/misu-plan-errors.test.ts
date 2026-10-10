import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { planWithAirsFunctions } from '../server/services/airsPlanning'
import { defaultObjectivePolicy } from '../shared/studyObjectivePolicy'
import { learnerStudyError } from '../shared/studyPresentation'
import { generateMisuPlan } from '../server/services/studyMisu'
import { createStudyConversation, deleteStudyConversation, getStudyChunks, getStudyConversation } from '../server/services/studyRepository'

const saved: Array<{ owner: string; id: string }> = []
beforeEach(() => {
  vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', studyTextProvider: 'groq', groqApiKey: 'fixture', groqModel: 'fixture', public: { appSurface: 'flowst' } }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(async () => {
  for (const item of saved.splice(0)) await deleteStudyConversation(item.owner, item.id)
  vi.unstubAllGlobals(); vi.restoreAllMocks()
})
function proposal(sourceId = 'web-1-0') {
  const objective = { id: 'objective-1', title: 'Explain the argument', outcome: 'Explain the author’s argument using its examples.', sources: [{ id: sourceId, label: 'Article passage 1', excerpt: 'Tools extend human capacities.' }] }
  return { title: 'Tools and Human Capacity', objectives: [{ title: objective.title, outcome: objective.outcome, sourceIds: [sourceId], estimatedMinutes: 3, policy: defaultObjectivePolicy(objective) }], rationale: 'Read and explain the argument.', conversationStrategy: 'Explain the author’s examples.', evaluationCriteria: [{ id: 'ACCURACY', description: 'Represent the argument accurately.' }] }
}
function provider(value: unknown) {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ id: 'proposal', function: { name: 'propose_session_plan', arguments: JSON.stringify(value) } }] } }] })))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const run = () => planWithAirsFunctions('misu-errors-test', 'Source-backed goals.', 'An article with no written learning objectives.')

describe('truthful Misu plan failure explanations', () => {
  it('identifies inconsistent criteria without returning or logging model text', async () => {
    const value = proposal()
    value.objectives[0]!.policy.evidenceTargets[0]!.requiredMeaning = ['private learner text, a secret token and hidden reasoning']
    const fetcher = provider(value)
    const error = await run().catch(cause => cause)
    expect(error).toMatchObject({ statusCode: 502, data: { code: 'AGENT_RESULT_INVALID', validationIssues: [{ path: 'objectives.0.policy', reason: 'CRITERIA_TARGET_MISMATCH' }] } })
    expect(error.statusMessage).toContain("objective 1's success criteria do not match its evidence targets")
    expect(learnerStudyError({ data: { statusMessage: error.statusMessage } }, 'Generic failure.')).toBe(error.statusMessage)
    expect(JSON.stringify(error) + JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private learner text')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('identifies a missing field and objective number', async () => {
    const value: any = proposal(); delete value.objectives[0].policy.version
    provider(value)
    const error = await run().catch(cause => cause)
    expect(error.data.validationIssues[0]).toMatchObject({ path: 'objectives.0.policy.version', reason: 'MISSING_FIELD' })
    expect(error.statusMessage).toContain('objective 1 is missing its success-criteria version')
  })
  it('distinguishes an unsupported value from a missing field without reflecting it', async () => {
    const value: any = proposal(); value.objectives[0].policy.version = 'private-invalid-version'
    provider(value)
    const error = await run().catch(cause => cause)
    expect(error.statusMessage).toContain('objective 1 has an unsupported value for its success-criteria version')
    expect(JSON.stringify(error) + JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-invalid-version')
  })
  it('does not reflect unexpected property names into the API or logs', async () => {
    const value: any = proposal(); value['private-credential-name'] = 'private-secret-value'
    provider(value)
    const error = await run().catch(cause => cause)
    expect(error.statusMessage).toContain('unexpected fields')
    expect(error.data.validationIssues[0]).toMatchObject({ reason: 'UNEXPECTED_FIELDS' })
    expect(JSON.stringify(error) + JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private-credential-name|private-secret-value/)
  })
  it('preserves the specific explanation and original source when plan generation fails', async () => {
    const owner = 'misu-persisted-error'
    const study = await createStudyConversation(owner, 'article', 'text/plain', Buffer.from('article'), { kind: 'WEB', sections: [{ id: 'web-1', label: 'Article passage 1', text: 'Tools extend human capacities.' }], excerpt: 'Tools extend human capacities.' })
    saved.push({ owner, id: study.id })
    const chunks = await getStudyChunks(owner, study.id)
    const value: any = proposal(chunks[0]!.id); delete value.objectives[0].policy.version
    provider(value)
    const error = await generateMisuPlan(owner, study.id).catch(cause => cause)
    expect(error.statusMessage).toContain('objective 1 is missing its success-criteria version')
    const reloaded = await getStudyConversation(owner, study.id)
    expect(reloaded.plan.status).toBe('FAILED')
    expect(reloaded.plan.error).toBe(error.statusMessage)
    expect(await getStudyChunks(owner, study.id)).toEqual(chunks)
  })
  it.each([
    { duplicateId: true, reason: 'DUPLICATE_TARGET_IDS', detail: 'repeats a practice-check identifier' },
    { duplicateId: false, reason: 'REPEATED_CRITERIA', detail: 'repeats a success criterion in its practice checks' },
  ])('distinguishes $reason from criteria that do not match', async ({ duplicateId, reason, detail }) => {
    const value = proposal(), policy = value.objectives[0]!.policy
    policy.evidenceTargets.push({ ...policy.evidenceTargets[0]!, id: duplicateId ? policy.evidenceTargets[0]!.id : 'another-target' })
    provider(value)
    const error = await run().catch(cause => cause)
    expect(error.data.validationIssues[0].reason).toBe(reason)
    expect(error.statusMessage).toContain(detail)
  })
})
