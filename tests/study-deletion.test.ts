import {beforeEach,afterAll,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({db:vi.fn(),s3:vi.fn(),speech:vi.fn(),context:vi.fn()}))
vi.mock('@aws-sdk/client-dynamodb',()=>({DynamoDBClient:class {}}))
vi.mock('@aws-sdk/lib-dynamodb',async()=>({...await vi.importActual<object>('@aws-sdk/lib-dynamodb'),DynamoDBDocumentClient:{from:()=>({send:mocks.db})}}))
vi.mock('@aws-sdk/client-s3',async()=>({...await vi.importActual<object>('@aws-sdk/client-s3'),S3Client:class {send=mocks.s3}}))
vi.mock('../server/services/studySpeechCache',()=>({deleteStudySpeech:mocks.speech}))
vi.mock('../server/services/airsContext',()=>({commitMockAirsArtifact:vi.fn(),deleteAirsConversationMemory:mocks.context}))
import {deleteStudyConversation} from '../server/services/studyRepository'
const owner='fixture-owner',id='fixture-study',pk='STUDY#'+id
let records:Map<string,any>,events:string[],objectFailure:boolean
beforeEach(()=>{
 vi.clearAllMocks();vi.stubGlobal('useRuntimeConfig',()=>({flowstAuthMode:'real',dynamoTable:'records',curriculumBucket:'sources',awsRegion:'us-east-1'}))
 records=new Map([['META',{pk,sk:'META',ownerId:owner,objectKey:'fixture-document'}],['TURN#1',{pk,sk:'TURN#1'}]])
 events=[];objectFailure=false
 mocks.speech.mockResolvedValue(undefined);mocks.context.mockResolvedValue(undefined)
 mocks.db.mockImplementation(async command=>{
  const input=command.input
  if(command.constructor.name==='GetCommand')return{Item:records.get('META')}
  if(command.constructor.name==='QueryCommand')return{Items:[...records.values()]}
  if(command.constructor.name==='DeleteCommand'){events.push('delete:'+input.Key.sk);records.delete(input.Key.sk);return{}}
  throw Error('Unexpected fixture command')
 })
 mocks.s3.mockImplementation(async()=>{events.push('delete:object');if(objectFailure)throw Object.assign(Error('Fixture access denial'),{name:'AccessDenied'});return{}})
})
afterAll(()=>vi.unstubAllGlobals())
it('removes ownership metadata only after owned speech, context, records and source cleanup',async()=>{
 await deleteStudyConversation(owner,id)
 expect(mocks.speech).toHaveBeenCalledWith(owner,id,undefined)
 expect(mocks.context).toHaveBeenCalledWith(owner,id,undefined)
 expect(events).toEqual(['delete:TURN#1','delete:object','delete:META'])
 expect(records.size).toBe(0)
 expect(mocks.db.mock.calls.at(-1)![0].input).toMatchObject({ConditionExpression:'ownerId = :owner',ExpressionAttributeValues:{':owner':owner}})
})
it('retains the owned entry after object cleanup fails and lets a retry finish remaining cleanup',async()=>{
 objectFailure=true
 await expect(deleteStudyConversation(owner,id)).rejects.toMatchObject({name:'AccessDenied'})
 expect(records.has('META')).toBe(true);expect(events).not.toContain('delete:META')
 objectFailure=false;await deleteStudyConversation(owner,id)
 expect(records.size).toBe(0);expect(events.at(-1)).toBe('delete:META')
})
it('keeps the source retriable when context cleanup fails',async()=>{
 mocks.context.mockRejectedValueOnce(Error('Fixture context failure'))
 await expect(deleteStudyConversation(owner,id)).rejects.toThrow('Fixture context failure')
 expect(records.size).toBe(2);expect(mocks.s3).not.toHaveBeenCalled()
 await deleteStudyConversation(owner,id);expect(records.size).toBe(0)
})
it('rejects another owner before touching material or session memory',async()=>{
 await expect(deleteStudyConversation('other-owner',id)).rejects.toMatchObject({statusCode:404})
 expect(mocks.context).not.toHaveBeenCalled();expect(mocks.speech).not.toHaveBeenCalled();expect(mocks.s3).not.toHaveBeenCalled()
 expect(records.size).toBe(2)
})
