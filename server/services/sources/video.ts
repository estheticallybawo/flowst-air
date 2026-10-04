import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { JSDOM } from 'jsdom'
import { sourceTime, type MaterialExtraction, type SourceDraft } from '../../../shared/studyMaterial'
import { publicUrl, readPublic, SourceError, type PublicReader } from './network'

const YOUTUBE = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']
const TIKTOK = ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']
export const VIDEO_HOSTS = [...YOUTUBE, ...TIKTOK]
export function videoReference(input: string): { url: string; platform: 'YOUTUBE' | 'TIKTOK'; id: string } | undefined {
  const url = publicUrl(input)
  if (YOUTUBE.includes(url.hostname)) {
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] : url.pathname === '/watch' ? url.searchParams.get('v') : undefined
    if (!id || !/^[\w-]{11}$/.test(id) || url.searchParams.has('list')) throw new SourceError(400, 'Use a single YouTube video link, without a playlist.')
    return { url: `https://www.youtube.com/watch?v=${id}`, platform: 'YOUTUBE', id }
  }
  if (TIKTOK.includes(url.hostname)) {
    const match = /^\/@([\w.-]+)\/video\/(\d{10,30})\/?$/.exec(url.pathname)
    if (!match) {
      if (['vm.tiktok.com', 'vt.tiktok.com'].includes(url.hostname) || /^\/t\/[\w-]+\/?$/.test(url.pathname)) return { url: url.origin + url.pathname, platform: 'TIKTOK', id: '' }
      throw new SourceError(400, 'Use the link to one public TikTok video.')
    }
    return { url: `https://www.tiktok.com/@${match[1]}/video/${match[2]}`, platform: 'TIKTOK', id: match[2]! }
  }
  return undefined
}
function seconds(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value !== 'string') return undefined
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value) || undefined
  const iso = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value)
  return iso ? Number(iso[1] || 0) * 3600 + Number(iso[2] || 0) * 60 + Number(iso[3] || 0) : undefined
}
export function videoMetadata(html: string, reference: NonNullable<ReturnType<typeof videoReference>>) {
  const dom = new JSDOM(html)
  try {
    const document = dom.window.document
    let duration: number | undefined
    let title = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title
    let creator: string | undefined; let accessible = false; let live = false
    // Parse only JSON, never evaluate platform JavaScript. Missing evidence fails closed.
    for (const script of document.querySelectorAll('script[type="application/ld+json"],script#__UNIVERSAL_DATA_FOR_REHYDRATION__,script#SIGI_STATE')) {
      let value: any
      try { value = JSON.parse(script.textContent || '') } catch { continue }
      const visit = (item: any, depth = 0) => {
        if (!item || typeof item !== 'object' || depth > 12) return
        // A page can contain recommended videos. Only metadata bound to this ID
        // may describe the paid job; generic page duration is never authoritative.
        let sameVideo = false
        for (const candidate of [item.url, item.embedUrl, item.contentUrl]) {
          if (typeof candidate !== 'string') continue
          try { const parsed = videoReference(candidate); sameVideo ||= parsed?.platform === reference.platform && parsed.id === reference.id } catch { /* Not a supported video URL. */ }
        }
        if (item['@type'] === 'VideoObject' && sameVideo) {
          title ||= item.name
          creator ||= typeof item.author === 'string' ? item.author : item.author?.name
          if (item.publication?.isLiveBroadcast === true || item.isLiveBroadcast === true) live = true
        }
        if (reference.platform === 'TIKTOK' && String(item.id) === reference.id && item.video) {
          duration = seconds(item.video.duration)
          creator ||= item.author?.nickname || item.author?.uniqueId
          title ||= item.desc
          accessible = item.privateItem === false && item.secret !== true
        }
        for (const child of Object.values(item)) if (typeof child === 'object') visit(child, depth + 1)
      }
      visit(value)
    }
    if (reference.platform === 'YOUTUBE') {
      const marker = /(?:var\s+)?ytInitialPlayerResponse\s*=\s*(\{)/g.exec(html)
      if (marker) {
        const start = marker.index + marker[0].length - 1
        let depth = 0; let quoted = false; let escaped = false
        for (let i = start; i < html.length; i++) {
          const char = html[i]
          if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue }
          if (char === '"') quoted = true
          else if (char === '{') depth++
          else if (char === '}' && --depth === 0) {
            try {
              const data = JSON.parse(html.slice(start, i + 1))
              if (data.videoDetails?.videoId === reference.id) {
                duration = seconds(data.videoDetails.lengthSeconds)
                title = data.videoDetails.title || title; creator = data.videoDetails.author || creator
                accessible = data.playabilityStatus?.status === 'OK' && data.videoDetails.isPrivate !== true && data.microformat?.playerMicroformatRenderer?.isUnlisted === false
                live ||= data.videoDetails.isLiveContent === true || data.videoDetails.isLive === true
              }
            } catch { /* A changed platform format becomes an unavailable source. */ }
            break
          }
        }
      }
    }
    return { title: String(title || `${reference.platform} video`).slice(0, 180), creator: creator?.slice(0, 180), durationSeconds: duration, accessible, live }
  } finally { dom.window.close() }
}
export async function inspectVideo(input: string, reader: PublicReader = readPublic) {
  let reference = videoReference(input)!
  const response = await reader(reference.url, { hosts: reference.platform === 'YOUTUBE' ? YOUTUBE : TIKTOK })
  reference = videoReference(response.url)!
  if (!reference?.id) throw new SourceError(422, 'The shared link could not be resolved to a public video. Paste its full video link.')
  if (!/^text\/html(?:;|$)/i.test(String(response.headers['content-type']))) throw new SourceError(422, 'Video metadata is unavailable. Supply a transcript instead.')
  const metadata = videoMetadata(response.body.toString('utf8'), reference)
  const available = metadata.accessible && !metadata.live && !!metadata.durationSeconds && metadata.durationSeconds <= 1800
  return { reference, metadata, available }
}

export function transcriptSnapshot(url: string, text: string, origin: 'GENERATED' | 'SUPPLIED', options: { words?: unknown; language?: string; video?: SourceDraft['video']; format?: string; fixture?: boolean } = {}): MaterialExtraction {
  if (!text.trim()) throw new SourceError(422, 'No speech or readable transcript was found. Choose another source or supply text.')
  if (text.length > 100_000) throw new SourceError(413, 'This transcript exceeds 100,000 characters. Supply a shorter passage.')
  const sections: MaterialExtraction['sections'] = []
  const append = (content: string, start?: number, end?: number) => {
    const value = content.replace(/<[^>]*>/g, '').replace(/\u0000/g, '').trim()
    if (!value) return
    if ((start !== undefined && (!Number.isFinite(start) || start < 0)) || (end !== undefined && (!Number.isFinite(end) || end < (start || 0) || end > 1800))) throw new SourceError(422, 'The transcript has invalid timestamps or exceeds 30 minutes.')
    const timed = start !== undefined && end !== undefined
    sections.push({ id: `transcript-${sections.length + 1}`, label: timed ? `${sourceTime(start)}–${sourceTime(end)}` : `Transcript · passage ${sections.length + 1}`, text: value,
      location: { ...(options.fixture ? {} : { url: options.video?.platform === 'YOUTUBE' && timed ? `${url}&t=${Math.floor(start)}s` : url }), ...(timed ? { startSeconds: start, endSeconds: end } : {}) } })
  }
  if (origin === 'GENERATED' && Array.isArray(options.words) && options.words.length) {
    let content = ''; let start: number | undefined; let end: number | undefined
    for (const word of options.words) {
      if (!word || typeof word.text !== 'string' || !['word', 'spacing'].includes(word.type)) continue
      if (!Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0 || word.end < word.start || word.end > 1800) throw new SourceError(422, 'The generated transcript contains invalid timestamps.')
      if (start === undefined) start = word.start
      end = word.end; content += word.text
      if (content.length >= 650 && word.type === 'spacing') { append(content, start, end); content = ''; start = undefined }
    }
    append(content, start, end)
  } else if (/^(?:srt|vtt)$/i.test(options.format || '')) {
    const time = (value: string) => value.replace(',', '.').split(':').reduce((sum, part) => sum * 60 + Number(part), 0)
    const pattern = /((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})[^\n]*\n([\s\S]*?)(?=\n\s*\n|$)/g
    for (const match of text.replace(/\r\n/g, '\n').matchAll(pattern)) append(match[3]!, time(match[1]!), time(match[2]!))
    if (!sections.length) throw new SourceError(422, 'No valid subtitle cues were found. Paste plain text or choose a valid SRT/VTT file.')
  } else {
    for (let index = 0; index < text.length; index += 1000) append(text.slice(index, index + 1000))
  }
  if (!sections.length) throw new SourceError(422, 'No readable speech was found in this transcript.')
  if (sections.reduce((total, section) => total + section.text.length, 0) > 100_000) throw new SourceError(413, 'The transcript is too long.')
  return { kind: options.video ? 'VIDEO' : 'TRANSCRIPT', sections, excerpt: sections[0]!.text.slice(0, 320), provenance: {
    url, provider: options.fixture ? 'Local demonstration fixture' : origin === 'GENERATED' ? 'ElevenLabs Scribe v2' : 'Learner-supplied transcript', retrievedAt: new Date().toISOString(), transcriptOrigin: origin,
    hash: createHash('sha256').update(JSON.stringify(sections)).digest('hex'), language: options.language, platform: options.video?.platform,
    videoId: options.video?.id, creator: options.video?.creator, durationSeconds: options.video?.durationSeconds, fixture: options.fixture,
    omissions: ['Only transcript text is included. Diagrams, demonstrations, on-screen text, and other visual information were not inspected.', ...(origin === 'SUPPLIED' ? ['The supplied transcript has not been verified against the original video.'] : ['AI transcription can contain errors. Review names and technical terms.'])],
  } }
}

export function verifyTranscriptionSignature(raw: string, signature: string, secret: string, now = Date.now()) {
  if (!secret || raw.length > 2 * 1024 * 1024) return false
  const parts = signature.split(',').map(part => part.trim().split('='))
  const timestamp = parts.find(([key]) => key === 't')?.[1]
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest()
  return parts.some(([key, value]) => key === 'v0' && !!value && /^[a-f0-9]{64}$/i.test(value) && timingSafeEqual(expected, Buffer.from(value, 'hex')))
}
