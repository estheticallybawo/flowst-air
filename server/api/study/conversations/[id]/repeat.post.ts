import { requireIdentity } from '../../../../utils/auth'
import { sourceJsonBody } from '../../../../utils/sourceBody'
import { repeatStudySession } from '../../../../services/studyRepeat'

export default defineEventHandler(async event => {
  const ownerId = (await requireIdentity(event)).userId
  const session = await repeatStudySession(ownerId, getRouterParam(event, 'id') || '', await sourceJsonBody(event, 1000), event)
  setResponseStatus(event, 201)
  return session
})
