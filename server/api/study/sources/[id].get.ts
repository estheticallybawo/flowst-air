import { requireIdentity } from '../../../utils/auth'
import { ownedDraft } from '../../../services/sources/store'
export default defineEventHandler(async event => {
  const identity = await requireIdentity(event)
  setHeader(event, 'Cache-Control', 'no-store')
  return (await ownedDraft(identity.userId, getRouterParam(event, 'id') || '', event)).draft
})
