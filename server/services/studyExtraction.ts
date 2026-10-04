import mammoth from 'mammoth'
import JSZip from 'jszip'
import { createError } from 'h3'
import type { MaterialExtraction, MaterialSection } from '../../shared/studyMaterial'

export interface StudySection extends MaterialSection {}
export interface StudyExtraction extends MaterialExtraction {}

const MAX_BYTES = 20 * 1024 * 1024
const MAX_TEXT = 500_000

function clean(text: string) {
  return text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function decodeXml(value: string) {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }
    if (named[entity]) return named[entity]
    const code = entity.startsWith('&#x') ? Number.parseInt(entity.slice(3, -1), 16) : Number.parseInt(entity.slice(2, -1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(code) : entity
  })
}

export async function extractStudyDocument(name: string, data: Buffer): Promise<StudyExtraction> {
  if (!data.length || data.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'Choose a document smaller than 20 MB.' })
  const extension = name.toLowerCase().split('.').pop()
  let kind: StudyExtraction['kind']
  let sections: StudySection[] = []

  try {
    if (extension === 'pdf') {
      if (data.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid PDF')
      kind = 'PDF'
      // Explicitly trace the native dependency into serverless output. Load it
      // before PDF.js, whose Node polyfills need it during module evaluation.
      let PDFParse: typeof import('pdf-parse-modern').PDFParse
      try {
        await import('@napi-rs/canvas')
        ;({ PDFParse } = await import('pdf-parse-modern'))
      } catch (error) {
        console.error('Study PDF runtime initialization failed', error instanceof Error ? error.name : 'UnknownError')
        throw createError({ statusCode: 503, statusMessage: 'We couldn’t open your PDF right now. Please try again shortly.' })
      }
      const parser = new PDFParse({ data: new Uint8Array(data) })
      try {
        const result = await parser.getText({ first: 250 })
        if (result.total > 250) throw createError({ statusCode: 413, statusMessage: 'This PDF has more than 250 pages. Split it into smaller study documents so Misu can cover every page.' })
        sections = result.pages.map(page => ({ id: `page-${page.num}`, label: `Page ${page.num}`, text: clean(page.text) })).filter(page => page.text)
      } finally {
        await parser.destroy()
      }
    } else if (extension === 'docx') {
      if (data.subarray(0, 2).toString() !== 'PK') throw new Error('Invalid DOCX')
      kind = 'DOCX'
      const html = (await mammoth.convertToHtml({ buffer: data })).value
      const blocks = html.match(/<(?:h[1-6]|p|li|table)[^>]*>[\s\S]*?<\/(?:h[1-6]|p|li|table)>/gi) || []
      let heading = 'Opening section'
      let number = 0
      for (const block of blocks) {
        const text = clean(decodeXml(block.replace(/<[^>]+>/g, ' ')))
        if (!text) continue
        if (/^<h[1-6]\b/i.test(block)) heading = text.slice(0, 100)
        else {
          number++
          sections.push({ id: `paragraph-${number}`, label: `${heading} · paragraph ${number}`, text })
        }
      }
    } else if (extension === 'pptx') {
      if (data.subarray(0, 2).toString() !== 'PK') throw new Error('Invalid PPTX')
      kind = 'PPTX'
      const zip = await JSZip.loadAsync(data, { checkCRC32: true })
      const slides = Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]))
      for (const path of slides) {
        const xml = await zip.file(path)!.async('string')
        const paragraphs = xml.match(/<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g) || []
        const text = clean(paragraphs.map(p => [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match => decodeXml(match[1] || '')).join(' ')).join('\n'))
        if (text) {
          const slide = Number(path.match(/slide(\d+)/)?.[1])
          sections.push({ id: `slide-${slide}`, label: `Slide ${slide}`, text })
        }
      }
    } else throw createError({ statusCode: 415, statusMessage: 'Use a PDF, DOCX, or PPTX file.' })
  } catch (error) {
    if (typeof error === 'object' && error && 'statusCode' in error) throw error
    throw createError({ statusCode: 422, statusMessage: 'This document could not be read. Check that it is not encrypted or damaged.' })
  }

  if (sections.reduce((total, section) => total + section.text.length, 0) > MAX_TEXT) throw createError({ statusCode: 413, statusMessage: 'This document has too much text for one study chat. Split it so Misu can cover every section.' })
  const fullText = sections.map(section => section.text).join(' ')
  if (fullText.length < 40) throw createError({ statusCode: 422, statusMessage: 'No readable text was found. Scanned pages and image-only slides are not supported yet.' })
  return { kind: kind!, sections, excerpt: fullText.slice(0, 280) }
}
