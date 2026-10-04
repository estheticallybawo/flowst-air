import {z} from 'zod'
import {requireIdentity} from '../../../../utils/auth'
import {getStudyConversation} from '../../../../services/studyRepository'
import {readAirsArtifact} from '../../../../services/airsContext'
export default defineEventHandler(async event=>{const owner=(await requireIdentity(event)).userId,id=getRouterParam(event,'id') || '';await getStudyConversation(owner,id,event);const recordingId=z.string().uuid().parse(getQuery(event).recordingId);setHeader(event,'Cache-Control','private, no-store');return {progress:await readAirsArtifact(owner,'VOICE_TURN#'+id+'#'+recordingId,event) || null}})
