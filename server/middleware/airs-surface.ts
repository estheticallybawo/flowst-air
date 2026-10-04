import { isAirsStandalone, isAirsStandaloneApi } from '~/shared/airsSurface'

export default defineEventHandler(event => {
  if (!isAirsStandalone(useRuntimeConfig(event).public.appSurface)) return
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return
  if (isAirsStandaloneApi(path)) return
  if (path === '/api/auth/dev-session' && process.env.NODE_ENV !== 'production') return
  throw createError({ statusCode: 404, message: 'This API is not available in Flowst Airs.' })
})
