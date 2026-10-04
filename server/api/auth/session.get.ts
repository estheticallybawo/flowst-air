import { getMe } from '../../services/authRepository'
import { refreshCognito } from '../../services/cognito'
import { authFailure, clearRefreshCookie, getRefreshCookie } from '../../utils/authSession'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const refreshToken = getRefreshCookie(event)
  if (!refreshToken) return { authenticated: false }

  try {
    if (config.flowstAuthMode === 'mock' && process.env.NODE_ENV !== 'production') {
      const scenario = refreshToken.startsWith('mock:') ? refreshToken.slice(5) : ''
      if (!scenario) return { authenticated: false }
      const identity = { userId: `mock-${scenario}`, email: `${scenario}@flowst.local`, scenario }
      return { authenticated: true, accessToken: refreshToken, expiresIn: 3600, me: await getMe(identity, event) }
    }
    const session = await refreshCognito(refreshToken, event)
    return { authenticated: true, accessToken: session.AccessToken, expiresIn: session.ExpiresIn || 3600 }
  } catch (cause) {
    clearRefreshCookie(event)
    throw authFailure(cause, 'Your session could not be restored. Please sign in again.')
  }
})
