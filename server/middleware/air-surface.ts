import { isAirStandalone, isAirStandaloneApi } from '~/shared/airSurface'

export default defineEventHandler(event => {
  if (!isAirStandalone(useRuntimeConfig(event).public.appSurface)) return
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return
  if (isAirStandaloneApi(path)) return
  if (path === '/api/auth/dev-session' && process.env.NODE_ENV !== 'production') return
  throw createError({ statusCode: 404, message: 'This API is not available in Flowst Air.' })
})
