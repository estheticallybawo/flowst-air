/** Source identity is separate from a citation into its immutable snapshot. */
export type StudyMaterialKind = 'PDF' | 'DOCX' | 'PPTX' | 'GITHUB' | 'WEB' | 'VIDEO' | 'TRANSCRIPT'
export interface StudyLocation {
  url?: string
  path?: string
  startLine?: number
  endLine?: number
  startSeconds?: number
  endSeconds?: number
}
export interface StudyProvenance {
  url: string
  retrievedAt: string
  hash: string
  provider: string
  commit?: string
  license?: string
  platform?: 'YOUTUBE' | 'TIKTOK'
  videoId?: string
  creator?: string
  language?: string
  durationSeconds?: number
  transcriptOrigin?: 'GENERATED' | 'SUPPLIED'
  omissions: string[]
  fixture?: boolean
}
export interface MaterialSection {
  id: string
  label: string
  text: string
  location?: StudyLocation
}
export interface MaterialExtraction {
  kind: StudyMaterialKind
  sections: MaterialSection[]
  excerpt: string
  provenance?: StudyProvenance
}
export interface GitHubCandidate { path: string; size: number; sha: string }
export interface SourceDraft {
  id: string
  kind: 'GITHUB' | 'WEB' | 'VIDEO' | 'TRANSCRIPT'
  status: 'SELECT' | 'VIDEO_READY' | 'PROCESSING' | 'READY' | 'UNAVAILABLE' | 'FAILED' | 'COMMITTING' | 'COMMITTED'
  title: string
  url: string
  createdAt: string
  expiresAt: number
  revision: number
  omissions: string[]
  candidates?: GitHubCandidate[]
  repository?: { owner: string; repo: string; commit: string; license?: string; requests: number }
  video?: { platform: 'YOUTUBE' | 'TIKTOK'; id: string; durationSeconds?: number; creator?: string }
  extraction?: MaterialExtraction
  message?: string
  conversationId?: string
  fixture?: boolean
}

export function sourceTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`
}
