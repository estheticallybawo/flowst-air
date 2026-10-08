import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMisuSourceInventory, MISU_INVENTORY_MAX_CHARS } from '../server/services/studyPlanningInventory'
import { generateMisuPlan } from '../server/services/studyMisu'
import { planWithAirsFunctions } from '../server/services/airsPlanning'
import { createStudyConversation, deleteStudyConversation, getStudyChunks, getStudyConversation } from '../server/services/studyRepository'

vi.mock('../server/services/airsPlanning', () => ({ planWithAirsFunctions: vi.fn() }))
const saved: Array<{ owner: string; id: string }> = []
const chunks = (count: number) => Array.from({ length: count }, (_, position) => ({ id: `p-${position}`, label: `Page ${position}`, position, text: `Source topic ${position}. ` + 'This original text supports the selected study topic. '.repeat(20), excerpt: `Source topic ${position}.` }))
beforeEach(() => {
  vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', studySourceFixtureMode: false, public: { appSurface: 'flowst' } }))
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected provider dispatch') }))
  vi.mocked(planWithAirsFunctions).mockReset()
})
afterEach(async () => { for (const item of saved.splice(0)) await deleteStudyConversation(item.owner, item.id); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('bounded extractive Misu planning', () => {
  it('includes first, middle and final regions without modifying or discarding saved passages', () => {
    const source = chunks(501), before = structuredClone(source), preview = buildMisuSourceInventory(source)
    expect(preview.text.length).toBeLessThanOrEqual(MISU_INVENTORY_MAX_CHARS)
    expect(preview.chunks).toHaveLength(80)
    expect(preview.chunks[0]?.id).toBe('p-0')
    expect(preview.chunks.at(-1)?.id).toBe('p-500')
    expect(preview.chunks.some(chunk => chunk.position > 240 && chunk.position < 260)).toBe(true)
    expect(preview.coverageNote).toContain('80 of 501')
    expect(source).toEqual(before)
    for (const row of preview.text.split('\n').slice(1).map(line => JSON.parse(line))) {
      const original = source.find(chunk => chunk.id === row.id)!
      expect(original.text.startsWith(row.text)).toBe(true)
      expect(row.label).toBe(original.label)
    }
    expect(fetch).not.toHaveBeenCalled()
  })
  it('retains a focused match outside the evenly spaced selection', () => {
    const source = chunks(501), plain = buildMisuSourceInventory(source)
    const target = source.find(chunk => !plain.chunks.includes(chunk))!
    target.text = 'Kinship ethnography describes community relationships.'
    const focused = buildMisuSourceInventory(source, { purpose: 'UNDERSTAND', scope: 'FOCUSED', timeBudgetMinutes: 15, context: 'kinship ethnography' })
    expect(focused.chunks).toContain(target)
    expect(focused.chunks).toHaveLength(80)
    expect(focused.chunks[0]?.position).toBe(0)
    expect(focused.chunks.at(-1)?.position).toBe(500)
  })
  it('bounds encoded quotes, controls and long labels while keeping source identifiers exact', () => {
    const source = chunks(120).map(chunk => ({ ...chunk, label: 'heading '.repeat(60), text: '\u0001"\n'.repeat(800) }))
    const preview = buildMisuSourceInventory(source)
    expect(preview.text.length).toBeLessThanOrEqual(MISU_INVENTORY_MAX_CHARS)
    for (const row of preview.text.split('\n').slice(1).map(line => JSON.parse(line))) expect(source.find(chunk => chunk.id === row.id)?.text.startsWith(row.text)).toBe(true)
    expect(() => buildMisuSourceInventory([])).toThrow(/no readable passages/)
  })

  async function savedSource() {
    const owner = 'planning-' + randomUUID(), text = 'Anthropology examines human societies and cultural practices.'
    const study = await createStudyConversation(owner, 'anthropology.pdf', 'application/pdf', Buffer.from('fixture bytes'), { kind: 'PDF', sections: Array.from({ length: 101 }, (_, i) => ({ id: 'page-' + i, label: 'Page ' + i, text })), excerpt: text })
    saved.push({ owner, id: study.id })
    return { owner, study, source: await getStudyChunks(owner, study.id) }
  }
  function proposal(sourceId: string) {
    return { title: 'Understanding Human Societies', objectives: [{ title: 'Explain anthropology', outcome: 'Explain the study of societies.', sourceIds: [sourceId], estimatedMinutes: 2 }], rationale: 'Source-backed explanation practice.', conversationStrategy: 'Teach back.', evaluationCriteria: [{ id: 'ACCURACY', description: 'Explain the source meaning.' }] } as unknown as Awaited<ReturnType<typeof planWithAirsFunctions>>
  }
  it('prepares a saved large source with one planner invocation, no summary dispatch, and explicit coverage', async () => {
    const { owner, study, source } = await savedSource()
    vi.mocked(planWithAirsFunctions).mockResolvedValue(proposal(source[0]!.id))
    const planned = await generateMisuPlan(owner, study.id)
    expect(planWithAirsFunctions).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
    expect(planned.plan.status).toBe('DRAFT')
    expect(planned.plan.approvedAt).toBeUndefined()
    expect(planned.plan.rationale).toContain('80 of 101 indexed passages')
    expect(await getStudyChunks(owner, study.id)).toEqual(source)
    expect(vi.mocked(planWithAirsFunctions).mock.calls[0]![2]).toContain('"id":"' + source.at(-1)!.id + '"')
  })
  it('rejects a citation to an omitted passage while preserving the source for retry', async () => {
    const { owner, study, source } = await savedSource(), preview = buildMisuSourceInventory(source)
    const omitted = source.find(chunk => !preview.chunks.includes(chunk))!
    vi.mocked(planWithAirsFunctions).mockResolvedValue(proposal(omitted.id))
    await expect(generateMisuPlan(owner, study.id)).rejects.toMatchObject({ statusCode: 502 })
    expect((await getStudyConversation(owner, study.id)).plan.status).toBe('FAILED')
    expect(await getStudyChunks(owner, study.id)).toEqual(source)
    expect(fetch).not.toHaveBeenCalled()
  })
})
