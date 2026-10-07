import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('../server/services/studyInference', () => ({ groqStudyText: vi.fn() }))

import { groqStudyText } from '../server/services/studyInference'
import { createKaiReview, readSavedKaiReview, chooseNextPractice, kaiReviewCacheKey } from '../server/services/airsKai'
import { readAirsArtifact, writeAirsArtifact } from '../server/services/airsContext'
import {
  createStudyConversation, deleteStudyConversation, getStudyChunks,
  getStudyConversation, getStudyPedagogyHistory, saveStudyPlan,
} from '../server/services/studyRepository'
import {
  ensureObjectiveFlow, finishObjectiveOperation, prepareObjectiveOperation,
} from '../server/services/studyObjectiveFlow'
import { DEFAULT_STUDY_FUNCTION_REFS } from '../server/domain/neuromap/studyFunctions'
import { defaultObjectivePolicy } from '../shared/studyObjectivePolicy'
import { studySessionReviewReady } from '../shared/studyCompletion'
import type { kaiReviewV03Schema, KaiReview } from '../shared/airsOrchestration'
import { KAI_ASSESSMENT_VERSION, unassessedKaiSession } from '../shared/kaiAssessment'
import type { z } from 'zod'
import type { StudyTurn } from '../shared/study'

let owner = '', id = ''
const config = {
  flowstAuthMode: 'mock', studySourceFixtureMode: true, studyObjectiveFlowEnabled: true,
  groqApiKey: 'fixture-key', groqModel: 'fixture-model', public: { appSurface: 'flowst' },
}

beforeEach(() => {
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.mocked(groqStudyText).mockReset()
  vi.mocked(groqStudyText).mockImplementation(async (_system, messages) => {
    const data = JSON.parse(messages[0]!.content)
    return JSON.stringify({
      semanticAcceptance: 'met', demonstrated: data.target.requiredMeaning, unresolved: [],
      reason: 'The saved explanation describes the authoritative design reference.',
      sourceRefs: [data.passages[0].id], learnerQuotes: [data.answers.at(-1).text],
      transcriptionUncertainty: [], interactionState: 'correct',
    })
  })
})
afterEach(async () => {
  if (id) await deleteStudyConversation(owner, id)
  id = ''
  vi.unstubAllGlobals()
})

async function savedCompletedPractice() {
  owner = 'kai-recovery-' + randomUUID()
  const initial = await createStudyConversation(owner, 'design.txt', 'text/plain', Buffer.from('fixture'), {
    kind: 'WEB', sections: [{ id: 'design', label: 'Design · lines 1–8', text: 'This is the canonical reference for the system design.' }],
    excerpt: 'System design', provenance: { fixture: false, url: 'https://example.com/design', provider: 'Local test', retrievedAt: new Date().toISOString(), hash: 'fixture', omissions: [] },
  })
  id = initial.id
  const source = (await getStudyChunks(owner, id))[0]!
  const objective = { id: 'purpose', title: 'Document purpose', outcome: 'Explain the purpose of the canonical reference.', sources: [source] }
  await saveStudyPlan(owner, id, {
    status: 'APPROVED', version: 1, approvedBy: owner, approvedAt: new Date().toISOString(), activeObjectiveId: objective.id,
    objectives: [{ ...objective, policy: defaultObjectivePolicy(objective) }],
    evaluationCriteria: [{ id: 'ACCURACY', description: 'Explain the approved purpose accurately.' }],
    functionRefs: DEFAULT_STUDY_FUNCTION_REFS.map(ref => ({ ...ref })),
  }, initial.revision)
  await ensureObjectiveFlow(await getStudyConversation(owner, id))
  for (const [text, kind] of [["I'm ready", 'INTRO'], ['It is the authoritative reference for understanding the system design.', 'PRACTICE']] as const) {
    const input: StudyTurn = { id: randomUUID(), role: 'USER', text, kind, mode: 'DISCUSSION', sources: [], createdAt: new Date().toISOString() }
    const prepared = await prepareObjectiveOperation(owner, id, text, input, undefined, randomUUID())
    await finishObjectiveOperation(owner, id, prepared, JSON.stringify({ acknowledgement: 'You described the reference’s purpose.', explanation: '', sourceIds: [] }))
  }
  const study = await getStudyConversation(owner, id)
  const history = await getStudyPedagogyHistory(owner, id)
  expect(study.objectiveFlow?.sessionStatus).toBe('covered')
  expect(studySessionReviewReady(study, history)).toBe(true)
  expect(history.evidence).toHaveLength(1)
  const legacyKey = kaiReviewCacheKey(id,study.plan.version,history.evidence[0]!.learnerTurnId)
  const key = kaiReviewCacheKey(id,study.plan.version,history.evidence[0]!.learnerTurnId,KAI_ASSESSMENT_VERSION)
  return { study, history, key, legacyKey, evidenceId: history.evidence[0]!.id }
}

function validProposal(evidenceId: string): z.infer<typeof kaiReviewV03Schema> {
  const quote = {evidenceId,text:'It is the authoritative reference for understanding the system design.'}
  return {
    observations: [{ text: 'The saved explanation describes this reference’s purpose.', evidenceIds: [evidenceId], criterionId: 'ACCURACY', kind: 'observation',learnerQuotes:[quote] }],
    sessionAssessment:{...unassessedKaiSession('This activity did not establish this domain.'),domains:unassessedKaiSession('This activity did not establish this domain.').domains.map(domain=>domain.domain==='understanding' ? {...domain,status:'observed',summary:'The saved explanation identifies the reference’s purpose.',evidenceIds:[evidenceId],learnerQuotes:[quote]} : domain)},
    notAssessed: ['Durable mastery.'],
    nextPractice: { goal: 'Explain the idea to another audience', exercise: 'Use a source-backed example in a future session.', evidenceIds: [evidenceId] },
  }
}
function proposalResponse(proposal: z.infer<typeof kaiReviewV03Schema>) {
  return new Response(JSON.stringify({ choices: [{ message: {
    role: 'assistant', tool_calls: [{ id: 'review-proposal', type: 'function', function: { name: 'propose_evidence_review', arguments: JSON.stringify(proposal) } }],
  } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

it.each(['observation evidence', 'criterion', 'next-practice evidence'] as const)(
  'rejects unavailable %s with a recoverable 502, preserves practice and releases the review lock', async invalidReference => {
    const before = await savedCompletedPractice()
    const invalid = validProposal(before.evidenceId)
    if (invalidReference === 'observation evidence') invalid.observations[0]!.evidenceIds = ['unavailable-evidence']
    if (invalidReference === 'criterion') invalid.observations[0]!.criterionId = 'CLARITY'
    if (invalidReference === 'next-practice evidence') invalid.nextPractice.evidenceIds = ['unavailable-evidence']
    const fetchMock = vi.fn(async () => {
      expect(await readAirsArtifact(owner, 'LOCK#' + before.key)).toBeTypeOf('number')
      return proposalResponse(invalid)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(createKaiReview(owner, id)).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'Kai could not link this review to your saved evidence. Your practice is saved; retry the review.',
      data: { code: 'KAI_EVIDENCE_INVALID' },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await getStudyConversation(owner, id)).toEqual(before.study)
    expect(await getStudyPedagogyHistory(owner, id)).toEqual(before.history)
    expect(await readAirsArtifact(owner, before.key)).toBeUndefined()
    expect(await readAirsArtifact(owner, 'LATEST_REVIEW')).toBeUndefined()
    expect(await readAirsArtifact(owner, 'LOCK#' + before.key)).toBeUndefined()

    fetchMock.mockImplementation(async () => proposalResponse(validProposal(before.evidenceId)))
    const review = await createKaiReview(owner, id)
    expect(review.sessionStatus).toBe('covered')
    expect(review.objectiveOutcomes?.[0]?.status).toBe('met_for_session')
    expect(review.observations[0]?.evidenceIds).toEqual([before.evidenceId])
    expect((await createKaiReview(owner, id)).id).toBe(review.id)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(await getStudyConversation(owner, id)).toEqual(before.study)
    expect(await getStudyPedagogyHistory(owner, id)).toEqual(before.history)
    expect(await readAirsArtifact(owner, 'LOCK#' + before.key)).toBeUndefined()
  },
)

it('supplies the exact allowed evidence and criterion IDs to the model', async () => {
  const before = await savedCompletedPractice()
  const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(String(init.body))
    const context = JSON.parse(request.messages.find((message: { role: string; tool_call_id?: string }) => message.role === 'tool' && message.tool_call_id === 'bootstrap-get_approved_evaluation_context').content)
    const evidence = JSON.parse(request.messages.find((message: { role: string; tool_call_id?: string }) => message.role === 'tool' && message.tool_call_id === 'bootstrap-get_session_evidence').content)
    expect(context.approvedCriterionIds).toEqual(['ACCURACY'])
    expect(context.allowedEvidenceIds).toEqual([before.evidenceId])
    expect(evidence.map((item: { id: string }) => item.id)).toEqual(context.allowedEvidenceIds)
    expect(request.messages[0].content).toContain('not source, target, turn or trace IDs')
    expect(request.messages[0].content).toContain('Every criterionId must be one of approvedCriterionIds')
    expect(request.messages[0].content).toContain('ordinary vocabulary count')
    expect(request.messages[0].content).toContain('within 2000 output tokens')
    expect(request.messages[0].content).toContain('Even zero recorded app hints do not prove')
    expect(evidence[0].reasoningEligible).toBe(false)
    return proposalResponse(validProposal(before.evidenceId))
  })
  vi.stubGlobal('fetch', fetchMock)
  await createKaiReview(owner, id)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

function legacyReview(before: Awaited<ReturnType<typeof savedCompletedPractice>>): KaiReview {
  const {sessionAssessment, ...proposal}=validProposal(before.evidenceId)
  return {...proposal,observations:proposal.observations.map(({learnerQuotes,...observation})=>observation),id:randomUUID(),conversationId:id,planVersion:before.study.plan.version,basedOnTurnId:before.history.evidence[0]!.learnerTurnId,createdAt:new Date().toISOString(),nextPracticeStatus:'PROPOSED',evidence:[{id:before.evidenceId,attempt:before.study.turns.find(turn=>turn.id===before.history.evidence[0]!.learnerTurnId)!.text}]}
}

it('loads and reuses a legacy review without automatically requesting richer feedback',async()=>{
  const before=await savedCompletedPractice(), legacy=legacyReview(before)
  await writeAirsArtifact(owner,before.legacyKey,legacy)
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
  expect(await readSavedKaiReview(owner,id)).toEqual(legacy)
  expect(await createKaiReview(owner,id)).toEqual(legacy)
  expect(fetcher).not.toHaveBeenCalled()
  expect(await readAirsArtifact(owner,before.key)).toBeUndefined()
})

it('upgrades a legacy review only on explicit refresh, keeps its history and reuses the richer cache',async()=>{
  const before=await savedCompletedPractice(), legacy=legacyReview(before)
  await writeAirsArtifact(owner,before.legacyKey,legacy)
  const fetcher=vi.fn(async()=>proposalResponse(validProposal(before.evidenceId)));vi.stubGlobal('fetch',fetcher)
  await expect(createKaiReview(owner,id,undefined,{refresh:true,reviewId:randomUUID()})).rejects.toMatchObject({statusCode:409})
  expect(fetcher).not.toHaveBeenCalled()
  const rich=await createKaiReview(owner,id,undefined,{refresh:true,reviewId:legacy.id})
  expect(rich.assessmentVersion).toBe('0.3')
  expect(rich.sessionAssessment?.domains).toHaveLength(4)
  expect(await readAirsArtifact(owner,before.legacyKey)).toEqual(legacy)
  expect(await readSavedKaiReview(owner,id)).toEqual(rich)
  expect((await createKaiReview(owner,id,undefined,{refresh:true,reviewId:legacy.id})).id).toBe(rich.id)
  expect(fetcher).toHaveBeenCalledTimes(1)
  const accepted=await chooseNextPractice(owner,id,rich.id,'ACCEPTED')
  expect(accepted.nextPracticeStatus).toBe('ACCEPTED')
  expect((await readAirsArtifact<KaiReview>(owner,before.key))?.nextPracticeStatus).toBe('ACCEPTED')
  expect(await readAirsArtifact(owner,before.legacyKey)).toEqual(legacy)
  expect(await getStudyConversation(owner,id)).toEqual(before.study)
})

it.each(['invented quote','unelicited reasoning','audio judgement'] as const)('rejects %s without saving a rich review or changing practice',async problem=>{
  const before=await savedCompletedPractice(), proposal=validProposal(before.evidenceId)
  const understanding=proposal.sessionAssessment.domains.find(domain=>domain.domain==='understanding')!
  if(problem==='invented quote') understanding.learnerQuotes[0]!.text='This text is absent from the saved answer.'
  if(problem==='unelicited reasoning') {
    const reasoning=proposal.sessionAssessment.domains.find(domain=>domain.domain==='reasoning')!
    Object.assign(reasoning,{status:'observed',summary:'The explanation gives a reason.',evidenceIds:[before.evidenceId],learnerQuotes:understanding.learnerQuotes})
  }
  if(problem==='audio judgement') proposal.observations[0]!.text='Your pronunciation was clear.'
  const fetcher=vi.fn(async()=>proposalResponse(proposal));vi.stubGlobal('fetch',fetcher)
  await expect(createKaiReview(owner,id)).rejects.toMatchObject({statusCode:502,data:{code:'KAI_EVIDENCE_INVALID'}})
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(await readAirsArtifact(owner,before.key)).toBeUndefined()
  expect(await readAirsArtifact(owner,'LOCK#'+before.key)).toBeUndefined()
  expect(await getStudyConversation(owner,id)).toEqual(before.study)
})

it('preserves provider errors and still releases the lock without saving a review', async () => {
  const before = await savedCompletedPractice()
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'rate_limit_exceeded', message: 'Fixture rate limit' } }), { status: 429, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await expect(createKaiReview(owner, id)).rejects.toMatchObject({ statusCode: 429 })
  } finally {
    vi.mocked(console.error).mockRestore()
  }
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(await readAirsArtifact(owner, 'LOCK#' + before.key)).toBeUndefined()
  expect(await readAirsArtifact(owner, before.key)).toBeUndefined()
  expect(await getStudyConversation(owner, id)).toEqual(before.study)
  expect(await getStudyPedagogyHistory(owner, id)).toEqual(before.history)
})
