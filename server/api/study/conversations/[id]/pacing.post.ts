import {z} from 'zod'
import {requireIdentity} from '../../../../utils/auth'
import {sourceJsonBody} from '../../../../utils/sourceBody'
import {changeStudyPacing} from '../../../../services/studyPacing'
export default defineEventHandler(async event=>{const owner=(await requireIdentity(event)).userId;const input=z.object({action:z.enum(['START','BREAK','RESUME','PAUSE','RECORD']),revision:z.string().max(100),recordingId:z.string().uuid().optional()}).strict().parse(await sourceJsonBody(event,1000));return {pacing:await changeStudyPacing(owner,getRouterParam(event,'id') || '',input.action,input.revision,event,input.recordingId)}})
