import { z } from 'zod'
import { registerWithCognito } from '../../services/cognito'
import { authFailure } from '../../utils/authSession'

const schema = z.object({ email: z.email().transform(value => value.trim().toLowerCase()), password: z.string().min(10).max(128) })

export default defineEventHandler(async event => {
  const input = schema.parse(await readBody(event))
  const config = useRuntimeConfig(event)
  if (config.flowstAuthMode === 'mock' && process.env.NODE_ENV !== 'production') return { verificationRequired: true, email: input.email, devCode: '123456' }
  try {
    await registerWithCognito(input.email, input.password, event)
    return { verificationRequired: true, email: input.email }
  } catch (cause) {
    throw authFailure(cause, 'Flowst could not create the account. Please try again.')
  }
})
