import { requireIdentity } from '../../../../utils/auth'
import { sourceJsonBody } from '../../../../utils/sourceBody'
import { prepareStudySource } from '../../../../services/studySources'
export default defineEventHandler(async event => {
  const identity = await requireIdentity(event)
  return prepareStudySource(identity.userId, getRouterParam(event, 'id') || '', await sourceJsonBody(event, 10_000), event)
})
