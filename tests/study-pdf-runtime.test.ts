import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { extractStudyDocument } from '../server/services/studyExtraction'

describe('serverless PDF extraction', () => {
  it('reads text and page locations when the default worker file is absent', async () => {
    await import('@napi-rs/canvas')
    const { GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const previous = GlobalWorkerOptions.workerSrc
    GlobalWorkerOptions.workerSrc = 'file:///missing-serverless-pdf.worker.mjs'
    try {
      const pdf = await PDFDocument.create()
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      pdf.addPage().drawText('Plants capture sunlight and use its energy to produce glucose.', { x: 40, y: 700, font, size: 12 })
      pdf.addPage() // Blank pages must not renumber citations.
      pdf.addPage().drawText('Chlorophyll absorbs light inside the chloroplast.', { x: 40, y: 700, font, size: 12 })
      const result = await extractStudyDocument('source.pdf', Buffer.from(await pdf.save()))
      expect(result.sections.map(section => section.id)).toEqual(['page-1', 'page-3'])
      expect(result.sections[1]?.text).toContain('Chlorophyll')
      expect(result.excerpt).toContain('Plants capture sunlight')
    } finally {
      GlobalWorkerOptions.workerSrc = previous
    }
  })
})
