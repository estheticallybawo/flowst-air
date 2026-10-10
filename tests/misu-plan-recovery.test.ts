import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateMisuPlan } from '../server/services/studyMisu'
import { createStudyConversation, deleteStudyConversation, getStudyChunks, getStudyConversation } from '../server/services/studyRepository'
import type { StudyPreferences } from '../shared/study'

const saved: Array<{ owner: string; id: string }> = []
const preferences: StudyPreferences = { purpose: 'UNDERSTAND', scope: 'BROAD', timeBudgetMinutes: 15, context: '' }
beforeEach(() => {
  vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', studyTextProvider: 'groq', groqApiKey: 'fixture', groqModel: 'fixture', public: { appSurface: 'flowst' } }))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(async () => {
  for (const item of saved.splice(0)) await deleteStudyConversation(item.owner, item.id)
  vi.unstubAllGlobals(); vi.restoreAllMocks()
})
async function source() {
  const owner = 'plan-recovery-' + randomUUID()
  const text = 'The author argues that tools extend human capacities, involve tradeoffs, and need human checking mechanisms.'
  const study = await createStudyConversation(owner, 'Before AI, We Were Already Extending Ourselves', 'application/json', Buffer.from(text), { kind: 'WEB', sections: [{ id: 'web-1', label: 'Article passage 1', text }], excerpt: text }, undefined, preferences)
  saved.push({ owner, id: study.id })
  const chunks = await getStudyChunks(owner, study.id)
  return { owner, study, sourceId: chunks[0]!.id }
}
function modelProposal(sourceId: string) {
  return { objectives: ['Explain tools as human extensions', 'Describe the author’s tradeoffs', 'Explain human checking mechanisms'].map(title => ({ title, outcome: `The learner can ${title.toLowerCase()} using the author’s examples.`, sourceIds: [sourceId], estimatedMinutes: 3 })), rationale: 'Use the article’s argument to guide source-backed explanation practice. '.repeat(20), conversationStrategy: 'Read the examples and explain the author’s argument.', evaluationCriteria: [{ id: 'ACCURACY', description: 'Represent the source argument accurately.' }] }
}
function provider(value: unknown) {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ id: 'proposal', function: { name: 'propose_session_plan', arguments: JSON.stringify(value) } }] } }] })))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('Misu plan recovery from observed web-source failures', () => {
  it('uses existing grounded title and policy fallbacks and bounds an overlong explanation without another model call', async () => {
    const { owner, study, sourceId } = await source()
    const fetcher = provider(modelProposal(sourceId))
    const result = await generateMisuPlan(owner, study.id)
    expect(result.plan.status).toBe('DRAFT')
    expect(result.plan.approvedAt).toBeUndefined()
    expect(result.document.title).toBe('Explain tools as human extensions')
    expect(result.plan.objectives).toHaveLength(3)
    expect(result.plan.rationale!.length).toBeLessThanOrEqual(700)
    for (const objective of result.plan.objectives) {
      expect(objective.policy?.version).toBe('0.2')
      expect(objective.policy?.successCriteria.requiredMeaning).toEqual([objective.outcome])
      expect(objective.policy?.evidenceTargets[0]?.sourceIds).toEqual([sourceId])
    }
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect((await getStudyConversation(owner, study.id)).plan.status).toBe('DRAFT')
  })
  it('still rejects an invented passage reference while retaining the extracted source', async () => {
    const { owner, study } = await source()
    provider(modelProposal('invented-passage'))
    await expect(generateMisuPlan(owner, study.id)).rejects.toMatchObject({ statusCode: 502, statusMessage: 'Misu cited a missing document passage. Regenerate the plan.' })
    expect((await getStudyConversation(owner, study.id)).plan.status).toBe('FAILED')
    expect(await getStudyChunks(owner, study.id)).toHaveLength(1)
  })
  it('still rejects an objective without a learning outcome', async () => {
    const { owner, study, sourceId } = await source()
    const value: any = modelProposal(sourceId); delete value.objectives[0].outcome
    provider(value)
    await expect(generateMisuPlan(owner, study.id)).rejects.toMatchObject({ statusCode: 502, data: { code: 'AGENT_RESULT_INVALID' } })
    expect((await getStudyConversation(owner, study.id)).plan.status).toBe('FAILED')
  })
  it('reports additional failed checks instead of suggesting that the first displayed field is the only problem', async () => {
    const { owner, study, sourceId } = await source()
    const value: any = modelProposal(sourceId); delete value.objectives[0].title; delete value.objectives[0].outcome
    provider(value)
    const error = await generateMisuPlan(owner, study.id).catch(cause => cause)
    expect(error.data.validationIssueCount).toBe(2)
    expect(error.statusMessage).toContain('1 other check also failed.')
  })
})
