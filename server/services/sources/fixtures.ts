import { transcriptSnapshot } from './video'
import type { MaterialExtraction } from '../../../shared/studyMaterial'
import { createHash } from 'node:crypto'

export const FIXTURE_TEXT = 'Retrieval practice means trying to recall an idea before looking at the source again. An attempt reveals what you can explain and what needs another look. Feedback helps you compare that attempt with the source. Spacing means returning to an idea after a delay. To transfer an idea, apply it to a different situation and explain why it fits. For an interview, explain a concept in your own words and then describe how you would use it in a new project.'
export function sourceFixture(kind: 'GITHUB' | 'WEB' | 'VIDEO'): MaterialExtraction {
  const url = `https://fixtures.flowst-airs.invalid/${kind.toLowerCase()}`
  if (kind === 'VIDEO') return transcriptSnapshot(url, FIXTURE_TEXT, 'GENERATED', { fixture: true, video: { platform: 'YOUTUBE', id: 'fixture-only', durationSeconds: 90 },
    words: FIXTURE_TEXT.split(' ').flatMap((text, index) => [{ type: 'word', text, start: index, end: index + 0.8 }, { type: 'spacing', text: ' ', start: index + 0.8, end: index + 1 }]), language: 'en' })
  return { kind, sections: [{ id: 'fixture-1', label: kind === 'GITHUB' ? 'README.md · lines 1–4' : 'Learning strategies · passage 1', text: FIXTURE_TEXT }], excerpt: FIXTURE_TEXT.slice(0, 320),
    provenance: { url, provider: 'Local demonstration fixture', hash: createHash('sha256').update(FIXTURE_TEXT).digest('hex'), retrievedAt: new Date().toISOString(), fixture: true, omissions: ['Demonstration material written for Flowst Airs. No external source was contacted.'], ...(kind === 'GITHUB' ? { commit: '0'.repeat(40), license: 'MIT' } : {}) } }
}
