import {requireIdentity} from '../../../../utils/auth'
import {getStudyConversation} from '../../../../services/studyRepository'
import {getStudyPacing} from '../../../../services/studyPacing'
export default defineEventHandler(async event=>{const owner=(await requireIdentity(event)).userId,id=getRouterParam(event,'id') || '';await getStudyConversation(owner,id,event);return {pacing:await getStudyPacing(owner,id,event)}})
