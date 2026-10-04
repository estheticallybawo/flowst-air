export type SchoolPermission = 'ADMIN' | 'EDUCATOR' | 'LEARNER'
export type PlatformPermission = 'COMMUNITY_MODERATOR'
export type MembershipStatus = 'PENDING' | 'APPROVED' | 'REVOKED' | 'EXPIRED'

export interface MemberProfile {
  userId: string
  email: string
  handle?: string
  displayName?: string
  initials: string
  complete: boolean
}

export interface SchoolCapability {
  schoolId: string
  schoolSlug: string
  schoolName: string
  permission: SchoolPermission
  status: MembershipStatus
}

export interface CohortCapability {
  cohortId: string
  cohortSlug: string
  schoolId: string
  status: MembershipStatus
}

export interface MeSnapshot {
  profile: MemberProfile
  schools: SchoolCapability[]
  cohorts: CohortCapability[]
  platformPermissions: PlatformPermission[]
  community: import('./community').CommunityCapabilities
}

export interface AuthSessionResponse {
  authenticated: boolean
  accessToken?: string
  expiresIn?: number
  me?: MeSnapshot
}

export interface AuthIdentity {
  userId: string
  email: string
  scenario?: string
}
