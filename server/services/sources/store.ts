import { randomUUID } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { GetCommand, PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import type { H3Event } from 'h3'
import type { SourceDraft } from '../../../shared/studyMaterial'
import { studyStorageResources } from '../studyRepository'
import { SourceError } from './network'

export interface DraftRecord { draft: SourceDraft; ownerId: string; cancelled?: boolean; nonce?: string; requestId?: string }
interface Counter { revision: number; times?: number[]; count?: number; cost?: number; activeUntil?: number; jobId?: string; expiresAt: number }
const drafts = new Map<string, DraftRecord>()
const counters = new Map<string, Counter>()
const clone = <T>(value: T): T => structuredClone(value)
const key = (id: string) => ({ pk: `STUDY_SOURCE#${id}`, sk: 'DRAFT' })
function packed(record: DraftRecord) {
  const payload = gzipSync(JSON.stringify(record))
  if (payload.length > 350_000) throw new SourceError(413, 'The prepared source is too large to save. Select less material.')
  return { ...key(record.draft.id), ownerId: record.ownerId, revision: record.draft.revision, expiresAt: record.draft.expiresAt, payload }
}
export async function rawDraft(id: string, event?: H3Event): Promise<DraftRecord | undefined> {
  if (!/^[\da-f-]{36}$/.test(id)) return undefined
  const { mock, db, table } = studyStorageResources(event)
  if (mock) return drafts.has(id) ? clone(drafts.get(id)!) : undefined
  const item = (await db.send(new GetCommand({ TableName: table, Key: key(id), ConsistentRead: true }))).Item
  if (!item) return undefined
  return JSON.parse(gunzipSync(Buffer.from(item.payload), { maxOutputLength: 4 * 1024 * 1024 }).toString('utf8'))
}
export async function ownedDraft(ownerId: string, id: string, event?: H3Event) {
  const record = await rawDraft(id, event)
  if (!record || record.ownerId !== ownerId || record.cancelled || record.draft.expiresAt * 1000 <= Date.now()) throw new SourceError(404, 'This source draft is unavailable or expired. Inspect the source again.')
  return record
}
export async function saveDraft(record: DraftRecord, expected?: number, event?: H3Event) {
  const next = clone(record)
  next.draft.revision = expected === undefined ? 0 : expected + 1
  const item = packed(next)
  const { mock, db, table } = studyStorageResources(event)
  if (mock) {
    const previous = drafts.get(record.draft.id)
    if (expected === undefined ? !!previous : previous?.draft.revision !== expected) throw new SourceError(409, 'This source changed. Refresh its status before trying again.')
    drafts.set(record.draft.id, next)
  } else {
    try {
      await db.send(new PutCommand({ TableName: table, Item: item, ConditionExpression: expected === undefined ? 'attribute_not_exists(pk)' : 'revision = :revision AND ownerId = :owner',
        ...(expected === undefined ? {} : { ExpressionAttributeValues: { ':revision': expected, ':owner': record.ownerId } }) }))
    } catch (cause) { if ((cause as Error).name === 'ConditionalCheckFailedException') throw new SourceError(409, 'This source changed. Refresh its status before trying again.'); throw cause }
  }
  return next
}
export function newDraft(ownerId: string, values: Pick<SourceDraft, 'kind' | 'status' | 'url' | 'title'>): DraftRecord {
  return { ownerId, draft: { ...values, id: randomUUID(), createdAt: new Date().toISOString(), expiresAt: Math.floor(Date.now() / 1000) + 1800, revision: 0, omissions: [] } }
}
async function counter(id: string, event?: H3Event): Promise<Counter | undefined> {
  const { mock, db, table } = studyStorageResources(event)
  if (mock) return counters.has(id) ? clone(counters.get(id)!) : undefined
  return (await db.send(new GetCommand({ TableName: table, Key: { pk: `STUDY_SOURCE_LIMIT#${id}`, sk: 'USAGE' }, ConsistentRead: true }))).Item as Counter | undefined
}
function counterPut(id: string, previous: Counter | undefined, next: Counter, table: string) {
  return { Put: { TableName: table, Item: { pk: `STUDY_SOURCE_LIMIT#${id}`, sk: 'USAGE', ...next },
    ConditionExpression: previous ? 'revision = :revision' : 'attribute_not_exists(pk)', ...(previous ? { ExpressionAttributeValues: { ':revision': previous.revision } } : {}) } }
}
export async function reserveInspection(ownerId: string, event?: H3Event) {
  const id = `INSPECT#${ownerId}`
  const { mock, db, table } = studyStorageResources(event)
  for (let attempt = 0; attempt < 4; attempt++) {
    const previous = await counter(id, event)
    const times = (previous?.times || []).filter(time => time > Date.now() - 600_000)
    if (times.length >= 5) throw new SourceError(429, 'You have inspected five sources in ten minutes. Please wait before trying another.')
    const next: Counter = { revision: (previous?.revision ?? -1) + 1, times: [...times, Date.now()], expiresAt: Math.floor(Date.now() / 1000) + 3600 }
    if (mock) { if (counters.get(id)?.revision !== previous?.revision) continue; counters.set(id, next); return }
    try { await db.send(new TransactWriteCommand({ TransactItems: [counterPut(id, previous, next, table)] })); return }
    catch (cause) { if ((cause as Error).name !== 'TransactionCanceledException') throw cause }
  }
  throw new SourceError(409, 'Another source request is being prepared. Try again shortly.')
}
/** One transaction reserves the owner limit, operator ceiling, active slot, and job.
 * Reservations are conservative: failures/ambiguous dispatches do not refund them. */
export async function reserveVideo(record: DraftRecord, maxUsd: number, usdPerMinute: number, event?: H3Event) {
  if (!(maxUsd > 0) || !Number.isFinite(maxUsd) || !(usdPerMinute > 0) || !Number.isFinite(usdPerMinute)) throw new SourceError(503, 'Video transcription is not configured with a spending allowance. Supply a transcript instead.')
  const duration = record.draft.video?.durationSeconds
  if (!duration || duration <= 0 || duration > 1800) throw new SourceError(422, 'A public video duration of at most 30 minutes must be verified first.')
  const date = new Date().toISOString()
  const ownerKey = `VIDEO#${record.ownerId}#${date.slice(0, 10)}`
  const activeKey = `ACTIVE#${record.ownerId}`
  const globalKey = `OPERATOR#${date.slice(0, 7)}`
  const cost = Math.ceil(Math.ceil(duration / 60) * usdPerMinute * 1_000_000)
  const ceiling = Math.floor(maxUsd * 1_000_000)
  const { mock, db, table } = studyStorageResources(event)
  for (let attempt = 0; attempt < 4; attempt++) {
    const [owner, active, operator] = await Promise.all([counter(ownerKey, event), counter(activeKey, event), counter(globalKey, event)])
    if ((owner?.count || 0) >= 2) throw new SourceError(429, 'Your two source-transcription submissions for today have been used. Supply a transcript or return tomorrow.')
    if ((active?.activeUntil || 0) > Date.now()) throw new SourceError(409, 'A video transcription is already in progress. Wait for it to finish or expire.')
    if ((operator?.cost || 0) + cost > ceiling) throw new SourceError(429, 'The video-transcription allowance is currently exhausted. Supply a transcript instead.')
    const ttl = Math.floor(Date.now() / 1000) + 40 * 86400
    const values: Array<[string, Counter | undefined, Counter]> = [
      [ownerKey, owner, { revision: (owner?.revision ?? -1) + 1, count: (owner?.count || 0) + 1, expiresAt: ttl }],
      [activeKey, active, { revision: (active?.revision ?? -1) + 1, activeUntil: record.draft.expiresAt * 1000, jobId: record.draft.id, expiresAt: ttl }],
      [globalKey, operator, { revision: (operator?.revision ?? -1) + 1, cost: (operator?.cost || 0) + cost, expiresAt: ttl }],
    ]
    const next = clone(record); next.draft.status = 'PROCESSING'; next.draft.revision++; next.nonce = randomUUID()
    if (mock) {
      if (drafts.get(record.draft.id)?.draft.revision !== record.draft.revision) throw new SourceError(409, 'This video has already been prepared. Refresh its status.')
      if (values.some(([id, old]) => counters.get(id)?.revision !== old?.revision)) continue
      values.forEach(([id, , value]) => counters.set(id, value)); drafts.set(next.draft.id, next); return next
    }
    try {
      await db.send(new TransactWriteCommand({ TransactItems: [...values.map(([id, old, value]) => counterPut(id, old, value, table)),
        ...(['airs', 'air', 'amira'].includes(useRuntimeConfig(event).public?.appSurface) ? [{ ConditionCheck: { TableName: table, Key: { pk: `STUDY_UPLOAD#${record.ownerId}`, sk: 'ACTIVE' }, ConditionExpression: 'attribute_not_exists(pk) OR completed = :yes OR attribute_exists(abandonedAt)', ExpressionAttributeValues: { ':yes': true } } }] : []),
        { Put: { TableName: table, Item: packed(next), ConditionExpression: 'revision = :revision', ExpressionAttributeValues: { ':revision': record.draft.revision } } },
      ] })); return next
    } catch (cause) { if ((cause as Error).name !== 'TransactionCanceledException') throw cause }
  }
  throw new SourceError(409, 'Another source request changed the allowance. Refresh before trying again.')
}
export async function releaseVideoSlot(record: DraftRecord, event?: H3Event) {
  const id = `ACTIVE#${record.ownerId}`
  const previous = await counter(id, event)
  if (!previous || previous.jobId !== record.draft.id) return
  const next = { ...previous, revision: previous.revision + 1, activeUntil: 0 }
  const { mock, db, table } = studyStorageResources(event)
  if (mock) { if (counters.get(id)?.revision === previous.revision) counters.set(id, next); return }
  try { await db.send(new TransactWriteCommand({ TransactItems: [counterPut(id, previous, next, table)] })) }
  catch (cause) { if ((cause as Error).name !== 'TransactionCanceledException') throw cause }
}
