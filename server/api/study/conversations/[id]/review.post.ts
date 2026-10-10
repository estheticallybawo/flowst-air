import { requireIdentity } from '../../../../utils/auth'
import { createKaiReview } from '../../../../services/airsKai'
import { z } from 'zod'
const requestSchema = z.object({refresh:z.boolean().optional(),reviewId:z.string().uuid().optional()}).strict().refine(value=>!value.refresh || !!value.reviewId)
export default defineEventHandler(async event=>{
  const identity=await requireIdentity(event)
  const parsed=requestSchema.safeParse((await readBody(event)) || {})
  if(!parsed.success) throw createError({statusCode:400,statusMessage:'Reopen the earlier review before requesting a feedback refresh.'})
  return createKaiReview(identity.userId,getRouterParam(event,'id')!,event,parsed.data)
})
