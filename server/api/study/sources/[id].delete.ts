import { requireIdentity } from '../../../utils/auth'
import { cancelStudySource } from '../../../services/studySources'
export default defineEventHandler(async event => {
  const identity = await requireIdentity(event)
  return cancelStudySource(identity.userId, getRouterParam(event, 'id') || '', event)
})
