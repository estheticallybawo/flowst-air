import { z } from 'zod'
import { confirmCognitoRecovery } from '../../services/cognito'
import { authFailure } from '../../utils/authSession'

const schema = z.object({ email: z.email().transform(value => value.trim().toLowerCase()), code: z.string().trim().min(6).max(12), password: z.string().min(10).max(128) })

export default defineEventHandler(async event => {
  const input = schema.parse(await readBody(event))
  const config = useRuntimeConfig(event)
  if (config.flowstAuthMode === 'mock' && process.env.NODE_ENV !== 'production') {
    if (input.code !== '123456') throw createError({ statusCode: 400, statusMessage: 'The recovery code is invalid or expired.' })
    return { passwordChanged: true }
  }
  try {
    await confirmCognitoRecovery(input.email, input.code, input.password, event)
    return { passwordChanged: true }
  } catch (cause) {
    throw authFailure(cause, 'Flowst could not change the password. Please try again.')
  }
})
