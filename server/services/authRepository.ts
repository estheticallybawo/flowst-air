import { awsClientConfig } from './awsClientConfig'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import type { AuthIdentity, MeSnapshot, PlatformPermission, SchoolCapability } from '../../shared/auth'

function communityCapabilities(complete: boolean, canPublish: boolean, permissions: PlatformPermission[]) {
  return {
    canView: complete,
    canInteract: complete,
    canPublish: complete && canPublish,
    canModerate: permissions.includes('COMMUNITY_MODERATOR'),
    publishReason: complete && !canPublish ? 'Sharing is available to eligible learner accounts with a shareable Flowst artifact.' : undefined,
  }
}

export function hasCommunityPublishingCapability(explicitCapability: boolean, schools: SchoolCapability[]) {
  return explicitCapability || schools.some(item => item.status === 'APPROVED')
}

const mockSchool = (permission: SchoolCapability['permission'], status: SchoolCapability['status'] = 'APPROVED', schoolId = 'school-aster'): SchoolCapability => ({
  schoolId,
  schoolSlug: schoolId === 'school-aster' ? 'aster-academy' : 'another-school',
  schoolName: schoolId === 'school-aster' ? 'Aster Academy' : 'Another School',
  permission,
  status,
})

export function mockMe(scenario = 'member'): MeSnapshot {
  const complete = scenario !== 'profile-incomplete'
  const schools: SchoolCapability[] = scenario === 'admin'
    ? [mockSchool('ADMIN')]
    : scenario === 'educator'
      ? [mockSchool('EDUCATOR')]
      : scenario === 'wrong-school'
        ? [mockSchool('ADMIN', 'APPROVED', 'school-other')]
        : scenario === 'revoked'
          ? [mockSchool('ADMIN', 'REVOKED')]
          : scenario === 'pending'
            ? [mockSchool('LEARNER', 'PENDING')]
            : []

  const platformPermissions: PlatformPermission[] = scenario === 'moderator' ? ['COMMUNITY_MODERATOR'] : []
  const canPublish = scenario !== 'supporter' && scenario !== 'profile-incomplete'
  return {
    profile: {
      userId: `mock-${scenario}`,
      email: `${scenario}@flowst.local`,
      handle: complete ? (scenario === 'admin' ? 'esther' : scenario) : undefined,
      displayName: complete ? (scenario === 'admin' ? 'Esther Tsotso' : 'Flowst Learner') : undefined,
      initials: scenario === 'admin' ? 'E' : 'F',
      complete,
    },
    schools,
    cohorts: [],
    platformPermissions,
    community: communityCapabilities(complete, canPublish, platformPermissions),
  }
}

const clientFor = (region: string) => DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(region)))

export async function getMe(identity: AuthIdentity, event?: Parameters<typeof useRuntimeConfig>[0]): Promise<MeSnapshot> {
  const config = useRuntimeConfig(event)
  if (config.flowstAuthMode === 'mock' && process.env.NODE_ENV !== 'production') return mockMe(identity.scenario)
  const tableName = String(config.dynamoTable || '')
  if (!tableName) throw createError({ statusCode: 503, statusMessage: 'Profile storage is not configured.' })
  const db = clientFor(String(config.awsRegion || 'us-east-1'))
  const profileResult = await db.send(new GetCommand({ TableName: tableName, Key: { pk: `USER#${identity.userId}`, sk: 'PROFILE' } }))
  const memberships = await db.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI2',
    KeyConditionExpression: 'gsi2pk = :user AND begins_with(gsi2sk, :school)',
    ExpressionAttributeValues: { ':user': `USER#${identity.userId}`, ':school': 'SCHOOL#' },
  }))
  const item = profileResult.Item
  const complete = Boolean(item?.handle && item?.displayName)
  const platformPermissions = (Array.isArray(item?.platformPermissions) ? item.platformPermissions : [])
    .filter((permission: unknown): permission is PlatformPermission => permission === 'COMMUNITY_MODERATOR')
  const schools: SchoolCapability[] = (memberships.Items || []).map(record => ({
    schoolId: String(record.schoolId), schoolSlug: String(record.schoolSlug), schoolName: String(record.schoolName),
    permission: record.permission, status: record.status,
  }))
  return {
    profile: {
      userId: identity.userId,
      email: String(item?.email || identity.email || ''),
      handle: item?.handle,
      displayName: item?.displayName,
      initials: String(item?.initials || item?.displayName?.slice(0, 1) || 'F'),
      complete,
    },
    schools,
    cohorts: [],
    platformPermissions,
    community: communityCapabilities(
      complete,
      hasCommunityPublishingCapability(item?.communityCanPublish === true, schools),
      platformPermissions,
    ),
  }
}

export async function getSchoolCapability(identity: AuthIdentity, schoolId: string, event?: Parameters<typeof useRuntimeConfig>[0]) {
  const me = await getMe(identity, event)
  return me.schools.find(item => item.schoolId === schoolId)
}

export async function isHandleAvailable(identity: AuthIdentity, handle: string, event?: Parameters<typeof useRuntimeConfig>[0]) {
  const config = useRuntimeConfig(event)
  if (config.flowstAuthMode === 'mock' && process.env.NODE_ENV !== 'production') {
    return !['flowst', 'admin', 'miro', 'kyla', 'air', 'amira', 'amina', 'misu', 'neo', 'kai', 'support'].includes(handle)
  }
  const tableName = String(config.dynamoTable || '')
  if (!tableName) throw createError({ statusCode: 503, statusMessage: 'Profile storage is not configured.' })
  const result = await clientFor(String(config.awsRegion || 'us-east-1')).send(new GetCommand({
    TableName: tableName,
    Key: { pk: `HANDLE#${handle}`, sk: 'CLAIM' },
  }))
  return !result.Item || result.Item.userId === identity.userId
}

export async function completeMemberProfile(
  identity: AuthIdentity,
  input: { displayName: string, handle: string },
  event?: Parameters<typeof useRuntimeConfig>[0],
): Promise<MeSnapshot['profile']> {
  const displayName = input.displayName.trim()
  const handle = input.handle.trim().toLowerCase()
  const profile = {
    userId: identity.userId,
    email: identity.email,
    handle,
    displayName,
    initials: displayName.slice(0, 1).toUpperCase(),
    complete: true,
    communityCanPublish: false,
  }
  const config = useRuntimeConfig(event)
  if (config.flowstAuthMode === 'mock' && process.env.NODE_ENV !== 'production') return profile
  const tableName = String(config.dynamoTable || '')
  if (!tableName) throw createError({ statusCode: 503, statusMessage: 'Profile storage is not configured.' })
  const updatedAt = new Date().toISOString()
  try {
    await clientFor(String(config.awsRegion || 'us-east-1')).send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: { pk: `HANDLE#${handle}`, sk: 'CLAIM', entityType: 'HandleClaim', handle, userId: identity.userId, updatedAt },
            ConditionExpression: 'attribute_not_exists(pk) OR userId = :userId',
            ExpressionAttributeValues: { ':userId': identity.userId },
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: { pk: `USER#${identity.userId}`, sk: 'PROFILE', entityType: 'MemberProfile', ...profile, updatedAt },
          },
        },
      ],
    }))
  } catch (cause) {
    const name = typeof cause === 'object' && cause && 'name' in cause ? String(cause.name) : ''
    if (name === 'TransactionCanceledException') throw createError({ statusCode: 409, statusMessage: `@${handle} is already taken. Try another handle.` })
    throw cause
  }
  const { communityCanPublish: _communityCanPublish, ...publicProfile } = profile
  return publicProfile
}
