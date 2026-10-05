import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STUDY_FUNCTION_REFS } from '../server/domain/neuromap/studyFunctions'
import { finishAminaTurn, nextPracticeState, prepareAminaTurn } from '../server/services/studyAmina'
import { groqStudyText } from '../server/services/studyInference'
import { appendStudyTurn, createStudyConversation, deleteStudyConversation, getStudyChunks, getStudyConversation, getStudyPedagogyHistory, saveStudyPlan, updateStudyMode } from '../server/services/studyRepository'
import { isStudySocialInput } from '../shared/studyConversation'
import type { StudyConversation, StudyMode } from '../shared/study'

vi.mock('../server/services/studyInference', () => ({ groqStudyText: vi.fn() }))
const studies: Array<{ owner: string; id: string }> = []
beforeEach(() => {
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', studySourceFixtureMode: true, public: { appSurface: 'flowst' } }))
  vi.mocked(groqStudyText).mockReset()
})
afterEach(async () => {
  for (const study of studies.splice(0)) await deleteStudyConversation(study.owner, study.id)
  vi.unstubAllGlobals()
})

async function fixture() {
  const owner = 'conversation-' + randomUUID()
  const sections = [
    { id: 'purpose', label: 'System design · lines 1–4', text: 'This is the canonical reference for the system design. It explains the system architecture to developers and agents.' },
    { id: 'boundaries', label: 'Agent boundaries · lines 5–9', text: 'Misu proposes the learning path. Amina guides spoken practice. Kai reviews saved evidence, keeping their responsibilities distinct.' },
  ]
  const study = await createStudyConversation(owner, 'design.txt', 'text/plain', Buffer.from('fixture'), { kind: 'WEB', sections, excerpt: sections[0]!.text })
  studies.push({ owner, id: study.id })
  const sources = await getStudyChunks(owner, study.id)
  const objectives = sources.map((source, index) => ({ id: 'objective-' + (index + 1), title: index ? 'Agent boundaries' : 'Document purpose', outcome: index ? 'Explain distinct agent responsibilities.' : 'Explain the purpose of the canonical design reference.', sources: [source] }))
  await saveStudyPlan(owner, study.id, { status: 'APPROVED', version: 1, approvedBy: owner, approvedAt: new Date().toISOString(), activeObjectiveId: 'objective-1', objectives, functionRefs: DEFAULT_STUDY_FUNCTION_REFS.map(ref => ({ ...ref })) }, study.revision)
  for (const turn of [
    { role: 'AMIRA' as const, kind: 'WELCOME' as const, text: 'Welcome. Start when ready.' },
    { role: 'USER' as const, kind: 'CONTROL' as const, text: "I'm ready" },
    { role: 'AMIRA' as const, kind: 'INTRO' as const, text: 'How would you describe the purpose of this reference?' },
  ]) await appendStudyTurn(owner, study.id, { ...turn, id: randomUUID(), mode: 'DISCUSSION', objectiveId: 'objective-1', sources: [], createdAt: new Date().toISOString() })
  return { owner, id: study.id, sources }
}

describe('Amina conversational progression', () => {
  it.each(['Hi, I\'m Mira', 'Hi, Amina', "I'm ready", 'Thank you.'])('keeps %s social without recording learning evidence', async text => {
    expect(isStudySocialInput(text)).toBe(true)
    const study = await fixture()
    const prepared = await prepareAminaTurn(study.owner, study.id, text)
    expect(prepared.userTurn.kind).not.toBe('PRACTICE')
    await finishAminaTurn(study.owner, study.id, prepared, 'Hello. We can continue when you are ready.')
    expect((await getStudyConversation(study.owner, study.id)).practice.attempts).toHaveLength(0)
    expect((await getStudyPedagogyHistory(study.owner, study.id)).evidence).toHaveLength(0)
    expect(groqStudyText).not.toHaveBeenCalled()
  })

  it.each(['DISCUSSION', 'ORAL_EXAM', 'SCENARIO'] as StudyMode[])('does not consume a %s question for a greeting', mode => {
    const practice = { questionNumber: 2, totalQuestions: 5, awaitingAnswer: true, attempts: [] }
    const study = { mode, practice, plan: { activeObjectiveId: 'objective-1' }, turns: [] } as unknown as StudyConversation
    expect(nextPracticeState(study, "Hi, I'm Mira", 'Hello.', [])).toEqual(practice)
  })

  it('does not discard a substantive explanation beginning with a greeting or acknowledgment', () => {
    expect(isStudySocialInput('Hi, I am explaining the purpose of the canonical reference.')).toBe(false)
    expect(isStudySocialInput('Okay, it is the main guide for understanding the system.')).toBe(false)
  })

  it('reviews the first durable answer and preserves validated source grounding without exact spoken labels', async () => {
    const study = await fixture()
    const prepared = await prepareAminaTurn(study.owner, study.id, 'It is the main authoritative reference for understanding the system design.')
    vi.mocked(groqStudyText).mockImplementation(async (_policy, messages) => {
      const review = JSON.parse(messages[0]!.content)
      return JSON.stringify({ ready: true, reason: 'The purpose is explained in the learner’s own words.', evidenceIds: [review.attempts[0].evidenceId], sourceIds: [review.passages[0].id] })
    })
    const reply = await finishAminaTurn(study.owner, study.id, prepared, 'You described the reference’s purpose. How could a developer use it when changing the system?')
    expect(reply.sources.map(source => source.id)).toEqual([study.sources[0]!.id])
    const saved = await getStudyConversation(study.owner, study.id)
    expect(saved.practice.attempts).toHaveLength(1)
    expect(saved.plan.recommendation?.action).toBe('ADVANCE')
    expect(saved.plan.activeObjectiveId).toBe('objective-1')
    expect(groqStudyText).toHaveBeenCalledTimes(1)
    const next = await prepareAminaTurn(study.owner, study.id, 'Can I move on?')
    expect(next.system).toContain('Misu has saved a recommendation')
    expect(next.system).toContain('do not demand another answer to the same question')
  })

  it('introduces the newly active objective and does not reuse the previous objective’s question', async () => {
    const study = await fixture()
    const previous = await getStudyConversation(study.owner, study.id)
    await saveStudyPlan(study.owner, study.id, { ...previous.plan, activeObjectiveId: 'objective-2' }, previous.revision)
    const next = await prepareAminaTurn(study.owner, study.id, "I'm ready")
    expect(next.packet.stage).toBe('INTRODUCTION')
    expect(next.system).toContain('This approved objective is beginning')
    expect(next.retrieval.sources.map(source => source.id)).toEqual([study.sources[1]!.id])
    await finishAminaTurn(study.owner, study.id, next, 'Misu plans and Kai reviews evidence. Why keep those roles distinct?')
    const saved = await getStudyConversation(study.owner, study.id)
    expect(saved.turns.at(-1)).toMatchObject({ kind: 'INTRO', objectiveId: 'objective-2' })
    const attempt = nextPracticeState(saved, 'The separate roles keep teaching and reviewing evidence distinct.', 'That distinction is supported.', [])
    expect(attempt.attempts.at(-1)?.question).toContain('Why keep those roles distinct?')
    expect(attempt.attempts.at(-1)?.objectiveId).toBe('objective-2')
  })

  it('retains the full approved source scope for whole-document practice', async () => {
    const study = await fixture()
    const saved = await getStudyConversation(study.owner, study.id)
    await saveStudyPlan(study.owner, study.id, { ...saved.plan, courseCompletedAt: new Date().toISOString(), courseCompletedBy: study.owner }, saved.revision)
    await updateStudyMode(study.owner, study.id, 'ORAL_EXAM', saved.practice)
    const prepared = await prepareAminaTurn(study.owner, study.id, 'Please start my five-question oral exam')
    expect(prepared.packet.sourceIds).toEqual(study.sources.map(source => source.id))
    expect(prepared.retrieval.sources.map(source => source.id)).toContain(study.sources[1]!.id)
  })

  it('keeps approved legacy plans usable with semantic feedback and no inferred learner name', async () => {
    const study = await fixture()
    const saved = await getStudyConversation(study.owner, study.id)
    await saveStudyPlan(study.owner, study.id, { ...saved.plan, functionRefs: saved.plan.functionRefs!.map(ref => ({ ...ref, version: '1' })) }, saved.revision)
    const prepared = await prepareAminaTurn(study.owner, study.id, 'It is the canonical reference for understanding the system design.')
    expect(prepared.system).toContain('a faithful paraphrase counts')
    expect(prepared.system).toContain('conditional on an actual missing or mistaken idea')
    expect(prepared.system).toContain('Address the learner as you')
    expect(prepared.system).toContain('Your name is Amina; Misu plans and Kai reviews evidence')
  })
})
