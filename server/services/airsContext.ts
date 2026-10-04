import { createError } from 'h3'
import { GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import type { H3Event } from 'h3'
import { studyStorageResources, getStudyConversation } from './studyRepository'
import { learnerContextSchema, type ContextSnapshot, type KaiReview } from '../../shared/airsOrchestration'
const local = new Map<string, unknown>()
export async function readAirsArtifact<T>(ownerId: string, key: string, event?: H3Event): Promise<T | undefined> {
  const storage = studyStorageResources(event)
  const pk = 'AIRS_CONTEXT#' + ownerId
  if (storage.mock) return structuredClone(local.get(pk + key)) as T | undefined
  return (await storage.db.send(new GetCommand({TableName: storage.table, Key: {pk, sk:key}, ConsistentRead:true}))).Item?.value as T | undefined
}
export async function writeAirsArtifact(ownerId: string, key: string, value: unknown, event?: H3Event) {
  const storage = studyStorageResources(event)
  const pk = 'AIRS_CONTEXT#' + ownerId
  if (JSON.stringify(value).length > 40000) throw createError({statusCode:413,statusMessage:'This learning record is too large.'})
  if (storage.mock) local.set(pk + key, structuredClone(value))
  else await storage.db.send(new PutCommand({TableName:storage.table,Item:{pk,sk:key,value,entityType:'AirsContext',expiresAt:ownerId.startsWith('guest-') ? Math.floor(Date.now()/1000)+86400 : undefined}}))
}
export async function getAirsContext(ownerId: string, event?: H3Event) {
  return await readAirsArtifact<ContextSnapshot>(ownerId,'PROFILE',event) || {background:'',goals:'',audience:'',origin:'LEARNER_CONFIRMED' as const,recordedAt:''}
}
export async function saveAirsContext(ownerId: string, input: unknown, event?: H3Event) {
  const parsed=learnerContextSchema.safeParse(input)
  if (!parsed.success) throw createError({statusCode:400,statusMessage:'Use the three bounded context fields.'})
  const context={...parsed.data,origin:'LEARNER_CONFIRMED' as const,recordedAt:new Date().toISOString()}
  await writeAirsArtifact(ownerId,'PROFILE',context,event); return context
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
  for(const key of local.keys()) if(key.startsWith(pk+prefix)) local.delete(key)
  if(latest?.conversationId===id) local.delete(pk+'LATEST_REVIEW')
 } else {
  let cursor:Record<string,unknown>|undefined
  do {
   const result=await storage.db.send(new QueryCommand({TableName:storage.table,KeyConditionExpression:'pk = :pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':pk,':prefix':prefix},ExclusiveStartKey:cursor,ConsistentRead:true}))
   for(const item of result.Items || []) await storage.db.send(new DeleteCommand({TableName:storage.table,Key:{pk,sk:item.sk}}))
   cursor=result.LastEvaluatedKey
  } while(cursor)
  if(latest?.conversationId===id) await storage.db.send(new DeleteCommand({TableName:storage.table,Key:{pk,sk:'LATEST_REVIEW'},ConditionExpression:'#v.conversationId = :id',ExpressionAttributeNames:{'#v':'value'},ExpressionAttributeValues:{':id':id}}))
 }
}

export async function claimAirsReview(ownerId:string,key:string,event?:H3Event) {
 const storage=studyStorageResources(event),pk='AIRS_CONTEXT#'+ownerId,sk='LOCK#'+key,now=Math.floor(Date.now()/1000)
 if(storage.mock){const old=local.get(pk+sk) as number|undefined;if(old && old>now)throw createError({statusCode:409,statusMessage:'Kai is already reviewing this attempt.'});local.set(pk+sk,now+120)}
 else try{await storage.db.send(new PutCommand({TableName:storage.table,Item:{pk,sk,expiresAt:now+120},ConditionExpression:'attribute_not_exists(pk) OR expiresAt < :now',ExpressionAttributeValues:{':now':now}}))}catch(error){if((error as Error).name==='ConditionalCheckFailedException')throw createError({statusCode:409,statusMessage:'Kai is already reviewing this attempt.'});throw error}
 return async()=>{if(storage.mock)local.delete(pk+sk);else await storage.db.send(new DeleteCommand({TableName:storage.table,Key:{pk,sk}}))}
}

/** Deployment-wide allowance survives guest-cookie resets. Reserve before provider work. */
export async function reserveGuestAllowance(ownerId:string,kind:'MODEL'|'VOICE',event?:H3Event){
 if(!ownerId.startsWith('guest-') || process.env.NODE_ENV!=='production') return
 const config=useRuntimeConfig(event),storage=studyStorageResources(event)
 const configured=Number(kind==='MODEL' ? config.airsGuestDailyModelLimit : config.airsGuestDailyVoiceLimit)
 const limit=Number.isInteger(configured) && configured>=0 ? Math.min(configured,100) : (kind==='MODEL'?30:10)
 const pk='AIRS_GUEST_USAGE#'+new Date().toISOString().slice(0,10),sk=kind
 for(let attempt=0;attempt<3;attempt++){
  const current=(await storage.db.send(new GetCommand({TableName:storage.table,Key:{pk,sk},ConsistentRead:true}))).Item
  const count=Number(current?.count || 0)
  if(count>=limit)throw createError({statusCode:429,statusMessage:'The public demo has reached its daily allowance. Your saved material remains available.'})
  try{await storage.db.send(new PutCommand({TableName:storage.table,Item:{pk,sk,count:count+1,expiresAt:Math.floor(Date.now()/1000)+172800},ConditionExpression:current ? '#count = :old' : 'attribute_not_exists(pk)',...(current?{ExpressionAttributeNames:{'#count':'count'},ExpressionAttributeValues:{':old':count}}:{})}));return}catch(error){if((error as Error).name!=='ConditionalCheckFailedException')throw error}
 }
 throw createError({statusCode:409,statusMessage:'The demo allowance is busy. Try again.'})
}
