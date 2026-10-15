import { requireIdentity } from '../../utils/auth'
import { sourceJsonBody } from '../../utils/sourceBody'
import { saveAgentPresentation } from '../../services/agentPresentation'

export default defineEventHandler(async event => {
  const identity = await requireIdentity(event)
  const body = await sourceJsonBody(event, 4000)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return saveAgentPresentation(identity.userId, body, event)
})
