import { createHash } from 'node:crypto'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { createError, type H3Event } from 'h3'
import { z } from 'zod'
import {
  createStudyConversation, getStudyChunks, getStudyConversation,
  getStudyPedagogyHistory, studyLiveLease, studyStorageResources,
  resumePreparingStudySource,
} from './studyRepository'
import { claimAirsReview } from './airsContext'
import { readSavedKaiReview } from './airsKai'
import { studySessionReviewReady } from '../../shared/studyCompletion'
import type { StudyExtraction } from './studyExtraction'

const repeatRequest = z.object({ requestId: z.string().uuid(), reviewId: z.string().uuid() }).strict()

/** The request identifies a new session before writes, so a lost response cannot create another one. */
function repeatedSessionId(ownerId: string, id: string, requestId: string) {
  const hex = createHash('sha256').update(JSON.stringify(['study-repeat', ownerId, id, requestId])).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export async function repeatStudySession(ownerId: string, id: string, input: unknown, event?: H3Event) {
  const parsed = repeatRequest.safeParse(input)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Confirm the saved review before practising again.' })
  const study = await getStudyConversation(ownerId, id, event)
  const nextId = repeatedSessionId(ownerId, id, parsed.data.requestId)
  const existing = async () => {
    try { return await getStudyConversation(ownerId, nextId, event) }
    catch (cause) {
      const error = cause as { statusCode?: number; data?: { code?: string } }
      if (error.statusCode !== 404 && !(error.statusCode === 503 && error.data?.code === 'STUDY_SOURCE_PREPARING')) throw cause
    }
  }
  const saved = await existing()
  if (saved) return saved
  if (study.abandonedAt || await studyLiveLease(id, event)) throw createError({ statusCode: 409, statusMessage: 'Finish the current session before practising again.' })
  const history = await getStudyPedagogyHistory(ownerId, id, event)
  if (!studySessionReviewReady(study, history)) throw createError({ statusCode: 409, statusMessage: 'Finish or explicitly end this session before practising again.' })
  const review = await readSavedKaiReview(ownerId, id, event)
  if (!review || review.id !== parsed.data.reviewId) throw createError({ statusCode: 409, statusMessage: 'Open the current saved Kai review before practising again.' })

  let release: () => Promise<void>
  try { release = await claimAirsReview(ownerId, `REPEAT#${id}#${parsed.data.requestId}`, event) }
  catch (cause) {
    if ((cause as { statusCode?: number }).statusCode === 409) throw createError({ statusCode: 409, statusMessage: 'Your fresh session is being prepared. Retry shortly using the same action.' })
    throw cause
  }
  try {
    const replay = await existing()
    if (replay) return replay
    const chunks = [...await getStudyChunks(ownerId, id, event)].sort((a, b) => a.position - b.position)
    if (!chunks.length) throw createError({ statusCode: 422, statusMessage: 'The saved source has no readable passages. Choose a new source.' })
    const extraction: StudyExtraction = {
      kind: study.document.kind,
      sections: chunks.map(chunk => ({ id: chunk.id, label: chunk.label, text: chunk.text, ...(chunk.location ? { location: chunk.location } : {}) })),
      excerpt: study.document.excerpt,
      ...(study.document.provenance ? { provenance: structuredClone(study.document.provenance) } : {}),
    }
    const storage = studyStorageResources(event)
    let bytes = Buffer.from(JSON.stringify(extraction)), contentType = 'application/json'
    if (!storage.mock) {
      const original = await storage.s3.send(new GetObjectCommand({
        Bucket: storage.bucket, Key: `study/${ownerId}/${id}/original.${study.document.kind.toLowerCase()}`,
      }), { abortSignal: AbortSignal.timeout(30_000) })
      if (!original.Body) throw createError({ statusCode: 503, statusMessage: 'The saved source could not be copied. Your previous session remains available.' })
      bytes = Buffer.from(await original.Body.transformToByteArray())
      contentType = original.ContentType || 'application/octet-stream'
    }
    const repaired = await resumePreparingStudySource(ownerId, nextId, bytes, contentType, chunks, event)
    if (repaired) return repaired
    return await createStudyConversation(ownerId, study.document.name, contentType, bytes, extraction, event, structuredClone(study.preferences), nextId, { chunks, sectionCount: study.document.sectionCount, retainForRepeatRecovery: true })
  } finally { await release() }
}
