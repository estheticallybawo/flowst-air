import { afterEach, expect, test, vi } from 'vitest'
import { airActionForRequest } from '../shared/airAccess'
import { airReturnPath } from '../shared/airNavigation'
import { isAirPublicPage, isAirStandalone, isAirStandaloneApi, canonicalAirPath } from '../shared/airSurface'
import { assertAirStudyAccess, getAirAccess } from '../server/services/airAccess'
import { getStudyConversation } from '../server/services/studyRepository'

vi.mock('../server/services/studyRepository', async () => ({
  ...await vi.importActual<typeof import('../server/services/studyRepository')>('../server/services/studyRepository'),
  getStudyUploadEligibility: vi.fn(async () => ({ canUpload: false, completionRequired: true, activeConversationId: 'active-study', reason: 'Finish your study objectives.', reasonCode: 'ACTIVE_STUDY_UNFINISHED' })),
  getStudyConversation: vi.fn(async (owner: string) => { if (owner !== 'owner') throw Object.assign(new Error('Not found'), { statusCode: 404 }); return { id: 'study', voiceUsage: { transcribeSeconds: 37, pollyCharacters: 428 } } }),
}))
afterEach(() => vi.unstubAllGlobals())
function config(enabled = true, surface = 'air') { vi.stubGlobal('useRuntimeConfig', () => ({ airStudyAccessEnabled: enabled, public: { appSurface: surface }, studyAwsVoiceTrialMaxSeconds: 300, studyAwsVoiceTrialMaxCharacters: 6000 })) }

test('public Flowst Air entry is separate from private study and account screens', () => {
  for (const path of ['/', '/airs/pricing/', '/airs/about', '/auth/register']) expect(isAirPublicPage(path)).toBe(true)
  for (const path of ['/airs', '/airs/new', '/airs/settings', '/airs/study']) expect(isAirPublicPage(path)).toBe(false)
})
test('costly operations are covered while reading and deletion remain available', () => {
  for (const suffix of ['plan', 'plan/recommend', 'welcome', 'control', 'recorded-turn', 'speech']) expect(airActionForRequest('POST', `/api/study/conversations/study/${suffix}`)).not.toBeNull()
  expect(airActionForRequest('POST', '/api/study/conversations')).toBe('UPLOAD')
  for (const method of ['GET', 'DELETE']) expect(airActionForRequest(method, '/api/study/conversations/study')).toBeNull()
  expect(airActionForRequest('POST', '/api/auth/sign-out')).toBeNull()
  expect(airActionForRequest('POST', '/api/study/conversations/study/turns')).toBeNull()
  expect(airActionForRequest('POST', '/api/study/conversations/study/abandon')).toBeNull()
})
test('restriction denies every costly action with a structured recovery destination', async () => {
  config(false)
  for (const action of ['UPLOAD', 'PLAN', 'PRACTISE', 'SPEECH'] as const)
    await expect(assertAirStudyAccess('owner', action)).rejects.toMatchObject({ statusCode: 403, data: { code: 'AMIRA_ACCESS_RESTRICTED', action, upgradeAvailable: false } })
  config(false, 'flowst')
  await expect(assertAirStudyAccess('owner', 'UPLOAD')).resolves.toBeUndefined()
})
test('access reports the active completion gate and per-document usage and verifies ownership', async () => {
  config()
  const access = await getAirAccess('owner', undefined, 'study')
  expect(access).toMatchObject({ tier: 'FREE_PILOT', allowedActions: { UPLOAD: false, PRACTISE: true }, limits: { uploadPolicy: 'OBJECTIVE_COMPLETION' }, usage: { activeConversationId: 'active-study', completionRequired: true, recordedSeconds: 37, spokenCharacters: 428 }, upgradeAvailable: false })
  await expect(getAirAccess('other-owner', undefined, 'study')).rejects.toMatchObject({ statusCode: 404 })
})
test('an abandoned document is read-only and cannot start costly usage', async () => {
  config()
  const record = { id: 'study', abandonedAt: '2026-10-01T08:00:00Z', voiceUsage: { transcribeSeconds: 37, pollyCharacters: 428 } }
  vi.mocked(getStudyConversation).mockResolvedValueOnce(record as any)
  expect((await getAirAccess('owner', undefined, 'study')).allowedActions).toMatchObject({ PLAN: false, PRACTISE: false, SPEECH: false })
  for (const action of ['PLAN', 'PRACTISE', 'SPEECH'] as const) {
    vi.mocked(getStudyConversation).mockResolvedValueOnce(record as any)
    await expect(assertAirStudyAccess('owner', action, undefined, 'study')).rejects.toMatchObject({ statusCode: 409, data: { code: 'AMIRA_STUDY_ABANDONED', nextAction: '/airs/new' } })
  }
})
test('authentication return paths reject foreign origins and lookalike product prefixes', () => {
  for (const value of ['//outside.example', '/air-extra', '/home', '/\\outside.example', 'https://outside.example', '/airs/../../home']) expect(airReturnPath(value)).toBe('/airs')
  expect(airReturnPath('/airs/study?view=plan#sources')).toBe('/airs/study?view=plan#sources')
})

test('legacy bookmarks normalize without widening authentication or API permissions', async () => {
  expect(airReturnPath('/amira/study?view=plan#sources')).toBe('/airs/study?view=plan#sources')
  for (const value of ['/amira-extra', '/amira/../../home', '//outside.example/amira', '/amira\\outside.example']) expect(airReturnPath(value)).toBe('/airs')
  expect(canonicalAirPath('/amira/new?source=draft#review')).toBe('/airs/new?source=draft#review')
  expect(canonicalAirPath('/amira-extra')).toBe('/amira-extra')
  expect(isAirStandalone('amira')).toBe(true)
  expect(isAirStandaloneApi('/api/amira/access')).toBe(true)
  expect(isAirStandaloneApi('/api/amira/delete')).toBe(false)
  expect(isAirPublicPage('/amira/settings')).toBe(false)
  config(false, 'amira')
  await expect(assertAirStudyAccess('owner', 'UPLOAD')).rejects.toMatchObject({statusCode:403})
})
