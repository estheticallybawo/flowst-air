export type AirStudyAction = 'UPLOAD' | 'PLAN' | 'PRACTISE' | 'SPEECH'
export interface AirAccess {
  tier: 'FREE_PILOT' | 'RESTRICTED'
  allowedActions: Record<AirStudyAction, boolean>
  limits: { uploadBytes: number; uploadPolicy: 'OBJECTIVE_COMPLETION'; uploadsPerMonth?: number; recordedSecondsPerDocument: number | null; spokenCharactersPerDocument: number | null }
  usage: { uploadsThisMonth?: number; nextUploadAt?: string; activeConversationId?: string; completionRequired: boolean; uploadRestrictionReason?: string; uploadRestrictionCode?: string; conversationId?: string; recordedSeconds?: number; spokenCharacters?: number }
  upgradeAvailable: false
}

/** Exact costly routes only; reading, deletion and discontinued endpoints remain unaffected. */
export function airActionForRequest(method: string, path: string): AirStudyAction | null {
  if (method !== 'POST') return null
  if (/^\/api\/study\/(?:sources\/inspect|sources\/[^/]+\/prepare|conversations\/from-source)\/?$/.test(path)) return 'UPLOAD'
  if (/^\/api\/study\/conversations\/?$/.test(path)) return 'UPLOAD'
  if (/^\/api\/study\/conversations\/[^/]+\/plan(?:\/recommend)?\/?$/.test(path)) return 'PLAN'
  if (/^\/api\/study\/conversations\/[^/]+\/(?:welcome|control|recorded-turn|objective\/retry|live\/start)\/?$/.test(path)) return 'PRACTISE'
  if (/^\/api\/study\/conversations\/[^/]+\/speech\/?$/.test(path)) return 'SPEECH'
  return null
}
