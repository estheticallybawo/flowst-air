import { it,expect,vi,afterEach } from 'vitest'
const mocks=vi.hoisted(()=>({send:vi.fn()}))
vi.mock('../server/services/studyRepository',()=>({studyStorageResources:()=>({mock:false,table:'fixture',db:{send:mocks.send}}),getStudyConversation:vi.fn()}))
import { reserveGuestAllowance } from '../server/services/airsContext'
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks()})
function config(){vi.stubEnv('NODE_ENV','production');vi.stubGlobal('useRuntimeConfig',()=>({airsGuestDailyModelLimit:2,airsGuestDailyVoiceLimit:1}))}
it('denies exhausted deployment usage even for a fresh guest identity',async()=>{config();mocks.send.mockResolvedValue({Item:{count:2}});await expect(reserveGuestAllowance('guest-new','MODEL')).rejects.toMatchObject({statusCode:429});expect(mocks.send).toHaveBeenCalledTimes(1)})
it('reserves before dispatch with a conditional deployment-wide write',async()=>{config();mocks.send.mockResolvedValueOnce({Item:{count:1}}).mockResolvedValueOnce({});await reserveGuestAllowance('guest-new','MODEL');const write=mocks.send.mock.calls[1]![0].input;expect(write.Item.count).toBe(2);expect(write.ConditionExpression).toBe('#count = :old');expect(write.Item.pk).toMatch(/^AIRS_GUEST_USAGE#/);expect(write.Item.pk).not.toContain('guest-new')})
it('leaves authenticated Flowst allowance unchanged',async()=>{config();await reserveGuestAllowance('flowst-owner','VOICE');expect(mocks.send).not.toHaveBeenCalled()})
it('does not reserve or read a daily voice quota for repeated production guest requests',async()=>{config();for(let attempt=0;attempt<12;attempt++)await reserveGuestAllowance('guest-new','VOICE');expect(mocks.send).not.toHaveBeenCalled()})
