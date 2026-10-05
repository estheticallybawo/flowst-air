import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class {} }))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send: sdk.send }) },
  ...Object.fromEntries(['BatchWriteCommand', 'DeleteCommand', 'GetCommand', 'PutCommand', 'QueryCommand', 'TransactWriteCommand', 'UpdateCommand'].map(name => [name, class { constructor(public input: any) {} }])),
}))
vi.mock('@aws-sdk/client-s3', () => ({ S3Client: class {}, DeleteObjectCommand: class {}, PutObjectCommand: class {} }))
vi.mock('../server/services/awsClientConfig', () => ({ awsClientConfig: () => ({ region: 'us-east-1' }) }))

import { reserveStudyVoiceUsage } from '../server/services/studyRepository'

const metadata = {
  pk: 'STUDY#document', sk: 'META', id: 'document', ownerId: 'owner',
  document: { name: 'source.txt' }, plan: { status: 'PENDING', version: 0, objectives: [] },
  mode: 'DISCUSSION', practice: { attempts: [] },
}

beforeEach(() => {
  sdk.send.mockReset()
  vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'cognito', dynamoTable: 'test-table', curriculumBucket: 'test-bucket', studyAwsVoiceTrialMaxSeconds: 300, studyAwsVoiceTrialMaxCharacters: 6000 }))
})
afterEach(() => vi.unstubAllGlobals())

function storage(legacy: { kind: string, units: number }[], allowance?: any) {
  let counter = allowance
  const transactions: any[] = []
  sdk.send.mockImplementation(async (command: any) => {
    const input = command.input
    if (input.TransactItems) {
      transactions.push(input)
      const change = input.TransactItems.find((item: any) => (item.Update?.Key || item.Put?.Item)?.sk === 'VOICE#ALLOWANCE')
      if (change.Put) {
        if (counter) throw Object.assign(new Error('Concurrent reservation'), { name: 'TransactionCanceledException' })
        counter = { ...change.Put.Item }
      } else {
        const update = change.Update
        const field = update.UpdateExpression.includes('transcribeSeconds') ? 'transcribeSeconds' : 'pollyCharacters'
        if (counter.ownerId !== update.ExpressionAttributeValues[':owner'] || counter[field] !== update.ExpressionAttributeValues[':previous'])
          throw Object.assign(new Error('Concurrent reservation'), { name: 'TransactionCanceledException' })
        counter = { ...counter, [field]: counter[field] + update.ExpressionAttributeValues[':units'] }
      }
      return {}
    }
    if (input.Key?.sk === 'META') return { Item: metadata }
    if (input.Key?.sk === 'VOICE#ALLOWANCE') return { Item: counter ? { ...counter } : undefined }
    if (input.Key?.sk === 'LIVE#VOICE') return {}
    if (input.ExpressionAttributeValues?.[':usage']) return { Items: legacy.map(usage => ({ usage })) }
    return { Items: [] }
  })
  return { transactions, counter: () => counter }
}

it('adopts previous usage without treating the old document totals as ceilings', async () => {
  const db = storage([{ kind: 'TRANSCRIBE', units: 299 }, { kind: 'POLLY', units: 5900 }])
  await reserveStudyVoiceUsage('owner', 'document', { kind: 'POLLY', units: 101 })
  expect(db.counter()).toMatchObject({ transcribeSeconds: 299, pollyCharacters: 6001 })
  expect(db.transactions).toHaveLength(1)
  const transaction = db.transactions[0]
  expect(transaction.ClientRequestToken).toEqual(expect.any(String))
  expect(transaction.TransactItems).toEqual(expect.arrayContaining([
    expect.objectContaining({ ConditionCheck: expect.objectContaining({ Key: { pk: 'STUDY#document', sk: 'META' }, ConditionExpression: expect.stringContaining('ownerId = :owner') }) }),
    expect.objectContaining({ ConditionCheck: expect.objectContaining({ Key: { pk: 'STUDY#document', sk: 'LIVE#VOICE' } }) }),
    expect.objectContaining({ Put: expect.objectContaining({ Item: expect.objectContaining({ usage: expect.objectContaining({ kind: 'POLLY', units: 101 }) }) }) }),
  ]))
  const reads = sdk.send.mock.calls.map(([command]) => command.input).filter(input => input.Key?.sk === 'VOICE#ALLOWANCE' || input.ExpressionAttributeValues?.[':usage'])
  expect(reads.length).toBeGreaterThan(1)
  expect(reads.every(input => input.ConsistentRead === true)).toBe(true)
})

it.each([
  { kind: 'POLLY' as const, field: 'pollyCharacters', prior: 5998 },
  { kind: 'TRANSCRIBE' as const, field: 'transcribeSeconds', prior: 298 },
])('accounts for both distinct concurrent $kind requests beyond former totals', async ({ kind, field, prior }) => {
  const db = storage([], { ownerId: 'owner', transcribeSeconds: 0, pollyCharacters: 0, [field]: prior })
  const attempts = await Promise.allSettled([
    reserveStudyVoiceUsage('owner', 'document', { kind, units: 2 }),
    reserveStudyVoiceUsage('owner', 'document', { kind, units: 2 }),
  ])
  expect(attempts.every(result => result.status === 'fulfilled')).toBe(true)
  expect(db.counter()[field]).toBe(prior + 4)
  expect(db.transactions).toHaveLength(3)
  const updates = db.transactions.map(transaction => transaction.TransactItems.find((item: any) => item.Update?.Key.sk === 'VOICE#ALLOWANCE').Update)
  expect(updates.every(update => update.ConditionExpression === `ownerId = :owner AND ${field} = :previous`)).toBe(true)
  expect(updates.every(update => !(':remaining' in update.ExpressionAttributeValues))).toBe(true)
})

it('keeps an uncertain committed reservation and never retries its transaction automatically', async () => {
  const db = storage([], { ownerId: 'owner', transcribeSeconds: 0, pollyCharacters: 0 })
  const execute = sdk.send.getMockImplementation()!
  sdk.send.mockImplementation(async (command: any) => {
    const result = await execute(command)
    if (command.input.TransactItems)
      throw Object.assign(new Error('The response was lost after commit'), { name: 'TimeoutError' })
    return result
  })
  await expect(reserveStudyVoiceUsage('owner', 'document', { kind: 'POLLY', units: 25 })).rejects.toMatchObject({ name: 'TimeoutError' })
  expect(db.counter().pollyCharacters).toBe(25)
  expect(db.transactions).toHaveLength(1)
})

it.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid usage units %s before recording or provider dispatch', async units => {
  const db = storage([])
  await expect(reserveStudyVoiceUsage('owner', 'document', { kind: 'POLLY', units })).rejects.toMatchObject({ statusCode: 400 })
  expect(db.transactions).toHaveLength(0)
})

it.each([
  { transcribeSeconds: NaN, pollyCharacters: 0 },
  { transcribeSeconds: 0, pollyCharacters: -1 },
  { transcribeSeconds: 0, pollyCharacters: 0.5 },
  { transcribeSeconds: 0, pollyCharacters: Number.MAX_SAFE_INTEGER },
])('rejects corrupt or numerically unsafe totals without changing the ledger', async totals => {
  const db = storage([], { ownerId: 'owner', ...totals })
  await expect(reserveStudyVoiceUsage('owner', 'document', { kind: 'POLLY', units: 1 })).rejects.toMatchObject({ statusCode: 503 })
  expect(db.transactions).toHaveLength(0)
  expect(db.counter()).toMatchObject(totals)
})

it('keeps cross-account usage inaccessible', async () => {
  const db = storage([])
  await expect(reserveStudyVoiceUsage('other-owner', 'document', { kind: 'POLLY', units: 1 })).rejects.toMatchObject({ statusCode: 404 })
  expect(db.transactions).toHaveLength(0)
})

it.each([NaN, -1, Infinity])('does not adopt invalid legacy totals %s into a new ledger', async units => {
  const db = storage([{ kind: 'TRANSCRIBE', units }])
  await expect(reserveStudyVoiceUsage('owner', 'document', { kind: 'POLLY', units: 1 })).rejects.toMatchObject({ statusCode: 503 })
  expect(db.transactions).toHaveLength(0)
  expect(db.counter()).toBeUndefined()
})
