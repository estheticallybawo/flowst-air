import { airsActionForRequest } from '../../shared/airsAccess'
import { assertAirsStudyAccess } from '../services/airsAccess'
import { assertStudyConversationActive, getStudyConversation } from '../services/studyRepository'
import { requireIdentity } from '../utils/auth'

export default defineEventHandler(async event => {
  // An ended Flowst Airs document stays read-only when reached through either app surface.
  // The account entitlement adapter itself only applies standalone pilot restrictions.
  const path = getRequestURL(event).pathname
  const action = airsActionForRequest(event.method, path)
  const match = /^\/api\/study\/conversations\/([^/]+)\//.exec(path)
  const changesSavedPlan = event.method === 'POST' && /\/(?:mode|plan\/(?:approve|confirm))\/?$/.test(path)
  if (!action && !changesSavedPlan) return
  const identity = await requireIdentity(event)
  if (action) await assertAirsStudyAccess(identity.userId, action, event)
  if (match) assertStudyConversationActive(await getStudyConversation(identity.userId, match[1]!, event))
})
