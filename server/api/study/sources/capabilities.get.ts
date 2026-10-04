import { requireIdentity } from '../../../utils/auth'
import { sourceFixtureMode } from '../../../services/studySources'
export default defineEventHandler(async event => {
  await requireIdentity(event)
  return { fixtures: sourceFixtureMode(event) }
})
