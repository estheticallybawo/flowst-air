import { requireIdentity } from '../../../../utils/auth'
import { chooseNextPractice } from '../../../../services/airsKai'
import { sourceJsonBody } from '../../../../utils/sourceBody'
export default defineEventHandler(async event=>{const identity=await requireIdentity(event);const body=await sourceJsonBody(event,1000);if(typeof body.reviewId!=='string'|| !['ACCEPTED','DISMISSED'].includes(body.status))throw createError({statusCode:400,statusMessage:'Choose whether to save this exercise.'});return chooseNextPractice(identity.userId,getRouterParam(event,'id')!,body.reviewId,body.status,event)})
