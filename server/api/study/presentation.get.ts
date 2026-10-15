import { requireIdentity } from '../../utils/auth'
import { getAgentPresentation } from '../../services/agentPresentation'

export default defineEventHandler(async event => {
  const identity = await requireIdentity(event)
  setHeader(event, 'Cache-Control', 'private, no-store')
  return getAgentPresentation(identity.userId, event)
})
