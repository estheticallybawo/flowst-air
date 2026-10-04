import { requireIdentity } from '../../utils/auth'
import { saveAirsContext } from '../../services/airsContext'
import { sourceJsonBody } from '../../utils/sourceBody'
export default defineEventHandler(async event=>{const identity=await requireIdentity(event);return saveAirsContext(identity.userId,await sourceJsonBody(event,16000),event)})
