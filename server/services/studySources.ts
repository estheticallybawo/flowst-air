import type { H3Event } from 'h3'
import { z } from 'zod'
import { assertStudyUploadAvailable, createStudyConversation, getStudyConversation } from './studyRepository'
import { validateStudyPreferences } from './studyPreferences'
import { GitHubStudyReader, githubRepository } from './sources/github'
import { publicUrl, SourceError } from './sources/network'
import { websiteSnapshot } from './sources/web'
import { inspectVideo, transcriptSnapshot, verifyTranscriptionSignature, videoReference } from './sources/video'
import { newDraft, ownedDraft, rawDraft, releaseVideoSlot, reserveInspection, reserveVideo, saveDraft } from './sources/store'
import { sourceFixture } from './sources/fixtures'

const inspectSchema = z.object({ url: z.string().max(2048), transcript: z.string().max(100_000).optional(), format: z.enum(['txt', 'srt', 'vtt']).optional(), fixture: z.enum(['GITHUB', 'WEB', 'VIDEO']).optional() }).strict()
export function sourceFixtureMode(event?: H3Event) {
  const config = useRuntimeConfig(event)
  return config.studySourceFixtureMode === true && config.flowstAuthMode === 'mock' && process.env.NODE_ENV !== 'production'
}
export async function inspectStudySource(ownerId: string, input: unknown, event?: H3Event) {
  const parsed = inspectSchema.safeParse(input)
  if (!parsed.success) throw new SourceError(400, 'Enter one source link and at most 100,000 transcript characters.')
  await assertStudyUploadAvailable(ownerId, event)
  await reserveInspection(ownerId, event)
  const { url: inputUrl, transcript, format, fixture } = parsed.data
  if (fixture) {
    if (!sourceFixtureMode(event)) throw new SourceError(404, 'Demonstration sources are not enabled.')
    const extraction = sourceFixture(fixture)
    const record = newDraft(ownerId, { kind: fixture, status: 'READY', title: `${fixture} demonstration: learning strategies`, url: extraction.provenance!.url })
    record.draft.extraction = extraction; record.draft.fixture = true; record.draft.omissions = extraction.provenance!.omissions
    return (await saveDraft(record, undefined, event)).draft
  }
  const url = publicUrl(inputUrl).href
  const video = videoReference(url)
  if (transcript !== undefined) {
    const metadata = video?.id ? { platform: video.platform, id: video.id } : undefined
    const extraction = transcriptSnapshot(video?.url || url, transcript, 'SUPPLIED', { format, video: metadata })
    const record = newDraft(ownerId, { kind: metadata ? 'VIDEO' : 'TRANSCRIPT', status: 'READY', title: 'Supplied transcript', url: video?.url || url })
    record.draft.video = metadata; record.draft.extraction = extraction; record.draft.omissions = extraction.provenance!.omissions
    return (await saveDraft(record, undefined, event)).draft
  }
  if (video) {
    const record = newDraft(ownerId, { kind: 'VIDEO', status: 'UNAVAILABLE', url: video.url, title: `${video.platform} video` })
    record.draft.video = { platform: video.platform, id: video.id }
    record.draft.omissions = ['Speech only. Visuals and on-screen text will not be inspected.']
    try {
      const inspected = await inspectVideo(url)
      record.draft.url = inspected.reference.url; record.draft.title = inspected.metadata.title
      record.draft.video = { platform: inspected.reference.platform, id: inspected.reference.id, durationSeconds: inspected.metadata.durationSeconds, creator: inspected.metadata.creator }
      const config = useRuntimeConfig(event)
      if (!inspected.available) record.draft.message = 'We could not verify an accessible, completed public video of at most 30 minutes. Supply a transcript instead.'
      else if (!config.studyVideoEnabled || !config.studyVideoApiKey || !config.studyVideoWebhookId || !config.studyVideoWebhookSecret || !(Number(config.studyVideoMonthlyBudgetUsd) > 0) || !(Number(config.studyVideoUsdPerMinute) > 0)) record.draft.message = 'Live source transcription is not configured here. You can supply a transcript instead.'
      else record.draft.status = 'VIDEO_READY'
    } catch { record.draft.message = 'The public video metadata could not be verified. Paste the full video link again or supply a transcript.' }
    return (await saveDraft(record, undefined, event)).draft
  }
  if (['github.com', 'www.github.com'].includes(new URL(url).hostname)) {
    const { owner, repo } = githubRepository(url)
    const reader = new GitHubStudyReader(undefined, String(useRuntimeConfig(event).studyGithubToken || ''))
    const metadata = await reader.repository(owner, repo)
    const commit = await reader.revision(owner, repo, metadata.defaultBranch)
    const files = await reader.files(owner, repo, commit)
    const record = newDraft(ownerId, { kind: 'GITHUB', status: 'SELECT', title: metadata.title, url: `https://github.com/${owner}/${repo}` })
    record.draft.repository = { owner, repo, commit, license: metadata.license, requests: reader.requests }
    record.draft.candidates = files.candidates; record.draft.omissions = files.omissions
    return (await saveDraft(record, undefined, event)).draft
  }
  const { title, extraction } = await websiteSnapshot(url)
  const record = newDraft(ownerId, { kind: 'WEB', status: 'READY', title, url: extraction.provenance!.url })
  record.draft.extraction = extraction; record.draft.omissions = extraction.provenance!.omissions
  return (await saveDraft(record, undefined, event)).draft
}

export async function prepareStudySource(ownerId: string, id: string, input: unknown, event?: H3Event) {
  const parsed = z.object({ paths: z.array(z.string().max(500)).max(12).optional(), confirmTranscription: z.literal(true).optional() }).strict().safeParse(input)
  if (!parsed.success) throw new SourceError(400, 'Choose eligible files or confirm transcript creation.')
  await assertStudyUploadAvailable(ownerId, event)
  let record = await ownedDraft(ownerId, id, event)
  if (['READY', 'PROCESSING', 'COMMITTING', 'COMMITTED'].includes(record.draft.status)) return record.draft
  if (record.draft.kind === 'GITHUB' && record.draft.status === 'SELECT') {
    const paths = parsed.data.paths || []
    const selected = paths.map(path => record.draft.candidates?.find(item => item.path === path))
    if (!paths.length || new Set(paths).size !== paths.length || selected.some(item => !item)) throw new SourceError(400, 'Choose between one and twelve files from this repository.')
    // Claim before network work: concurrent prepares cannot multiply the request budget.
    record.draft.status = 'PROCESSING'
    record = await saveDraft(record, record.draft.revision, event)
    try {
      const repository = record.draft.repository!
      const reader = new GitHubStudyReader(undefined, String(useRuntimeConfig(event).studyGithubToken || ''), repository.requests)
      await reader.repository(repository.owner, repository.repo)
      record.draft.extraction = await reader.snapshot(repository.owner, repository.repo, repository.commit, selected as NonNullable<typeof selected[number]>[], repository.license)
      record.draft.omissions.push(...record.draft.extraction.provenance!.omissions)
      record.draft.status = 'READY'; delete record.draft.candidates
    } catch (cause) {
      record.draft.status = 'FAILED'; record.draft.message = cause instanceof SourceError ? cause.statusMessage : 'The selected files could not be prepared. Inspect the repository again.'
    }
    return (await saveDraft(record, record.draft.revision, event)).draft
  }
  if (record.draft.kind !== 'VIDEO' || record.draft.status !== 'VIDEO_READY' || !parsed.data.confirmTranscription) throw new SourceError(400, 'This source cannot be prepared. Supply a transcript or inspect another source.')
  const config = useRuntimeConfig(event)
  if (!config.studyVideoEnabled || !config.studyVideoApiKey || !config.studyVideoWebhookId || !config.studyVideoWebhookSecret) throw new SourceError(503, 'Video transcription is unavailable. Supply a transcript instead.')
  record = await reserveVideo(record, Number(config.studyVideoMonthlyBudgetUsd), Number(config.studyVideoUsdPerMinute), event)
  const body = new FormData()
  body.set('model_id', 'scribe_v2'); body.set('source_url', record.draft.url); body.set('webhook', 'true')
  body.set('webhook_id', String(config.studyVideoWebhookId)); body.set('timestamps_granularity', 'word'); body.set('tag_audio_events', 'false')
  body.set('webhook_metadata', JSON.stringify({ sourceId: id, nonce: record.nonce }))
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': String(config.studyVideoApiKey) }, body, signal: AbortSignal.timeout(20_000) })
    if (!response.ok) {
      // No retry: even an error can follow provider acceptance. A callback can still settle it.
      record.draft.message = 'Transcript submission could not be confirmed. Waiting for a provider result; this request will not be sent again automatically.'
    } else {
      const result = await response.json() as { request_id?: string }
      if (typeof result.request_id === 'string' && result.request_id.length < 200) record.requestId = result.request_id
    }
  } catch { record.draft.message = 'The submission response was interrupted. Waiting for a provider result; this request will not be sent again automatically.' }
  try { return (await saveDraft(record, record.draft.revision, event)).draft }
  catch (cause) { if ((cause as { statusCode?: number }).statusCode === 409) return (await ownedDraft(ownerId, id, event)).draft; throw cause }
}

export async function acceptTranscription(raw: string, signature: string, event?: H3Event) {
  const config = useRuntimeConfig(event)
  if (!verifyTranscriptionSignature(raw, signature, String(config.studyVideoWebhookSecret || ''))) throw new SourceError(401, 'Invalid transcription callback.')
  let payload: any
  try { payload = JSON.parse(raw) } catch { throw new SourceError(400, 'Invalid callback payload.') }
  if (payload.type !== 'speech_to_text_transcription') return { received: true }
  const data = payload.data
  let metadata = data?.webhook_metadata
  if (typeof metadata === 'string') { try { metadata = JSON.parse(metadata) } catch { return { received: true } } }
  if (typeof metadata?.sourceId !== 'string' || typeof metadata?.nonce !== 'string') return { received: true }
  for (let attempt = 0; attempt < 3; attempt++) {
    const record = await rawDraft(metadata.sourceId, event)
    if (!record || record.nonce !== metadata.nonce || record.draft.expiresAt * 1000 <= Date.now()) return { received: true }
    if (record.requestId && record.requestId !== data.request_id) return { received: true }
    if (record.cancelled) { await releaseVideoSlot(record, event); return { received: true } }
    if (record.draft.status !== 'PROCESSING') {
      // A prior callback may have saved the result before slot release failed.
      // Retrying release is safe because it is bound to this server-owned job ID.
      await releaseVideoSlot(record, event)
      return { received: true }
    }
    if (typeof data.request_id !== 'string' || data.request_id.length > 200) throw new SourceError(400, 'Missing transcription request identity.')
    record.requestId = data.request_id
    try {
      if (typeof data.transcription?.text !== 'string') throw new SourceError(422, 'The provider could not produce a readable transcript. Supply a transcript instead.')
      record.draft.extraction = transcriptSnapshot(record.draft.url, data.transcription.text, 'GENERATED', { video: record.draft.video, words: data.transcription.words, language: typeof data.transcription.language_code === 'string' ? data.transcription.language_code.slice(0, 20) : undefined })
      record.draft.status = 'READY'; record.draft.omissions = record.draft.extraction.provenance!.omissions; delete record.draft.message
    } catch (cause) { record.draft.status = 'FAILED'; record.draft.message = cause instanceof SourceError ? cause.statusMessage : 'The transcript could not be validated. Supply a transcript instead.' }
    try { await saveDraft(record, record.draft.revision, event); await releaseVideoSlot(record, event); return { received: true } }
    catch (cause) { if ((cause as { statusCode?: number }).statusCode !== 409) throw cause }
  }
  throw new SourceError(503, 'The callback could not be saved yet.')
}

export async function cancelStudySource(ownerId: string, id: string, event?: H3Event) {
  const record = await ownedDraft(ownerId, id, event)
  if (['COMMITTING', 'COMMITTED'].includes(record.draft.status)) throw new SourceError(409, 'This source is already being saved as a study session.')
  record.cancelled = true; delete record.draft.extraction; delete record.draft.candidates
  await saveDraft(record, record.draft.revision, event)
  return { cancelled: true, providerMayStillBeProcessing: record.draft.status === 'PROCESSING' }
}
export async function conversationFromSource(ownerId: string, id: string, input: unknown, event?: H3Event) {
  // Source ID is also the server-created conversation ID: retries cannot create a second chat.
  try { return await getStudyConversation(ownerId, id, event) }
  catch (cause) { if ((cause as { statusCode?: number }).statusCode !== 404) throw cause }
  const preferences = validateStudyPreferences(input)
  await assertStudyUploadAvailable(ownerId, event)
  let record = await ownedDraft(ownerId, id, event)
  if (record.draft.status !== 'READY' || !record.draft.extraction) throw new SourceError(409, 'Review a ready source before creating its learning plan.')
  const extraction = record.draft.extraction
  record.draft.status = 'COMMITTING'; record = await saveDraft(record, record.draft.revision, event)
  try {
    const result = await createStudyConversation(ownerId, record.draft.title, 'application/json', Buffer.from(JSON.stringify(extraction)), extraction, event, preferences, id)
    record.draft.status = 'COMMITTED'; record.draft.conversationId = id; delete record.draft.extraction
    await saveDraft(record, record.draft.revision, event)
    return result
  } catch (cause) {
    // A completed conversation is the durable idempotency record even when the
    // final draft update failed. Only a confirmed absence permits a local retry.
    try { return await getStudyConversation(ownerId, id, event) }
    catch (lookupError) {
      if ((lookupError as { statusCode?: number }).statusCode === 404) {
        record.draft.status = 'READY'
        await saveDraft(record, record.draft.revision, event).catch(() => undefined)
      }
    }
    throw cause
  }
}
