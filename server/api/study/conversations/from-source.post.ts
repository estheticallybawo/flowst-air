import { requireIdentity } from '../../../utils/auth'
import { sourceJsonBody } from '../../../utils/sourceBody'
import { conversationFromSource } from '../../../services/studySources'
export default defineEventHandler(async event => {
  const identity = await requireIdentity(event)
  const body = await sourceJsonBody(event, 10_000)
  if (typeof body?.sourceId !== 'string' || !/^[\da-f-]{36}$/.test(body.sourceId) || body.confirmSource !== true) throw createError({ statusCode: 400, statusMessage: 'Confirm the reviewed source before creating your plan.' })
  return conversationFromSource(identity.userId, body.sourceId, body.preferences, event)
})
