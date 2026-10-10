import { randomUUID } from 'node:crypto'
import { createError, type H3Event } from 'h3'
import { readAirsArtifact, writeAirsArtifact } from './airsContext'
import { studyStorageResources } from './studyRepository'

export const BEDROCK_TEST_BUDGET_MICROS = 15_000_000
export const BEDROCK_STANDALONE_TEST_BUDGET_MICROS = 5_000_000
const owner = 'study-bedrock-testing'
const key = 'MODEL_BUDGET#nova-2-lite-v1'
interface Budget { revision: string; reservedMicros: number; requests: number; updatedAt: string }

/** Conservative reservations, not AWS billing: $1/M input bytes and $10/M output tokens.
 * A byte bound plus framing allowance overestimates Nova text tokens. Never refund an
 * ambiguous dispatch. Separate production tables receive $15 Flowst / $5 standalone.
 */
export function bedrockReservationMicros(requestBytes: number, outputTokens: number) {
  if (!Number.isSafeInteger(requestBytes) || requestBytes < 1 || requestBytes > 96_000 ||
      !Number.isSafeInteger(outputTokens) || outputTokens < 1 || outputTokens > 4_000)
    throw createError({ statusCode: 413, statusMessage: 'This model request is too large. Your saved material remains available.', data: { code: 'AGENT_REQUEST_TOO_LARGE', retryable: false } })
  return requestBytes + 4096 + outputTokens * 10
}

export async function reserveBedrockTestingBudget(requestBytes: number, outputTokens: number, event?: H3Event) {
  const amount = bedrockReservationMicros(requestBytes, outputTokens)
  const standalone = ['air', 'amira'].includes(String(useRuntimeConfig(event).public?.appSurface))
  const limit = standalone ? BEDROCK_STANDALONE_TEST_BUDGET_MICROS : BEDROCK_TEST_BUDGET_MICROS
  if (studyStorageResources(event).mock) throw createError({ statusCode: 503, statusMessage: 'Bedrock testing requires persistent budget storage before paid requests can run.', data: { code: 'MODEL_BUDGET_STORAGE_REQUIRED' } })
  for (let attempt = 0; attempt < 6; attempt++) {
    const old = await readAirsArtifact<Budget>(owner, key, event)
    if (old && (!Number.isSafeInteger(old.reservedMicros) || old.reservedMicros < 0 || !old.revision)) throw createError({ statusCode: 503, statusMessage: 'The model testing allowance needs an owner check.' })
    if ((old?.reservedMicros || 0) + amount > limit)
      throw createError({ statusCode: 429, statusMessage: `This app's $${limit / 1_000_000} Bedrock testing allowance has been reserved. Your work is saved; contact the app owner before further model testing.`, data: { code: 'MODEL_TEST_BUDGET_EXHAUSTED', retryable: false } })
    const next: Budget = { revision: randomUUID(), reservedMicros: (old?.reservedMicros || 0) + amount, requests: (old?.requests || 0) + 1, updatedAt: new Date().toISOString() }
    try { await writeAirsArtifact(owner, key, next, event, old?.revision || ''); return }
    catch (error) { if ((error as { statusCode?: number }).statusCode !== 409) throw error }
  }
  throw createError({ statusCode: 409, statusMessage: 'The model testing allowance is busy. Please retry this step.' })
}
