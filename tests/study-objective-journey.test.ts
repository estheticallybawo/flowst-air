import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const request = vi.hoisted(() => ({ owner: '', id: '', objectiveId: '' }))
vi.hoisted(() => vi.stubGlobal('defineEventHandler', (handler: unknown) => handler))
vi.mock('../server/utils/auth', () => ({ requireIdentity: async () => ({ userId: request.owner }) }))
vi.mock('../server/services/studyInference', () => ({ groqStudyText: vi.fn() }))

import confirm from '../server/api/study/conversations/[id]/plan/confirm.post'
import { DEFAULT_STUDY_FUNCTION_REFS } from '../server/domain/neuromap/studyFunctions'
import { prepareAminaTurn, finishAminaTurn } from '../server/services/studyAmina'
import { groqStudyText } from '../server/services/studyInference'
import { changeStudyPacing, getStudyPacing, assertStudyPacingOpen } from '../server/services/studyPacing'
import { createKaiReview } from '../server/services/airsKai'
import { deriveAirsJourney } from '../shared/airsJourney'
import { acquireStudyLiveLease, releaseStudyLiveLease, appendStudyTurn, createStudyConversation, deleteStudyConversation, getStudyChunks, getStudyConversation, getStudyPedagogyHistory, saveStudyPlan } from '../server/services/studyRepository'

beforeEach(() => {
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', studySourceFixtureMode: true, public: { appSurface: 'flowst' } }))
  vi.stubGlobal('getRouterParam', () => request.id)
  vi.stubGlobal('readBody', async () => ({ objectiveId: request.objectiveId }))
  vi.mocked(groqStudyText).mockReset()
})
afterEach(async () => {
  if (request.id) await deleteStudyConversation(request.owner, request.id)
  request.id = ''
  vi.unstubAllGlobals()
})

async function fixture() {
  request.owner = 'journey-' + randomUUID()
  const study = await createStudyConversation(request.owner, 'design.txt', 'text/plain', Buffer.from('fixture'), {
    kind: 'WEB', sections: [{ id: 'design', label: 'Design · lines 1–8', text: 'This is the canonical reference for the system design. Misu plans, Amina guides spoken practice and Kai reviews saved evidence.' }],
    excerpt: 'System design', provenance: { fixture: true, url: 'https://example.com/design-fixture', provider: 'Local fixture', retrievedAt: new Date().toISOString(), hash: 'fixture', omissions: [] },
  })
  request.id = study.id
  const source = (await getStudyChunks(request.owner, request.id))[0]!
  await saveStudyPlan(request.owner, request.id, {
    status: 'APPROVED', version: 1, approvedBy: request.owner, approvedAt: new Date().toISOString(),
    activeObjectiveId: 'purpose', functionRefs: DEFAULT_STUDY_FUNCTION_REFS.map(ref => ({ ...ref })),
    pacing: { mode: 'TOPIC_BLOCKS', practiceMinutes: 5, breakMinutes: 3 },
    objectives: [
      { id: 'purpose', title: 'Document purpose', outcome: 'Explain the purpose of the canonical reference.', sources: [source] },
      { id: 'roles', title: 'Agent roles', outcome: 'Explain the distinct responsibilities of the three agents.', sources: [source] },
    ],
  }, study.revision)
  await changeStudyPacing(request.owner, request.id, 'START', '')
  await appendStudyTurn(request.owner, request.id, { id: randomUUID(), role: 'AMIRA', kind: 'WELCOME', mode: 'DISCUSSION', text: 'Welcome.', sources: [], createdAt: new Date().toISOString() })
  const intro = await prepareAminaTurn(request.owner, request.id, "I'm ready")
  await finishAminaTurn(request.owner, request.id, intro, 'This reference describes the system design. What is its purpose?')
  return source
}

function supportedReview() {
  vi.mocked(groqStudyText).mockImplementation(async (_policy, messages) => {
    const data = JSON.parse(messages[0]!.content)
    return JSON.stringify({ ready: true, reason: 'The explanation covers the approved outcome.',
      evidenceIds: [data.attempts[0].evidenceId], sourceIds: [data.passages[0].id] })
  })
}

it('moves through two saved objectives to Kai cards without waiting for the practice timer', async () => {
  await fixture()
  supportedReview()
  let prepared = await prepareAminaTurn(request.owner, request.id, 'It is the main authoritative reference for understanding the system design.')
  await finishAminaTurn(request.owner, request.id, prepared, 'You explained the purpose in your own words.')
  let study = await getStudyConversation(request.owner, request.id)
  let history = await getStudyPedagogyHistory(request.owner, request.id)
  expect(deriveAirsJourney(study, history)).toMatchObject({ checkpointReady: true, kaiReady: false })
  expect(study.plan.recommendation).toMatchObject({ reviewedObjectiveId: 'purpose', action: 'ADVANCE', objectiveId: 'roles' })
  expect((await getStudyPacing(request.owner, request.id))?.remainingMs).toBeGreaterThan(0)
  request.objectiveId = 'roles'
  const lease = await acquireStudyLiveLease(request.owner, request.id)
  await expect((confirm as any)({})).rejects.toMatchObject({ statusCode: 409 })
  expect((await getStudyConversation(request.owner, request.id)).plan.activeObjectiveId).toBe('purpose')
  await releaseStudyLiveLease(request.id, lease.leaseId)
  await (confirm as any)({})
  study = await getStudyConversation(request.owner, request.id)
  expect(deriveAirsJourney(study, history).completedObjectiveIds).toEqual(['purpose'])
  // The previous topic's timer cannot authorize a new topic's recording.
  await expect(assertStudyPacingOpen(study)).rejects.toMatchObject({ statusCode: 409 })
  const clock = await getStudyPacing(request.owner, request.id)
  const nextClock = await changeStudyPacing(request.owner, request.id, 'START', clock!.revision)
  expect(nextClock).toMatchObject({ objectiveId: 'roles', remainingMs: 300000 })
  prepared = await prepareAminaTurn(request.owner, request.id, "I'm ready")
  expect(prepared.packet.stage).toBe('INTRODUCTION')
  await finishAminaTurn(request.owner, request.id, prepared, 'Misu plans, Amina guides practice and Kai reviews evidence. How do their roles differ?')
  prepared = await prepareAminaTurn(request.owner, request.id, 'Misu chooses the goals, Amina guides my spoken explanations and Kai reviews the saved evidence.')
  await finishAminaTurn(request.owner, request.id, prepared, 'Your explanation distinguishes the three responsibilities.')
  request.objectiveId = 'roles'
  await (confirm as any)({})
  study = await getStudyConversation(request.owner, request.id)
  history = await getStudyPedagogyHistory(request.owner, request.id)
  expect(deriveAirsJourney(study, history)).toMatchObject({ kaiReady: true, completedObjectiveIds: ['purpose', 'roles'] })
  const review = await createKaiReview(request.owner, request.id)
  expect(review.evidence).toHaveLength(2)
  expect(review.observations[0]?.evidenceIds[0]).toBe(history.evidence[0]?.id)
  expect((await createKaiReview(request.owner, request.id)).id).toBe(review.id)
})

it('keeps the saved attempt and exposes retry when semantic review fails', async () => {
  await fixture()
  vi.mocked(groqStudyText).mockRejectedValue(new Error('Review unavailable'))
  const prepared = await prepareAminaTurn(request.owner, request.id, 'It is the canonical reference for system design.')
  await finishAminaTurn(request.owner, request.id, prepared, 'You described the reference.')
  const study = await getStudyConversation(request.owner, request.id)
  expect(study.practice.attempts).toHaveLength(1)
  expect(study.plan).toMatchObject({ activeObjectiveId: 'purpose', recommendationError: expect.any(String) })
  expect(study.plan.recommendation).toBeUndefined()
  expect(deriveAirsJourney(study, await getStudyPedagogyHistory(request.owner, request.id)).kaiReady).toBe(false)
  await expect(createKaiReview(request.owner, request.id)).rejects.toMatchObject({ statusCode: 409 })
})

it('never reviews an attempt whose execution failed to save', async () => {
  await fixture()
  const prepared = await prepareAminaTurn(request.owner, request.id, 'It is the canonical reference for system design.')
  const current = await getStudyConversation(request.owner, request.id)
  await saveStudyPlan(request.owner, request.id, current.plan, current.revision)
  await expect(finishAminaTurn(request.owner, request.id, prepared, 'You described its purpose.')).rejects.toMatchObject({ statusCode: 409 })
  expect(groqStudyText).not.toHaveBeenCalled()
  expect((await getStudyConversation(request.owner, request.id)).practice.attempts).toHaveLength(0)
})
