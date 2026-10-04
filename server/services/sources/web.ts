import { createHash } from 'node:crypto'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import type { MaterialExtraction } from '../../../shared/studyMaterial'
import { readPublic, SourceError, type PublicReader } from './network'

export async function websiteSnapshot(url: string, reader: PublicReader = readPublic): Promise<{ title: string; extraction: MaterialExtraction }> {
  const response = await reader(url)
  if (!/^text\/html(?:;|$)/i.test(String(response.headers['content-type']))) throw new SourceError(415, 'This link is not an HTML page. Upload a document or supply the text instead.')
  // No runScripts or resources option: neither script execution nor subresource loading is enabled.
  const dom = new JSDOM(response.body.toString('utf8'), { url: response.url })
  try {
    const article = new Readability(dom.window.document, { charThreshold: 100 }).parse()
    if (!article?.textContent || article.textContent.trim().length < 80) throw new SourceError(422, 'This page has too little readable text. Supply the text or choose another page.')
    const content = new JSDOM(article.content || '')
    try {
      let heading = article.title || 'Page text'; let total = 0
      const sections: MaterialExtraction['sections'] = []
      for (const node of content.window.document.querySelectorAll('h1,h2,h3,h4,p,li,pre,blockquote,td')) {
        if (node.parentElement?.closest('li,pre,blockquote,td')) continue
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
        if (/^H[1-4]$/.test(node.tagName)) { heading = text.slice(0, 160); continue }
        if (!text) continue
        total += text.length
        if (total > 100_000) throw new SourceError(413, 'This page exceeds 100,000 extracted characters. Supply a shorter passage.')
        sections.push({ id: `web-${sections.length + 1}`, label: `${heading} · passage ${sections.length + 1}`, text, location: { url: response.url } })
      }
      if (!sections.length) throw new SourceError(422, 'No readable paragraphs were found. Supply the text instead.')
      return { title: (article.title || new URL(response.url).hostname).slice(0, 180), extraction: { kind: 'WEB', sections, excerpt: sections[0]!.text.slice(0, 320),
        provenance: { url: response.url, retrievedAt: new Date().toISOString(), provider: 'Public HTML / Readability', hash: createHash('sha256').update(JSON.stringify(sections)).digest('hex'),
          omissions: ['Only the readable text of this page was included. Linked pages, scripts, images, audio, and video were not read.'] } } }
    } finally { content.window.close() }
  } finally { dom.window.close() }
}
