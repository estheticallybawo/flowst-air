import { deleteCookie } from 'h3'
import { revokeCognito } from '../../services/cognito'
import { clearRefreshCookie, getRefreshCookie } from '../../utils/authSession'

export default defineEventHandler(async event => {
  deleteCookie(event,'airs_guest',{path:'/'});
  const config = useRuntimeConfig(event)
  const refreshToken = getRefreshCookie(event)
  clearRefreshCookie(event)
  if (refreshToken && config.flowstAuthMode !== 'mock') {
    try { await revokeCognito(refreshToken, event) } catch { /* The local session is already cleared. */ }
  }
  return { signedOut: true }
})
