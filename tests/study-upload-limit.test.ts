import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStudyConversation, deleteStudyConversation, getStudyUploadEligibility, getStudyConversation, getStudyChunks, listStudyConversations, saveStudyPlan, abandonStudyDocument, acquireStudyLiveLease, releaseStudyLiveLease } from '../server/services/studyRepository'
import { prepareAminaTurn, finishAminaTurn, buildAminaLiveContext } from '../server/services/studyAmina'
import { generateMisuPlan, refreshMisuRecommendation } from '../server/services/studyMisu'
import { DEFAULT_STUDY_FUNCTION_REFS } from '../server/domain/neuromap/studyFunctions'
import { STUDY_LIVE_START_MESSAGE } from '../shared/studyLive'

let surface = 'air'
vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', public: { appSurface: surface } }))
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => { surface = 'air'; vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T12:00:00.000Z')) })
afterEach(() => vi.useRealTimers())
const extraction = { kind: 'PDF' as const, sections: [{ id: 'page-1', label: 'Page 1', text: 'Students explain the concept in their own words.' }], excerpt: 'Students explain the concept.' }
const upload = (ownerId: string) => createStudyConversation(ownerId, 'notes.pdf', 'application/pdf', Buffer.from('fake'), extraction)

async function completeObjectives(ownerId: string, id: string) {
  let study = await getStudyConversation(ownerId, id)
  const source = (await getStudyChunks(ownerId, id))[0]!
  study = await saveStudyPlan(ownerId, id, { status: 'APPROVED', version: 1, approvedBy: ownerId, approvedAt: new Date().toISOString(),
    activeObjectiveId: 'objective-1', objectives: [1, 2].map(index => ({ id: `objective-${index}`, title: `Explain concept ${index}`, outcome: 'Explain the concept', sources: [source] })),
    functionRefs: DEFAULT_STUDY_FUNCTION_REFS.map(ref => ({ ...ref })) }, study.revision)
  const opening = await prepareAminaTurn(ownerId, id, STUDY_LIVE_START_MESSAGE, undefined, true)
  await finishAminaTurn(ownerId, id, opening, 'Page 1 introduces explaining concepts. How would you explain it?', undefined, undefined, true, false)
  expect((await getStudyConversation(ownerId, id)).practice.attempts).toHaveLength(0)
  for (const objective of study.plan.objectives) {
    study = await getStudyConversation(ownerId, id)
    if (study.plan.activeObjectiveId !== objective.id) {
      study = await saveStudyPlan(ownerId, id, { ...study.plan, activeObjectiveId: objective.id }, study.revision)
      const nextOpening = await prepareAminaTurn(ownerId, id, STUDY_LIVE_START_MESSAGE, undefined, true)
      await finishAminaTurn(ownerId, id, nextOpening, 'Page 1 introduces the next concept. How would you explain it?', undefined, undefined, true, false)
    }
    const attempt = await prepareAminaTurn(ownerId, id, 'Students explain the concept in their own words.', undefined, true)
    await finishAminaTurn(ownerId, id, attempt, 'Page 1 supports that explanation. Can you explain another example?', undefined, undefined, true, false)
  }
  study = await getStudyConversation(ownerId, id)
  return saveStudyPlan(ownerId, id, { ...study.plan, courseCompletedAt: new Date().toISOString(), courseCompletedBy: ownerId }, study.revision)
}

describe('Amina active-document completion gate', () => {
  it('blocks another upload while planning failed and does not reset with the calendar', async () => {
    const first = await upload('gate-failed-plan')
    await saveStudyPlan('gate-failed-plan', first.id, { status: 'FAILED', version: 1, objectives: [], error: 'Planning temporarily unavailable.' }, first.revision)
    expect(await getStudyUploadEligibility('gate-failed-plan')).toMatchObject({ canUpload: false, existingConversationId: first.id, activeConversationId: first.id, completionRequired: true })
    vi.setSystemTime(new Date('2027-01-01T00:00:00.000Z'))
    await expect(upload('gate-failed-plan')).rejects.toMatchObject({ statusCode: 409, data: { code: 'AMIRA_STUDY_COMPLETION_REQUIRED' } })
    expect((await getStudyUploadEligibility('other-gate-owner')).canUpload).toBe(true)
  })
  it('deletion stays available but cannot bypass unfinished objectives', async () => {
    const first = await upload('gate-deleted')
    await deleteStudyConversation('gate-deleted', first.id)
    expect(await getStudyUploadEligibility('gate-deleted')).toMatchObject({ canUpload: false, activeConversationId: first.id, reasonCode: 'ACTIVE_STUDY_DELETED' })
    expect((await getStudyUploadEligibility('gate-deleted')).existingConversationId).toBeUndefined()
    await expect(upload('gate-deleted')).rejects.toMatchObject({ statusCode: 409 })
  })
  it('unlocks after confirmed source-linked objective activities, without oral-exam or clock claims', async () => {
    const first = await upload('gate-completed')
    await completeObjectives('gate-completed', first.id)
    expect((await getStudyUploadEligibility('gate-completed')).canUpload).toBe(true)
    await deleteStudyConversation('gate-completed', first.id)
    expect((await getStudyUploadEligibility('gate-completed')).canUpload).toBe(true)
    const second = await upload('gate-completed')
    expect(second.id).not.toBe(first.id)
    expect(await getStudyUploadEligibility('gate-completed')).toMatchObject({ canUpload: false, activeConversationId: second.id })
  })
  it('a completion flag without saved learner evidence never opens uploads', async () => {
    const first = await upload('gate-fake-completion')
    await saveStudyPlan('gate-fake-completion', first.id, { status: 'APPROVED', version: 1, approvedBy: 'gate-fake-completion',
      approvedAt: new Date().toISOString(), courseCompletedBy: 'gate-fake-completion', courseCompletedAt: new Date().toISOString(),
      objectives: [{ id: 'objective-1', title: 'Concept', outcome: 'Explain concept', sources: [{ id: 'page-1-0', label: 'Page 1', excerpt: 'Students explain the concept.' }] }] }, first.revision)
    expect((await getStudyUploadEligibility('gate-fake-completion')).canUpload).toBe(false)
  })
  it('explicit abandonment permits replacement and does not mark the previous plan complete', async () => {
    const first = await upload('gate-abandoned')
    await expect(abandonStudyDocument('another-owner', first.id)).rejects.toMatchObject({ statusCode: 409 })
    const lease = await acquireStudyLiveLease('gate-abandoned', first.id, 90000)
    await expect(abandonStudyDocument('gate-abandoned', first.id)).rejects.toMatchObject({ statusCode: 409 })
    await releaseStudyLiveLease(first.id, lease.leaseId)
    expect((await abandonStudyDocument('gate-abandoned', first.id)).canUpload).toBe(true)
    const saved = await getStudyConversation('gate-abandoned', first.id)
    expect(saved.plan.courseCompletedAt).toBeUndefined()
    expect(saved.abandonedAt).toBe(new Date().toISOString())
    expect((await listStudyConversations('gate-abandoned'))[0]).toMatchObject({ id: first.id, abandonedAt: saved.abandonedAt })
    for (const request of [() => prepareAminaTurn('gate-abandoned', first.id, 'Teach me', undefined, true),
      () => buildAminaLiveContext('gate-abandoned', first.id), () => generateMisuPlan('gate-abandoned', first.id),
      () => refreshMisuRecommendation('gate-abandoned', first.id), () => acquireStudyLiveLease('gate-abandoned', first.id),
      () => saveStudyPlan('gate-abandoned', first.id, saved.plan, saved.revision)])
      await expect(request()).rejects.toMatchObject({ statusCode: 409, data: { code: 'AMIRA_STUDY_ABANDONED' } })
    await upload('gate-abandoned')
    expect((await getStudyUploadEligibility('gate-abandoned')).canUpload).toBe(false)
    expect((await getStudyConversation('gate-abandoned', first.id)).abandonedAt).toBe(saved.abandonedAt)
    await deleteStudyConversation('gate-abandoned', first.id)
  })
  it('can explicitly abandon an owner’s deleted active source', async () => {
    const first = await upload('gate-deleted-recovery')
    await deleteStudyConversation('gate-deleted-recovery', first.id)
    expect((await getStudyUploadEligibility('gate-deleted-recovery')).canUpload).toBe(false)
    expect((await abandonStudyDocument('gate-deleted-recovery', first.id)).canUpload).toBe(true)
    await upload('gate-deleted-recovery')
  })
  it('admits only one of two concurrent uploads', async () => {
    const outcomes = await Promise.allSettled([upload('gate-concurrent'), upload('gate-concurrent')])
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect((outcomes.find(result => result.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409 })
  })
  it('adopts an existing legacy document and preserves full Flowst upload behavior', async () => {
    surface = 'flowst'
    const legacy = await upload('gate-existing')
    await upload('gate-local-unlimited'); await upload('gate-local-unlimited')
    surface = 'air'
    expect(await getStudyUploadEligibility('gate-existing')).toMatchObject({ canUpload: false, existingConversationId: legacy.id })
    await expect(upload('gate-existing')).rejects.toMatchObject({ statusCode: 409 })
  })
})
