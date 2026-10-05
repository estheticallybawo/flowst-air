import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ conversation: vi.fn(), save: vi.fn() }))
vi.hoisted(() => vi.stubGlobal('defineEventHandler', (handler: any) => handler))
vi.mock('../server/utils/auth', () => ({ requireIdentity: async () => ({ userId: 'owner' }) }))
vi.mock('../server/services/studyRepository', async () => ({ ...await vi.importActual<typeof import('../server/services/studyRepository')>('../server/services/studyRepository'), getStudyConversation: mocks.conversation, saveStudyPlan: mocks.save }))
import approve from '../server/api/study/conversations/[id]/plan/approve.post'
import { DEFAULT_STUDY_FUNCTION_REFS } from '../server/domain/neuromap/studyFunctions'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { appSurface: 'amira' }, studyAwsVoiceTrialMaxSeconds: 300 }))
  vi.stubGlobal('getRouterParam', () => 'study')
  vi.stubGlobal('readBody', async () => ({ version: 1 }))
  vi.stubGlobal('createError', (options: any) => Object.assign(new Error(options.statusMessage), options))
  mocks.conversation.mockResolvedValue({ id: 'study', ownerId: 'owner', revision: 1, voiceUsage: { transcribeSeconds: 1200, pollyCharacters: 25000 },
    plan: { status: 'DRAFT', version: 1, functionRefs: DEFAULT_STUDY_FUNCTION_REFS, objectives: Array.from({ length: 6 }, (_, index) => ({ id: `objective-${index}`, title: 'Concept' })) } })
  mocks.save.mockResolvedValue({})
})
afterEach(() => vi.unstubAllGlobals())

test('a six-objective draft can be approved after the retired standalone voice quota', async () => {
  await expect((approve as any)({})).resolves.toEqual({})
  expect(mocks.save).toHaveBeenCalledWith('owner', 'study', expect.objectContaining({ status: 'APPROVED' }), 1, {})
})

test('full Flowst retains its existing six-objective approval behavior', async () => {
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { appSurface: 'flowst' }, studyAwsVoiceTrialMaxSeconds: 300 }))
  await expect((approve as any)({})).resolves.toEqual({})
  expect(mocks.save).toHaveBeenCalledWith('owner', 'study', expect.objectContaining({ status: 'APPROVED' }), 1, {})
})

test('repeated approval returns the same owned version without another write',async()=>{
 const saved={id:'study',ownerId:'owner',plan:{status:'APPROVED',version:1,approvedBy:'owner'}}
 mocks.conversation.mockResolvedValue(saved)
 await expect((approve as any)({})).resolves.toEqual(saved)
 expect(mocks.save).not.toHaveBeenCalled()
})

test('approval cannot adopt another owner’s saved approval',async()=>{
 mocks.conversation.mockResolvedValue({id:'study',ownerId:'owner',plan:{status:'APPROVED',version:1,approvedBy:'other',objectives:[]}})
 await expect((approve as any)({})).rejects.toMatchObject({statusCode:409})
 expect(mocks.save).not.toHaveBeenCalled()
})
