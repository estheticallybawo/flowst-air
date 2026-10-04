import type { StudySource } from '../../shared/study'
import type { StudyChunk } from './studyRepository'

const words = (text: string) => [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(word => !new Set(['the', 'and', 'for', 'with', 'what', 'how', 'does', 'this', 'that', 'from', 'about']).has(word)))]

export function retrieveStudyPassages(chunks: StudyChunk[], query: string, limit = 4): { sources: StudySource[], coverage: 'FULL' | 'PARTIAL' | 'NONE' } {
  const terms = words(query)
  if (!terms.length) return { sources: [], coverage: 'NONE' }
  const ranked = chunks.map(chunk => {
    const lower = chunk.text.toLowerCase()
    const matched = terms.filter(term => lower.includes(term))
    return { chunk, score: matched.length / terms.length, hits: matched.length }
  }).filter(item => item.hits > 0).sort((a, b) => b.score - a.score || b.hits - a.hits || a.chunk.position - b.chunk.position)
  const selected = ranked.slice(0, limit)
  const best = selected[0]?.score || 0
  return { sources: selected.map(({ chunk }) => ({ id: chunk.id, label: chunk.label, excerpt: chunk.excerpt, ...(chunk.location ? { location: chunk.location } : {}) })), coverage: best >= 0.55 ? 'FULL' : best >= 0.2 ? 'PARTIAL' : 'NONE' }
}
