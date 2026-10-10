import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authenticateRequest } from '../utils/auth'
import { getMe } from './authRepository'
import { createError } from 'h3'
import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import type { H3Event } from 'h3'
import { studyStorageResources, getStudyConversation } from './studyRepository'
import { contextDescription, learnerContextSchema, type ContextSnapshot, type KaiReview } from '../../shared/airsOrchestration'
const local = new Map<string, unknown>()
/** Used by the mock repository's synchronous transaction, after owner/revision validation. */
export function commitMockAirsArtifact(ownerId: string, key: string, value: unknown, expectedRevision: string) {
  const pk = 'AIRS_CONTEXT#' + ownerId
  const old = local.get(pk + key) as {revision?: string} | undefined
  if ((old?.revision || '') !== expectedRevision) throw createError({statusCode:409,statusMessage:'Your practice timer changed. Reload before continuing.'})
  local.set(pk + key, structuredClone(value))
}
export async function readAirsArtifact<T>(ownerId: string, key: string, event?: H3Event): Promise<T | undefined> {
  const storage = studyStorageResources(event)
  const pk = 'AIRS_CONTEXT#' + ownerId
  if (storage.mock) return structuredClone(local.get(pk + key)) as T | undefined
  return (await storage.db.send(new GetCommand({TableName: storage.table, Key: {pk, sk:key}, ConsistentRead:true}))).Item?.value as T | undefined
}
export async function writeAirsArtifact(ownerId: string, key: string, value: unknown, event?: H3Event, expectedRevision?: string, expectedOperation?: string) {
  const storage = studyStorageResources(event)
  const pk = 'AIRS_CONTEXT#' + ownerId
  if (JSON.stringify(value).length > 40000) throw createError({statusCode:413,statusMessage:'This learning record is too large.'})
  if (storage.mock) {
    const old = local.get(pk + key) as ContextSnapshot | undefined
    if (expectedRevision !== undefined && (old?.revision || '') !== expectedRevision || expectedOperation !== undefined && (old?.operation?.id || '') !== expectedOperation) throw createError({statusCode:409,statusMessage:'Your context changed. Reload before continuing.'})
    local.set(pk + key, structuredClone(value))
  } else {
    const conditions: string[] = [], names: Record<string,string> = {}, values: Record<string,unknown> = {}
    if (expectedRevision !== undefined) { names['#v']='value'; names['#r']='revision'; values[':r']=expectedRevision; conditions.push(expectedRevision ? '#v.#r = :r' : '(attribute_not_exists(#v.#r) OR #v.#r = :r)') }
    if (expectedOperation !== undefined) { names['#v']='value'; names['#o']='operation'; names['#i']='id'; values[':o']=expectedOperation; conditions.push(expectedOperation ? '#v.#o.#i = :o' : '(attribute_not_exists(#v.#o.#i) OR #v.#o.#i = :o)') }
    try { await storage.db.send(new PutCommand({TableName:storage.table,Item:{pk,sk:key,value,entityType:'AirsContext',expiresAt:ownerId.startsWith('guest-') ? Math.floor(Date.now()/1000)+86400 : undefined},...(conditions.length ? {ConditionExpression:conditions.join(' AND '),ExpressionAttributeNames:names,ExpressionAttributeValues:values} : {})})) }
    catch(error){if((error as Error).name==='ConditionalCheckFailedException')throw createError({statusCode:409,statusMessage:'Your context changed. Reload before continuing.'});throw error}
  }
}
export async function getAirsContext(ownerId: string, event?: H3Event) {
  const context:ContextSnapshot=await readAirsArtifact<ContextSnapshot>(ownerId,'PROFILE',event) || {background:'',goals:'',audience:'',origin:'LEARNER_CONFIRMED' as const,recordedAt:''}
  if(event){const identity=await authenticateRequest(event);if(identity?.userId===ownerId){const account=await getMe(identity,event);return {...context,accountContext:{displayName:account.profile.displayName || '',origin:'FLOWST_PROFILE'}}}}
  return context
}
export async function saveAirsContext(ownerId: string, input: unknown, event?: H3Event) {
  const current = await getAirsContext(ownerId,event)
  const confirmation = z.object({revision:z.string().max(100),summary:z.string().trim().min(1).max(700),confirmSummary:z.literal(true)}).strict().safeParse(input)
  if (confirmation.success) {
    if(confirmation.data.revision !== (current.revision || '') || current.summaryStatus==='PROCESSING') throw createError({statusCode:409,statusMessage:'Your context changed or is still being prepared. Reload it.'})
    const confirmed: ContextSnapshot = {...current,summary:confirmation.data.summary,summaryStatus:'CONFIRMED',summaryConfirmedAt:new Date().toISOString()}
    await writeAirsArtifact(ownerId,'PROFILE',confirmed,event,confirmation.data.revision);return confirmed
  }
  const modern = z.object({selfDescription:z.string().min(1).max(2000).refine(value=>Boolean(value.trim())),revision:z.string().max(100)}).strict().safeParse(input)
  const legacy = learnerContextSchema.safeParse(input)
  if (!modern.success && !legacy.success) throw createError({statusCode:400,statusMessage:'Share up to 2,000 characters about yourself.'})
  const expected = modern.success ? modern.data.revision : current.revision || ''
  const fields = modern.success ? {background:'',goals:'',audience:'',selfDescription:modern.data.selfDescription} : legacy.data!
  const context: ContextSnapshot = {...fields,origin:'LEARNER_CONFIRMED',recordedAt:new Date().toISOString(),revision:randomUUID(),summaryStatus:'NONE'}
  await writeAirsArtifact(ownerId,'PROFILE',context,event,expected);return context
}
export async function relevantAirsMemory(ownerId: string, event?: H3Event) {
  const review=await readAirsArtifact<KaiReview>(ownerId,'LATEST_REVIEW',event)
  if(review){try{await getStudyConversation(ownerId,review.conversationId,event)}catch(error){if((error as any).statusCode===404)return null;throw error}}
  return review ? {reviewId:review.id,conversationId:review.conversationId,observations:review.observations,nextPractice:review.nextPractice,nextPracticeStatus:review.nextPracticeStatus,createdAt:review.createdAt} : null
}

export async function deleteAirsConversationMemory(ownerId:string,id:string,event?:H3Event) {
 const storage=studyStorageResources(event),pk='AIRS_CONTEXT#'+ownerId,prefix='REVIEW#'+id+'#'
 const latest=await readAirsArtifact<KaiReview>(ownerId,'LATEST_REVIEW',event)
 if(storage.mock) {
  for(const key of local.keys()) if(key.startsWith(pk+prefix) || key.startsWith(pk+'VOICE_TURN#'+id+'#')) local.delete(key)
  local.delete(pk+'PLAN_OPERATION#'+id)
  local.delete(pk+'PACING#'+id)
  if(latest?.conversationId===id) local.delete(pk+'LATEST_REVIEW')
 } else {
  let cursor:Record<string,unknown>|undefined
  do {
   const result=await storage.db.send(new QueryCommand({TableName:storage.table,KeyConditionExpression:'pk = :pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':pk,':prefix':prefix},ExclusiveStartKey:cursor,ConsistentRead:true}))
   for(const item of result.Items || []) await storage.db.send(new DeleteCommand({TableName:storage.table,Key:{pk,sk:item.sk}}))
   cursor=result.LastEvaluatedKey
  } while(cursor)
  await storage.db.send(new DeleteCommand({TableName:storage.table,Key:{pk,sk:'PLAN_OPERATION#'+id}}))
  await storage.db.send(new DeleteCommand({TableName:storage.table,Key:{pk,sk:'PACING#'+id}}))
  let voiceCursor:Record<string,unknown>|undefined
  do {const records=await storage.db.send(new QueryCommand({TableName:storage.table,KeyConditionExpression:'pk = :pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':pk,':prefix':'VOICE_TURN#'+id+'#'},ExclusiveStartKey:voiceCursor,ConsistentRead:true}));for(const item of records.Items || [])await storage.db.send(new DeleteCommand({TableName:storage.table,Key:{pk,sk:item.sk}}));voiceCursor=records.LastEvaluatedKey}while(voiceCursor)

  if(latest?.conversationId===id) await storage.db.send(new DeleteCommand({TableName:storage.table,Key:{pk,sk:'LATEST_REVIEW'},ConditionExpression:'#v.conversationId = :id',ExpressionAttributeNames:{'#v':'value'},ExpressionAttributeValues:{':id':id}}))
 }
}

export async function claimAirsReview(ownerId:string,key:string,event?:H3Event) {
 const storage=studyStorageResources(event),pk='AIRS_CONTEXT#'+ownerId,sk='LOCK#'+key,now=Math.floor(Date.now()/1000)
 if(storage.mock){const old=local.get(pk+sk) as number|undefined;if(old && old>now)throw createError({statusCode:409,statusMessage:'Kai is already reviewing this attempt.'});local.set(pk+sk,now+120)}
 else try{await storage.db.send(new PutCommand({TableName:storage.table,Item:{pk,sk,expiresAt:now+120},ConditionExpression:'attribute_not_exists(pk) OR expiresAt < :now',ExpressionAttributeValues:{':now':now}}))}catch(error){if((error as Error).name==='ConditionalCheckFailedException')throw createError({statusCode:409,statusMessage:'Kai is already reviewing this attempt.'});throw error}
 return async()=>{if(storage.mock)local.delete(pk+sk);else await storage.db.send(new DeleteCommand({TableName:storage.table,Key:{pk,sk}}))}
}

/** Model allowance survives guest-cookie resets; voice has no daily quota. */
export async function reserveGuestAllowance(ownerId:string,kind:'MODEL'|'VOICE',event?:H3Event){
 if(kind==='VOICE' || !ownerId.startsWith('guest-') || process.env.NODE_ENV!=='production') return
 const config=useRuntimeConfig(event),storage=studyStorageResources(event)
 const configured=Number(config.airsGuestDailyModelLimit)
 const limit=Number.isInteger(configured) && configured>=0 ? Math.min(configured,100) : 30
 const pk='AIRS_GUEST_USAGE#'+new Date().toISOString().slice(0,10),sk=kind
 for(let attempt=0;attempt<3;attempt++){
  const current=(await storage.db.send(new GetCommand({TableName:storage.table,Key:{pk,sk},ConsistentRead:true}))).Item
  const count=Number(current?.count || 0)
  if(count>=limit)throw createError({statusCode:429,statusMessage:'The public demo has reached its daily allowance. Your saved material remains available.'})
  try{await storage.db.send(new PutCommand({TableName:storage.table,Item:{pk,sk,count:count+1,expiresAt:Math.floor(Date.now()/1000)+172800},ConditionExpression:current ? '#count = :old' : 'attribute_not_exists(pk)',...(current?{ExpressionAttributeNames:{'#count':'count'},ExpressionAttributeValues:{':old':count}}:{})}));return}catch(error){if((error as Error).name!=='ConditionalCheckFailedException')throw error}
 }
 throw createError({statusCode:409,statusMessage:'The demo allowance is busy. Try again.'})
}
