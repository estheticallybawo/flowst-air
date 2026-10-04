import { z } from 'zod'
import { beginCognitoRecovery } from '../../services/cognito'
import { authFailure } from '../../utils/authSession'

const schema = z.object({ email: z.email().transform(value => value.trim().toLowerCase()) })

export default defineEventHandler(async event => {
  const { email } = schema.parse(await readBody(event))
  const config = useRuntimeConfig(event)
  if (config.flowstAuthMode === 'mock' && process.env.NODE_ENV !== 'production') return { codeSent: true, devCode: '123456' }
  try {
    await beginCognitoRecovery(email, event)
    return { codeSent: true }
  } catch (cause) {
    throw authFailure(cause, 'Flowst could not start account recovery. Please try again.')
  }
})
