import { z } from 'zod'
import { setRefreshCookie } from '../../utils/authSession'

const schema = z.object({ scenario: z.enum(['admin', 'educator', 'member', 'supporter', 'moderator', 'pending', 'wrong-school', 'revoked', 'profile-incomplete']) })

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  if (config.flowstAuthMode !== 'mock' || process.env.NODE_ENV === 'production') throw createError({ statusCode: 404 })
  const { scenario } = schema.parse(await readBody(event))
  const token = `mock:${scenario}`
  setRefreshCookie(event, token)
  return { authenticated: true, accessToken: token, expiresIn: 3600 }
})
