import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createError } from 'h3'

interface StudyVoiceToken { ownerId: string, conversationId: string, planVersion: number, leaseId: string, expiresAt: number }
interface ElevenLabsStudyAgent { platform_settings?: { privacy?: { record_voice?: boolean, retention_days?: number }, auth?: { enable_auth?: boolean } } }

export function assertStudyVoiceAgentReady(agent: ElevenLabsStudyAgent) {
  if (agent.platform_settings?.privacy?.record_voice !== false || agent.platform_settings.privacy.retention_days !== 0 || agent.platform_settings?.auth?.enable_auth !== true) {
    throw createError({ statusCode: 503, statusMessage: 'Set the ElevenLabs agent to private, disable audio saving, and set retention to 0 days before starting voice.' })
  }
}

function secret() {
  const value = String(useRuntimeConfig().elevenLabsStudyLlmSecret || '')
  if (value.length < 32) throw createError({ statusCode: 503, statusMessage: 'Amina voice signing is not configured.' })
  return value
}

export function signStudyVoiceToken(ownerId: string, conversationId: string, planVersion: number, leaseId: string) {
  const payload: StudyVoiceToken = { ownerId, conversationId, planVersion, leaseId, expiresAt: Date.now() + 90_000 }
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret()).digest(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

export function verifyStudyVoiceToken(token: string): StudyVoiceToken {
  try {
    const bytes = Buffer.from(token, 'base64url')
    if (bytes.length < 29) throw new Error('Short token')
    const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret()).digest(), bytes.subarray(0, 12))
    decipher.setAuthTag(bytes.subarray(12, 28))
    const payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()) as StudyVoiceToken
    if (!payload.ownerId || !payload.conversationId || !payload.leaseId || !Number.isInteger(payload.planVersion) || !Number.isFinite(payload.expiresAt) || payload.expiresAt < Date.now()) throw new Error('Expired token')
    return payload
  } catch { throw createError({ statusCode: 401, statusMessage: 'Invalid or expired Amina voice session.' }) }
}
