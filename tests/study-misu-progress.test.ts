import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compileAirStudyPacket, DEFAULT_STUDY_FUNCTION_REFS, STUDY_FUNCTION_REGISTRY } from '../server/domain/neuromap/studyFunctions'
import { prepareAminaTurn, finishAminaTurn } from '../server/services/studyAmina'
import { groqStudyText } from '../server/services/studyInference'
import { recommendMisuProgress, refreshMisuRecommendation } from '../server/services/studyMisu'
import { appendStudyTurn, createStudyConversation, deleteStudyConversation, getStudyChunks, getStudyConversation, getStudyPedagogyHistory, saveStudyPlan } from '../server/services/studyRepository'
import type { StudyConversation } from '../shared/study'

vi.mock('../server/services/studyInference', () => ({ groqStudyText: vi.fn() }))
const created: Array<{ owner: string; id: string }> = []
beforeEach(() => {
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', studySourceFixtureMode: true, public: { appSurface: 'flowst' } }))
  vi.mocked(groqStudyText).mockReset()
})
afterEach(async () => {
  for (const study of created.splice(0)) await deleteStudyConversation(study.owner, study.id)
  vi.unstubAllGlobals()
})

async function fixture(count = 2) {
  const owner = 'progress-' + randomUUID()
  const text = 'FLOWST AIR SYSTEM DESIGN. This is the canonical document for the system design. Its agent boundaries keep planning, conversation and evidence review distinct.'
  const study = await createStudyConversation(owner, 'system-design.txt', 'text/plain', Buffer.from(text), {
    kind: 'WEB', sections: [{ id: 'section-1', label: 'System design · lines 1–4', text }], excerpt: 'Canonical document', provenance: { fixture: true, url: 'https://example.com/design-fixture', provider: 'Local fixture', retrievedAt: new Date().toISOString(), hash: 'fixture', omissions: [] },
  })
  created.push({ owner, id: study.id })
  const source = (await getStudyChunks(owner, study.id))[0]!
  const objectives = [
    { id: 'objective-1', title: 'Identify the document purpose', outcome: 'Explain the primary purpose of the system design document in your own words.', sources: [{ id: source.id, label: source.label, excerpt: 'Canonical document' }] },
    { id: 'objective-2', title: 'Explain agent responsibilities', outcome: 'Explain why planning, conversation and review have distinct responsibilities.', sources: [{ id: source.id, label: source.label, excerpt: 'Agent boundaries' }] },
  ].slice(0, count)
  await saveStudyPlan(owner, study.id, { status: 'APPROVED', version: 1, approvedBy: owner, approvedAt: new Date().toISOString(),
    activeObjectiveId: objectives[0]!.id, objectives, functionRefs: DEFAULT_STUDY_FUNCTION_REFS.map(ref => ({ ...ref })) }, study.revision)
  await appendStudyTurn(owner, study.id, { id: randomUUID(), role: 'AMIRA', kind: 'WELCOME', mode: 'DISCUSSION', text: 'Welcome.', sources: [], objectiveId: 'objective-1', createdAt: new Date().toISOString() })
  await appendStudyTurn(owner, study.id, { id: randomUUID(), role: 'USER', kind: 'CONTROL', mode: 'DISCUSSION', text: "I'm ready", sources: [], objectiveId: 'objective-1', createdAt: new Date().toISOString() })
  await appendStudyTurn(owner, study.id, { id: randomUUID(), role: 'AMIRA', kind: 'INTRO', mode: 'DISCUSSION', text: 'What is the primary purpose of the design document?', sources: [source], objectiveId: 'objective-1', createdAt: new Date().toISOString() })
  return { owner, id: study.id, source }
}

async function attempt(study: Awaited<ReturnType<typeof fixture>>, answer: string, feedback = 'The authoritative reference paraphrase is correct.') {
  const prepared = await prepareAminaTurn(study.owner, study.id, answer)
  await finishAminaTurn(study.owner, study.id, prepared, feedback + ' ' + study.source.label, undefined, undefined, true, false)
  return getStudyConversation(study.owner, study.id)
}

async function decision(study: Awaited<ReturnType<typeof fixture>>, ready: boolean, overrides: Record<string, unknown> = {}) {
  const evidence = (await getStudyPedagogyHistory(study.owner, study.id)).evidence.at(-1)!
  vi.mocked(groqStudyText).mockResolvedValue(JSON.stringify({ ready,
    reason: ready ? 'The explanation identifies the document as the authoritative design reference.' : 'The explanation needs to identify the document as a design reference.',
    evidenceIds: [evidence.id], sourceIds: [study.source.id], ...overrides }))
}

describe('Misu evidence-based document checkpoints', () => {
  it('accepts a faithful canonical/authoritative paraphrase without inheriting erroneous coaching', async () => {
    const study = await fixture()
    const saved = await attempt(study, 'It is the authoritative source people use to understand the system design.', 'Bad coaching: authoritative is not explicitly canonical, so try again.')
    await decision(study, true)
    const result = await recommendMisuProgress(saved, 'unused answer', 'unused coaching')
    expect(result).toMatchObject({ action: 'ADVANCE', objectiveId: 'objective-2', basedOnAttemptCount: 1 })
    const [policy, messages] = vi.mocked(groqStudyText).mock.calls[0]!
    expect(policy).toContain('faithful paraphrases')
    const input = JSON.parse(messages[0]!.content)
    expect(input.passages[0].text).toContain('agent boundaries keep planning')
    expect(input.attempts[0].answer).toContain('authoritative source')
    expect(JSON.stringify(input)).not.toContain('Bad coaching')
    expect((await getStudyConversation(study.owner, study.id)).plan.activeObjectiveId).toBe('objective-1')
  })

  it('returns revisit for an incorrect answer instead of advancing on attempt count', async () => {
    const study = await fixture()
    const saved = await attempt(study, 'The design document is a script for changing everyone’s bank details.')
    await decision(study, false)
    expect(await recommendMisuProgress(saved, '', '')).toMatchObject({ action: 'REVISIT', objectiveId: 'objective-1' })
  })

  it('does not treat uncertainty, greetings or name-only text as understanding', async () => {
    const study = await fixture()
    const saved = await attempt(study, "I don't know")
    expect(await recommendMisuProgress(saved, '', '')).toMatchObject({ action: 'REVISIT' })
    expect(groqStudyText).not.toHaveBeenCalled()
    const greeting = await attempt(study, "Hi, I'm Mira")
    expect(await recommendMisuProgress(greeting, '', '')).toMatchObject({ action: 'REVISIT' })
    expect(groqStudyText).not.toHaveBeenCalled()
  })

  it.each([
    { evidenceIds: ['invented'] }, { sourceIds: ['invented'] }, { evidenceIds: [] }, { sourceIds: [] },
  ])('rejects unsupported ready citations %j', async overrides => {
    const study = await fixture()
    const saved = await attempt(study, 'It is the canonical reference for the system design.')
    await decision(study, true, overrides)
    await expect(recommendMisuProgress(saved, '', '')).rejects.toMatchObject({ statusCode: 502 })
    expect((await getStudyConversation(study.owner, study.id)).plan.recommendation).toBeUndefined()
  })

  it('does not accept an explanation detached from its saved execution evidence', async () => {
    const study = await fixture()
    const saved = await attempt(study, 'It is the canonical reference for the system design.')
    saved.practice.attempts[0]!.answer = 'Fabricated replacement answer'
    expect(await recommendMisuProgress(saved, '', '')).toMatchObject({ action: 'REVISIT' })
    expect(groqStudyText).not.toHaveBeenCalled()
  })

  it('keeps a current ready proposal stable without completing or silently advancing', async () => {
    const study = await fixture(1)
    await attempt(study, 'It is the main authoritative reference that explains the system design.')
    await decision(study, true)
    const reviewed = await refreshMisuRecommendation(study.owner, study.id)
    expect(reviewed.plan.recommendation?.action).toBe('COMPLETE')
    expect(reviewed.plan.courseCompletedAt).toBeUndefined()
    await refreshMisuRecommendation(study.owner, study.id)
    expect(groqStudyText).toHaveBeenCalledTimes(1)
    await expect(refreshMisuRecommendation('another-owner', study.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('does not save a stale model decision over a newer plan revision', async () => {
    const study = await fixture()
    await attempt(study, 'It is the canonical reference for the system design.')
    const evidence = (await getStudyPedagogyHistory(study.owner, study.id)).evidence.at(-1)!
    vi.mocked(groqStudyText).mockImplementation(async () => {
      const latest = await getStudyConversation(study.owner, study.id)
      await saveStudyPlan(study.owner, study.id, { ...latest.plan, activeObjectiveId: 'objective-2' }, latest.revision)
      return JSON.stringify({ ready: true, reason: 'The purpose is explained.', evidenceIds: [evidence.id], sourceIds: [study.source.id] })
    })
    await expect(refreshMisuRecommendation(study.owner, study.id)).rejects.toMatchObject({ statusCode: 409 })
    const latest = await getStudyConversation(study.owner, study.id)
    expect(latest.plan.activeObjectiveId).toBe('objective-2')
    expect(latest.plan.recommendation).toBeUndefined()
  })
})

describe('published teach-back versions and objective introductions', () => {
  it('publishes v3 while preserving immutable v1/v2 and compatible existing approvals', async () => {
    expect(DEFAULT_STUDY_FUNCTION_REFS[1]?.version).toBe('3')
    expect(Object.isFrozen(STUDY_FUNCTION_REGISTRY['self-explanation-teach-back@2'])).toBe(true)
    expect(STUDY_FUNCTION_REGISTRY['self-explanation-teach-back@1']?.requiredBehaviors.join(' ')).toContain('one supported strength and one gap')
    expect(Object.isFrozen(STUDY_FUNCTION_REGISTRY['self-explanation-teach-back@1'])).toBe(true)
    const study = await fixture()
    const saved = await getStudyConversation(study.owner, study.id)
    const legacy: StudyConversation = { ...saved, plan: { ...saved.plan, functionRefs: saved.plan.functionRefs!.map(ref => ({ ...ref, version: '1' })) } }
    expect(compileAirStudyPacket(legacy).functionRefs[1]?.version).toBe('1')
    expect(compileAirStudyPacket(saved).functionRefs[1]?.version).toBe('3')
    expect(() => compileAirStudyPacket({ ...saved, plan: { ...saved.plan, functionRefs: saved.plan.functionRefs!.map(ref => ({ ...ref, version: '99' })) } } as StudyConversation)).toThrow(/unpublished/)
  })

  it('introduces the active objective rather than reusing an earlier objective introduction', async () => {
    const study = await fixture()
    const saved = await getStudyConversation(study.owner, study.id)
    expect(compileAirStudyPacket(saved).stage).toBe('GUIDED_PRACTICE')
    const next = { ...saved, plan: { ...saved.plan, activeObjectiveId: 'objective-2' } }
    expect(compileAirStudyPacket(next).stage).toBe('INTRODUCTION')
    next.turns = [...next.turns, { id: randomUUID(), role: 'AMIRA', kind: 'INTRO', mode: 'DISCUSSION', objectiveId: 'objective-2', text: 'Let’s explore agent boundaries.', sources: [], createdAt: new Date().toISOString() }]
    expect(compileAirStudyPacket(next).stage).toBe('GUIDED_PRACTICE')
  })
})
