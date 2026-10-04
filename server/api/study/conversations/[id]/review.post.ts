import { requireIdentity } from '../../../../utils/auth'
import { createKaiReview } from '../../../../services/airsKai'
export default defineEventHandler(async event=>{const identity=await requireIdentity(event);return createKaiReview(identity.userId,getRouterParam(event,'id')!,event)})
