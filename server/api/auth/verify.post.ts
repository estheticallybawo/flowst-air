import { z } from 'zod'
import { verifyWithCognito } from '../../services/cognito'
import { authFailure } from '../../utils/authSession'

const schema = z.object({ email: z.email().transform(value => value.trim().toLowerCase()), code: z.string().trim().min(6).max(12) })

export default defineEventHandler(async event => {
  const input = schema.parse(await readBody(event))
  const config = useRuntimeConfig(event)
  if (config.flowstAuthMode === 'mock' && process.env.NODE_ENV !== 'production') {
    if (input.code !== '123456') throw createError({ statusCode: 400, statusMessage: 'The verification code is invalid or expired.' })
    return { verified: true }
  }
  try {
    await verifyWithCognito(input.email, input.code, event)
    return { verified: true }
  } catch (cause) {
    throw authFailure(cause, 'Flowst could not verify the account. Please try again.')
  }
})
