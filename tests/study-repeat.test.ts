import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('../server/services/studyRepository', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/services/studyRepository')>()
  return { ...actual, createStudyConversation: vi.fn(actual.createStudyConversation), studyStorageResources: vi.fn(actual.studyStorageResources) }
})

import {
  createStudyConversation, deleteStudyConversation, getStudyChunks, getStudyConversation,
  getStudyPedagogyHistory, getStudyUploadEligibility, saveStudyPlan, studyStorageResources,
  resumePreparingStudySource,
} from '../server/services/studyRepository'
import { prepareObjectiveOperation, finishObjectiveOperation, ensureObjectiveFlow } from '../server/services/studyObjectiveFlow'
import { createKaiReview, kaiReviewCacheKey } from '../server/services/airsKai'
import { repeatStudySession } from '../server/services/studyRepeat'
import { readAirsArtifact } from '../server/services/airsContext'
import { defaultObjectivePolicy } from '../shared/studyObjectivePolicy'
import { DEFAULT_STUDY_FUNCTION_REFS } from '../server/domain/neuromap/studyFunctions'
import type { StudyTurn } from '../shared/study'

const storageDefault = vi.mocked(studyStorageResources).getMockImplementation()!
let owner = '', ids: string[] = []
const config = { flowstAuthMode: 'mock', studySourceFixtureMode: true, studyObjectiveFlowEnabled: true, dynamoTable: 'fixture-table', curriculumBucket: 'fixture-bucket', public: { appSurface: 'air' } }
beforeEach(() => {
  owner = 'repeat-fixture-' + randomUUID()
  ids = []
  config.public.appSurface = 'air'
  config.flowstAuthMode = 'mock'
  vi.stubGlobal('useRuntimeConfig', () => config)
  vi.stubGlobal('createError', createError)
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Unexpected external request in repeat-session fixture') }))
  vi.mocked(createStudyConversation).mockClear()
  vi.mocked(studyStorageResources).mockReset().mockImplementation(storageDefault)
})
afterEach(async () => {
  config.flowstAuthMode = 'mock'
  for (const id of ids) await deleteStudyConversation(owner, id)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function fixture(covered = true, close = true, sourceText = 'The canonical document is the authoritative reference for this system design.') {
  const study = await createStudyConversation(owner, 'design.txt', 'text/plain', Buffer.from('original source bytes'), {
    kind: 'WEB', sections: [{ id: 'source', label: 'Reference', text: sourceText, location: { url: 'https://example.com/design', startLine: 1, endLine: 8 } }],
    excerpt: 'The system design reference', provenance: { fixture: true, url: 'https://example.com/design', provider: 'Local fixture', retrievedAt: new Date().toISOString(), hash: 'source-hash', omissions: [] },
  }, undefined, { purpose: 'INTERVIEW', scope: 'FOCUSED', timeBudgetMinutes: 10, context: 'Explain my project.' })
  ids.push(study.id)
  const source = (await getStudyChunks(owner, study.id))[0]!
  const objective = { id: 'purpose', title: 'Purpose', outcome: 'Explain the purpose of this reference.', sources: [source] }
  await saveStudyPlan(owner, study.id, {
    status: 'APPROVED', version: 1, approvedBy: owner, approvedAt: new Date().toISOString(), activeObjectiveId: objective.id,
    objectives: [{ ...objective, policy: defaultObjectivePolicy(objective) }],
    functionRefs: DEFAULT_STUDY_FUNCTION_REFS.map(ref => ({ ...ref })),
  }, study.revision)
  await ensureObjectiveFlow(await getStudyConversation(owner, study.id))
  if (close) {
    const text = covered ? 'It is the authoritative reference for understanding the design.' : 'End the session'
    const input: StudyTurn = { id: randomUUID(), role: 'USER', text, kind: covered ? 'PRACTICE' : 'CONTROL', mode: 'DISCUSSION', sources: [], createdAt: new Date().toISOString() }
    const operation = await prepareObjectiveOperation(owner, study.id, text, input, undefined, randomUUID())
    await finishObjectiveOperation(owner, study.id, operation, JSON.stringify({ acknowledgement: 'You described the reference’s purpose.', explanation: '', sourceIds: [] }))
  }
  const review = close ? await createKaiReview(owner, study.id) : null
  return { id: study.id, review, study: await getStudyConversation(owner, study.id), history: await getStudyPedagogyHistory(owner, study.id), chunks: structuredClone(await getStudyChunks(owner, study.id)) }
}

it.each([true, false])('creates a separate pending session after a covered=%s review, preserving the original and approval boundary', async covered => {
  const before = await fixture(covered)
  const request = { requestId: randomUUID(), reviewId: before.review!.id }
  const fresh = await repeatStudySession(owner, before.id, request)
  ids.push(fresh.id)
  expect(fresh.id).not.toBe(before.id)
  expect(fresh.document.id).not.toBe(before.study.document.id)
  expect(fresh.document.provenance).toEqual(before.study.document.provenance)
  expect(fresh.document.sectionCount).toBe(before.study.document.sectionCount)
  expect(fresh.preferences).toEqual(before.study.preferences)
  expect(fresh.plan).toMatchObject({ status: 'PENDING', version: 0, objectives: [] })
  expect(fresh.plan.approvedAt).toBeUndefined()
  expect(fresh.objectiveFlow).toBeUndefined()
  expect(fresh.turns).toEqual([])
  expect(fresh.practice.attempts).toEqual([])
  expect(await getStudyChunks(owner, fresh.id)).toEqual(before.chunks)
  expect(await getStudyPedagogyHistory(owner, fresh.id)).toEqual({ traces: [], evidence: [] })
  expect(await getStudyConversation(owner, before.id)).toEqual(before.study)
  expect(await getStudyPedagogyHistory(owner, before.id)).toEqual(before.history)
  expect(await getStudyUploadEligibility(owner)).toMatchObject({ canUpload: false, activeConversationId: fresh.id })

  // Simulate a lost first response: replay uses the durable predetermined session, even though its gate is now active.
  const replay = await repeatStudySession(owner, before.id, request)
  expect(replay.id).toBe(fresh.id)
  expect(createStudyConversation).toHaveBeenCalledTimes(2)
  await deleteStudyConversation(owner, before.id)
  ids = ids.filter(id => id !== before.id)
  expect(await getStudyChunks(owner, fresh.id)).toEqual(before.chunks)
  expect((await getStudyConversation(owner, fresh.id)).document.provenance).toEqual(before.study.document.provenance)
})

it('copies original object bytes independently and serializes concurrent repeats of one request', async () => {
  const before = await fixture()
  const request = { requestId: randomUUID(), reviewId: before.review!.id }
  let release!: () => void, started!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const copying = new Promise<void>(resolve => { started = resolve })
  const bytes = Buffer.from('The original owned file, copied exactly')
  const send = vi.fn(async (command: { input: { Key?: string } }) => {
    expect(command.input.Key).toBe(`study/${owner}/${before.id}/original.web`)
    started()
    await gate
    return { ContentType: 'text/plain', Body: { transformToByteArray: async () => bytes } }
  })
  const storage = storageDefault()
  vi.mocked(studyStorageResources).mockReturnValue({ ...storage, mock: false, bucket: 'owned-fixture-bucket', s3: { send } as unknown as typeof storage.s3 })
  const first = repeatStudySession(owner, before.id, request)
  await copying
  await expect(repeatStudySession(owner, before.id, request)).rejects.toMatchObject({ statusCode: 409 })
  release()
  const fresh = await first
  ids.push(fresh.id)
  expect(vi.mocked(createStudyConversation).mock.calls.at(-1)?.[3]).toEqual(bytes)
  expect(vi.mocked(createStudyConversation).mock.calls.at(-1)?.[2]).toBe('text/plain')
  expect(vi.mocked(createStudyConversation).mock.calls.at(-1)?.[7]).toBe(fresh.id)
  expect((await repeatStudySession(owner, before.id, request)).id).toBe(fresh.id)
  expect(send).toHaveBeenCalledTimes(1)
  expect(await readAirsArtifact(owner, `LOCK#REPEAT#${before.id}#${request.requestId}`)).toBeUndefined()
  expect(await getStudyConversation(owner, before.id)).toEqual(before.study)
})

it('releases a failed copy for safe retry and never changes the completed session', async () => {
  const before = await fixture()
  const request = { requestId: randomUUID(), reviewId: before.review!.id }
  const storage = storageDefault()
  vi.mocked(studyStorageResources).mockReturnValue({ ...storage, mock: false, s3: { send: vi.fn(async () => { throw new Error('Fixture source copy failure') }) } as unknown as typeof storage.s3 })
  await expect(repeatStudySession(owner, before.id, request)).rejects.toThrow('Fixture source copy failure')
  expect(await readAirsArtifact(owner, `LOCK#REPEAT#${before.id}#${request.requestId}`)).toBeUndefined()
  expect(await getStudyConversation(owner, before.id)).toEqual(before.study)
  vi.mocked(studyStorageResources).mockImplementation(storageDefault)
  const fresh = await repeatStudySession(owner, before.id, request)
  ids.push(fresh.id)
  expect(fresh.plan.status).toBe('PENDING')
  expect(await getStudyPedagogyHistory(owner, before.id)).toEqual(before.history)
})

it('rejects other owners, active sessions, malformed requests and a mismatched review', async () => {
  const active = await fixture(true, false)
  const input = { requestId: randomUUID(), reviewId: randomUUID() }
  await expect(repeatStudySession(owner, active.id, {})).rejects.toMatchObject({ statusCode: 400 })
  await expect(repeatStudySession('another-owner', active.id, input)).rejects.toMatchObject({ statusCode: 404 })
  await expect(repeatStudySession(owner, active.id, input)).rejects.toMatchObject({ statusCode: 409 })
  config.public.appSurface = 'flowst'
  const completed = await fixture()
  await expect(repeatStudySession(owner, completed.id, input)).rejects.toMatchObject({ statusCode: 409 })
  expect(createStudyConversation).toHaveBeenCalledTimes(2)
})

it.each(['partial-write', 'delayed-failure', 'delayed-success', 'META-collision'] as const)('preserves the owned repeat copy across %s and leaves later learner changes intact', async scenario => {
  const before = await fixture(false, true, 'The canonical reference records the system design. '.repeat(70))
  const request = { requestId: randomUUID(), reviewId: before.review!.id }
  const rows = new Map<string, Record<string, any>>()
  const rowKey = (pk: string, sk: string) => JSON.stringify([pk, sk])
  const store = (item: Record<string, any>) => rows.set(rowKey(item.pk, item.sk), structuredClone(item))
  const originalPk = 'STUDY#' + before.id
  store({ ...before.study, pk: originalPk, sk: 'META', gsi2pk: 'USER#' + owner, gsi2sk: 'STUDY#fixture', objectKey: `study/${owner}/${before.id}/original.web`, entityType: 'StudyConversation' })
  for (const turn of before.study.turns) store({ pk: originalPk, sk: 'TURN#' + turn.createdAt + '#' + turn.id, turn })
  for (const chunk of before.chunks) store({ pk: originalPk, sk: 'CHUNK#' + String(chunk.position).padStart(4, '0'), ...chunk })
  store({ pk: 'AIRS_CONTEXT#' + owner, sk: kaiReviewCacheKey(before.id, before.study.plan.version, before.review!.basedOnTurnId, '0.3'), value: before.review })
  const originalRows = structuredClone([...rows.entries()])
  const originalBytes = Buffer.from('Independent owned original file')
  const objects = new Map([[`study/${owner}/${before.id}/original.web`, originalBytes]])
  let interrupt = true, createdId = '', metadataCreates = 0
  let releaseDelayed!: () => void, delayedStarted!: () => void
  const delayedGate = new Promise<void>(resolve => { releaseDelayed = resolve })
  const started = new Promise<void>(resolve => { delayedStarted = resolve })
  let objectWrites = 0
  type Command = { constructor: { name: string }; input: Record<string, any> }
  const dbSend = vi.fn(async (value: unknown) => {
    const command = value as Command, input = command.input
    if (command.constructor.name === 'GetCommand') return { Item: structuredClone(rows.get(rowKey(input.Key.pk, input.Key.sk))) }
    if (command.constructor.name === 'QueryCommand') {
      const values = input.ExpressionAttributeValues
      const prefix = values[':prefix'] || values[':chunk'] || values[':turn'] || values[':usage'] || ''
      let items = [...rows.values()].filter(item => item.pk === values[':pk'] && item.sk.startsWith(prefix)).sort((a, b) => a.sk.localeCompare(b.sk))
      if (input.Limit) items = items.slice(0, input.Limit)
      return { Items: structuredClone(items) }
    }
    if (command.constructor.name === 'PutCommand') {
      if (rows.has(rowKey(input.Item.pk, input.Item.sk)) && input.ConditionExpression === 'attribute_not_exists(pk)') throw Object.assign(new Error('Fixture condition'), { name: 'ConditionalCheckFailedException' })
      const old = rows.get(rowKey(input.Item.pk, input.Item.sk))
      if (input.ConditionExpression?.includes('expiresAt < :now') && old && old.expiresAt >= input.ExpressionAttributeValues[':now']) throw Object.assign(new Error('Fixture active lease'), { name: 'ConditionalCheckFailedException' })
      if (input.Item.sk === 'META' && input.Item.pk !== originalPk) {
        createdId = input.Item.id; metadataCreates++
        expect(input.Item.sourcePreparing).toBe(true)
      }
      store(input.Item)
      return {}
    }
    if (command.constructor.name === 'BatchWriteCommand') {
      const writes = input.RequestItems[config.dynamoTable]
      if (interrupt && writes[0].PutRequest.Item.pk === 'STUDY#' + createdId) {
        store(writes[0].PutRequest.Item)
        if (scenario === 'partial-write') throw new Error('Fixture interrupted after META and one chunk')
        if (scenario !== 'META-collision') {
          delayedStarted()
          await delayedGate
          if (scenario === 'delayed-failure') throw new Error('Fixture delayed creator failed after its lease expired')
        }
      }
      for (const write of writes) store(write.PutRequest.Item)
      return { UnprocessedItems: {} }
    }
    if (command.constructor.name === 'DeleteCommand') {
      // Simulate the same storage outage preventing best-effort cleanup.
      if (interrupt && input.Key.pk === 'STUDY#' + createdId) throw new Error('Fixture cleanup interrupted')
      rows.delete(rowKey(input.Key.pk, input.Key.sk))
      return {}
    }
    if (command.constructor.name === 'UpdateCommand') {
      const record = rows.get(rowKey(input.Key.pk, input.Key.sk))!
      expect(input.ConditionExpression).toContain('revision = :zero')
      expect(input.ConditionExpression).toContain('#plan.#status = :pending')
      if (!record.sourcePreparing || record.revision !== 0 || record.plan.status !== 'PENDING') throw Object.assign(new Error('Fixture changed session'), { name: 'ConditionalCheckFailedException' })
      delete record.sourcePreparing
      return {}
    }
    throw new Error('Unexpected fixture database command: ' + command.constructor.name)
  })
  const s3Send = vi.fn(async (value: unknown) => {
    const command = value as Command, input = command.input
    if (command.constructor.name === 'GetObjectCommand') {
      const bytes = objects.get(input.Key)!
      return { ContentType: 'text/plain', Body: { transformToByteArray: async () => bytes } }
    }
    if (command.constructor.name === 'PutObjectCommand') {
      objects.set(input.Key, Buffer.from(input.Body))
      objectWrites++
      if (scenario === 'META-collision' && objectWrites === 1) {
        createdId = input.Key.split('/')[2]
        delayedStarted()
        await delayedGate
      }
      return {}
    }
    if (command.constructor.name === 'DeleteObjectCommand') {
      if (interrupt) throw new Error('Fixture object cleanup interrupted')
      objects.delete(input.Key)
      return {}
    }
    throw new Error('Unexpected fixture object command: ' + command.constructor.name)
  })
  vi.spyOn(DynamoDBDocumentClient.prototype, 'send').mockImplementation(dbSend as never)
  vi.spyOn(S3Client.prototype, 'send').mockImplementation(s3Send as never)
  config.flowstAuthMode = 'aws'
  config.public.appSurface = 'flowst'

  let repaired
  if (scenario === 'partial-write') {
    await expect(repeatStudySession(owner, before.id, request)).rejects.toThrow('Fixture interrupted after META and one chunk')
    expect(createdId).not.toBe('')
    expect(rows.get(rowKey('STUDY#' + createdId, 'META'))?.sourcePreparing).toBe(true)
    expect([...rows.values()].filter(item => item.pk === 'STUDY#' + createdId && item.sk.startsWith('CHUNK#'))).toHaveLength(1)
    expect(before.chunks.length).toBeGreaterThan(1)
    interrupt = false
    repaired = await repeatStudySession(owner, before.id, request)
  } else {
    const first = repeatStudySession(owner, before.id, request)
    await started
    // The old worker still runs after its durable 120-second lease has expired.
    const lease = rows.get(rowKey('AIRS_CONTEXT#' + owner, `LOCK#REPEAT#${before.id}#${request.requestId}`))!
    lease.expiresAt = Math.floor(Date.now() / 1000) - 1
    interrupt = false
    repaired = await repeatStudySession(owner, before.id, request)
    const ready = rows.get(rowKey('STUDY#' + repaired.id, 'META'))!
    ready.revision = 1
    ready.plan = { ...before.study.plan }
    store({ pk: ready.pk, sk: 'TURN#later', turn: { ...before.study.turns[0], id: 'later', text: 'A later saved learner explanation.', kind: 'PRACTICE' } })
    const savedRows = structuredClone([...rows.entries()])
    releaseDelayed()
    const late = await first
    expect(late.id).toBe(repaired.id)
    expect(late.plan.status).toBe('APPROVED')
    expect(late.turns.at(-1)?.text).toBe('A later saved learner explanation.')
    expect([...rows.entries()]).toEqual(savedRows)
  }
  expect(repaired.id).toBe(createdId)
  expect(repaired.plan.status).toBe('PENDING')
  expect(metadataCreates).toBe(1)
  expect(rows.get(rowKey('STUDY#' + createdId, 'META'))?.sourcePreparing).toBeUndefined()
  expect(await getStudyChunks(owner, createdId)).toEqual(before.chunks)
  expect(objects.get(`study/${owner}/${createdId}/original.web`)).toEqual(originalBytes)
  expect(s3Send.mock.calls.filter(([value]) => (value as Command).constructor.name === 'DeleteObjectCommand')).toHaveLength(0)
  expect(dbSend.mock.calls.filter(([value]) => (value as Command).constructor.name === 'DeleteCommand' && (value as Command).input.Key.pk === 'STUDY#' + createdId)).toHaveLength(0)
  for (const [key, value] of originalRows) expect(rows.get(key)).toEqual(value)

  const ready = rows.get(rowKey('STUDY#' + createdId, 'META'))!
  ready.revision = 1
  ready.plan = { ...before.study.plan }
  store({ pk: ready.pk, sk: 'TURN#later', turn: { ...before.study.turns[0], id: 'later', text: 'A later saved learner explanation.', kind: 'PRACTICE' } })
  const savedRows = structuredClone([...rows.entries()]), savedObjects = [...objects.entries()].map(([key, bytes]) => [key, Buffer.from(bytes)])
  const replay = await repeatStudySession(owner, before.id, request)
  expect(replay.plan.status).toBe('APPROVED')
  expect(replay.turns.at(-1)?.text).toBe('A later saved learner explanation.')
  expect([...rows.entries()]).toEqual(savedRows)
  expect([...objects.entries()]).toEqual(savedObjects)

  // Even an inconsistent preparing marker never permits overwriting learner changes.
  ready.sourcePreparing = true
  const writes = s3Send.mock.calls.length
  await expect(resumePreparingStudySource(owner, createdId, originalBytes, 'text/plain', before.chunks)).rejects.toMatchObject({ statusCode: 409 })
  expect(s3Send).toHaveBeenCalledTimes(writes)
})
