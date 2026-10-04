import { z } from 'zod'

export type CommunityPostKind = 'FLOWST_NOTICE' | 'NEO_CREATION' | 'ACHIEVEMENT' | 'LEARNING_UPDATE'
export type CommunityPostStatus = 'DRAFT' | 'PUBLISHED' | 'REJECTED' | 'REMOVED' | 'DELETED'
export type LearningProgressState = 'STARTED' | 'MAKING_PROGRESS' | 'COMPLETED' | 'NEEDS_ENCOURAGEMENT'
export type CommunityReportReason = 'SAFETY' | 'HARASSMENT' | 'PRIVACY' | 'SPAM' | 'OTHER'

export interface CommunityMember {
  userId: string
  handle: string
  displayName: string
  initials: string
  official?: boolean
}

export type CommunityArtifact =
  | { kind: 'FLOWST_NOTICE', title: string, message: string }
  | { kind: 'NEO_CREATION', title: string, altText: string, mediaId: string, mediaUrl: string }
  | { kind: 'ACHIEVEMENT', achievementId: string, title: string, description: string, earnedAt: string }
  | { kind: 'LEARNING_UPDATE', activityTitle: string, progress: LearningProgressState }

export interface CommunityPost {
  id: string
  author: CommunityMember
  kind: CommunityPostKind
  artifact: CommunityArtifact
  caption?: string
  status: CommunityPostStatus
  moderationMessage?: string
  commentsLocked: boolean
  pinned?: boolean
  rootCount: number
  commentCount: number
  viewerHasRooted: boolean
  isOwn: boolean
  createdAt: string
  updatedAt: string
  destination: string
}

export interface CommunityComment {
  id: string
  postId: string
  author: CommunityMember
  text: string
  status: 'PUBLISHED' | 'REMOVED' | 'DELETED'
  isOwn: boolean
  createdAt: string
}

export interface CommunityCapabilities {
  canView: boolean
  canInteract: boolean
  canPublish: boolean
  canModerate: boolean
  publishReason?: string
}

export interface CommunityFeedPage {
  posts: CommunityPost[]
  nextCursor?: string
  capabilities: CommunityCapabilities
}

export interface CommunityPostDetail {
  post: CommunityPost
  comments: CommunityComment[]
  capabilities: CommunityCapabilities
}

export interface CommunityReport {
  id: string
  reporterId: string
  subjectType: 'POST' | 'COMMENT' | 'MEMBER'
  subjectId: string
  reason: CommunityReportReason
  details?: string
  status: 'OPEN' | 'RESOLVED'
  createdAt: string
  resolvedAt?: string
  resolution?: 'NO_ACTION' | 'HIDE' | 'LOCK'
  moderatorNote?: string
}

export interface CommunityNotification {
  id: string
  kind: 'COMMENT_RECEIVED' | 'ROOTS_RECEIVED'
  title: string
  detail: string
  createdAt: string
  readAt?: string
  destination: string
}

const caption = z.string().trim().max(500).optional().transform(value => value || undefined)

export const createCommunityPostSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('NEO_CREATION'), mediaId: z.string().uuid(), title: z.string().trim().min(2).max(100), altText: z.string().trim().min(3).max(180), caption, privacyConfirmed: z.literal(true) }),
  z.object({ kind: z.literal('ACHIEVEMENT'), achievementId: z.string().trim().min(3).max(120), caption, privacyConfirmed: z.literal(true) }),
  z.object({ kind: z.literal('LEARNING_UPDATE'), activityTitle: z.string().trim().min(3).max(100), progress: z.enum(['STARTED', 'MAKING_PROGRESS', 'COMPLETED', 'NEEDS_ENCOURAGEMENT']), caption, privacyConfirmed: z.literal(true) }),
])

export type CreateCommunityPostInput = z.infer<typeof createCommunityPostSchema>
export const updateCommunityPostSchema = z.object({ caption, commentsLocked: z.boolean().optional() })
export const createCommunityCommentSchema = z.object({ text: z.string().trim().min(1).max(500) })
export const createCommunityReportSchema = z.object({ subjectType: z.enum(['POST', 'COMMENT', 'MEMBER']), subjectId: z.string().trim().min(1).max(160), reason: z.enum(['SAFETY', 'HARASSMENT', 'PRIVACY', 'SPAM', 'OTHER']), details: z.string().trim().max(500).optional().transform(value => value || undefined) })
export const moderateCommunityReportSchema = z.object({ resolution: z.enum(['NO_ACTION', 'HIDE', 'LOCK']), note: z.string().trim().min(3).max(500) })
