export type AirsStudyAction = 'UPLOAD' | 'PLAN' | 'PRACTISE' | 'SPEECH'
export interface AirsAccess {
  tier: 'FREE_PILOT' | 'RESTRICTED'
  allowedActions: Record<AirsStudyAction, boolean>
  limits: { uploadBytes: number; uploadPolicy: 'OBJECTIVE_COMPLETION'; uploadsPerMonth?: number; recordedSecondsPerDocument: number; spokenCharactersPerDocument: number }
  usage: { uploadsThisMonth?: number; nextUploadAt?: string; activeConversationId?: string; completionRequired: boolean; uploadRestrictionReason?: string; uploadRestrictionCode?: string; conversationId?: string; recordedSeconds?: number; spokenCharacters?: number }
  upgradeAvailable: false
}

/** Exact costly routes only; reading, deletion and discontinued endpoints remain unaffected. */
export function airsActionForRequest(method: string, path: string): AirsStudyAction | null {
  if (method !== 'POST') return null
  if (/^\/api\/study\/(?:sources\/inspect|sources\/[^/]+\/prepare|conversations\/from-source)\/?$/.test(path)) return 'UPLOAD'
  if (/^\/api\/study\/conversations\/?$/.test(path)) return 'UPLOAD'
  if (/^\/api\/study\/conversations\/[^/]+\/plan(?:\/recommend)?\/?$/.test(path)) return 'PLAN'
  if (/^\/api\/study\/conversations\/[^/]+\/(?:welcome|control|recorded-turn|live\/start)\/?$/.test(path)) return 'PRACTISE'
  if (/^\/api\/study\/conversations\/[^/]+\/speech\/?$/.test(path)) return 'SPEECH'
  return null
}
