import { requireIdentity } from '../../utils/auth'
import { getAirsContext, relevantAirsMemory } from '../../services/airsContext'
export default defineEventHandler(async event=>{const identity=await requireIdentity(event);return {context:await getAirsContext(identity.userId,event),memory:await relevantAirsMemory(identity.userId,event)}})
