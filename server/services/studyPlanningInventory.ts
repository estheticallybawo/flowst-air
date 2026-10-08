import { createError } from 'h3'
import type { StudyPreferences } from '../../shared/study'
import type { StudyChunk } from './studyRepository'
import { retrieveStudyPassages } from './studyRetrieval'

export const MISU_INVENTORY_MAX_CHARS = 32_000
const MAX_PASSAGES = 80

/** Extractive preview: no inference, synthetic summary, new source IDs or storage writes. */
export function buildMisuSourceInventory(chunks: StudyChunk[], preferences?: StudyPreferences) {
  const readable = chunks.filter(chunk => chunk.text.trim()).slice().sort((a, b) => a.position - b.position)
  if (!readable.length) throw createError({ statusCode: 422, statusMessage: 'This source has no readable passages. Choose another source.' })
  const selected = new Set<string>()
  function spread(count: number) {
    for (let i = 0; i < count; i++) selected.add(readable[Math.floor(i * (readable.length - 1) / Math.max(1, count - 1))]!.id)
  }
  if (readable.length > MAX_PASSAGES && preferences?.scope === 'FOCUSED' && preferences.context.trim()) {
    spread(MAX_PASSAGES / 2)
    for (const source of retrieveStudyPassages(readable, preferences.context, MAX_PASSAGES / 2).sources) selected.add(source.id)
  }
  const count = Math.min(MAX_PASSAGES, readable.length)
  for (let i = 0; i < count && selected.size < count; i++) selected.add(readable[Math.floor(i * (readable.length - 1) / Math.max(1, count - 1))]!.id)
  const included = readable.filter(chunk => selected.has(chunk.id))
  const sampled = included.length < readable.length
  const coverageNote = sampled ? `This plan uses excerpts from ${included.length} of ${readable.length} indexed passages. Review the proposed topics before starting; the full source remains saved.` : ''
  const header = `Source preview: ${included.length} of ${readable.length} indexed passages. These are partial, verbatim excerpts, not the complete document. Cite only supplied IDs and base goals only on the included text. Do not claim complete document coverage.`
  const rowBudget = Math.floor((MISU_INVENTORY_MAX_CHARS - header.length - 1) / included.length) - 1
  const rows = included.map(chunk => {
    const entry = { id: chunk.id, label: chunk.label.slice(0, 120), text: chunk.text.slice(0, 700) }
    let row = JSON.stringify(entry)
    if (row.length > rowBudget) {
      const original = entry.text
      let low = 0, high = original.length
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        if (JSON.stringify({ ...entry, text: original.slice(0, middle) }).length <= rowBudget) low = middle
        else high = middle - 1
      }
      entry.text = original.slice(0, low)
      row = JSON.stringify(entry)
    }
    if (!entry.text || row.length > rowBudget) throw createError({ statusCode: 422, statusMessage: 'This source has references too large for a study plan. Choose a smaller source.' })
    return row
  })
  return { text: header + '\n' + rows.join('\n'), chunks: included, coverageNote }
}
