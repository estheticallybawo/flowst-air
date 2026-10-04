import { accountError, AccountLoadError } from '~/shared/userErrors'
import type { AuthSessionResponse, MeSnapshot, SchoolCapability } from '~/shared/auth'

type AuthStatus = 'UNKNOWN' | 'LOADING' | 'AUTHENTICATED' | 'ANONYMOUS'
type RequestOptions = Parameters<typeof $fetch>[1]
type LegacyMeSnapshot = Omit<MeSnapshot, 'platformPermissions' | 'community'> & Partial<Pick<MeSnapshot, 'platformPermissions' | 'community'>>

const responseStatus = (cause: any) => Number(cause?.statusCode || cause?.status || cause?.response?.status || 0)

export function normalizeMeSnapshot(snapshot: LegacyMeSnapshot | null | undefined): MeSnapshot | null {
  if (!snapshot) return null
  const platformPermissions = Array.isArray(snapshot.platformPermissions) ? snapshot.platformPermissions : []
  const complete = Boolean(snapshot.profile?.complete)
  const canPublish = snapshot.community?.canPublish === true
  return {
    ...snapshot,
    schools: Array.isArray(snapshot.schools) ? snapshot.schools : [],
    cohorts: Array.isArray(snapshot.cohorts) ? snapshot.cohorts : [],
    platformPermissions,
    community: {
      canView: snapshot.community?.canView ?? complete,
      canInteract: snapshot.community?.canInteract ?? complete,
      canPublish,
      canModerate: snapshot.community?.canModerate ?? platformPermissions.includes('COMMUNITY_MODERATOR'),
      publishReason: snapshot.community?.publishReason ?? (complete && !canPublish
        ? 'Sharing is available to eligible learner accounts with a shareable Flowst artifact.'
        : undefined),
    },
  }
}

export function useAuth() {
  const config = useRuntimeConfig()
  const status = useState<AuthStatus>('auth-status', () => 'UNKNOWN')
  const accessToken = useState<string>('auth-access-token', () => '')
  const me = useState<MeSnapshot | null>('auth-me', () => null)
  const error = useState<string>('auth-error', () => '')
  const sessionPromise = useState<Promise<AuthStatus> | null>('auth-session-promise', () => null)
  const sessionEpoch = useState<number>('auth-session-epoch', () => 0)
  const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  // Nuxt preserves useState values across client navigation and hot updates. Upgrade
  // authenticated snapshots created before new capability fields were introduced.
  if (me.value && (!me.value.community || !Array.isArray(me.value.platformPermissions)
    || !Array.isArray(me.value.schools) || !Array.isArray(me.value.cohorts))) {
    me.value = normalizeMeSnapshot(me.value)
  }

  const apiBase = ['air', 'amira'].includes(config.public.appSurface) ? '/api' : String(config.public.apiBaseUrl || '/api')
  const apiUrl = (path: string) => `${apiBase.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  const authHeaders = computed<Record<string, string>>(() => {
    const headers: Record<string, string> = {}
    if (accessToken.value) headers.Authorization = `Bearer ${accessToken.value}`
    return headers
  })
  const schoolAdministrations = computed(() => me.value?.schools.filter(item => item.status === 'APPROVED' && item.permission === 'ADMIN') || [])

  async function loadMe() {
    if (!accessToken.value) return null
    const token = accessToken.value
    const snapshot = await $fetch<MeSnapshot>(apiUrl('/me'), { headers: authHeaders.value })
    if (accessToken.value !== token) return null
    me.value = normalizeMeSnapshot(snapshot)
    return me.value
  }

  async function ensureSession(force = false): Promise<AuthStatus> {
    if (!force && status.value !== 'UNKNOWN') return status.value
    if (!force && sessionPromise.value) return sessionPromise.value
    const epoch = sessionEpoch.value
    const promise = (async () => {
      status.value = 'LOADING'
      error.value = ''
      try {
        const session = await $fetch<AuthSessionResponse>('/api/auth/session', { headers: requestHeaders })
        if (epoch !== sessionEpoch.value) return status.value
        if (!session.authenticated || !session.accessToken) {
          accessToken.value = ''
          me.value = null
          status.value = 'ANONYMOUS'
          return status.value
        }
        accessToken.value = session.accessToken
        me.value = session.me ? normalizeMeSnapshot(session.me) : await loadMe()
        status.value = 'AUTHENTICATED'
        return status.value
      } catch (cause) {
        if (epoch !== sessionEpoch.value) return status.value
        accessToken.value = ''
        me.value = null
        status.value = 'ANONYMOUS'
        error.value = accountError(cause, 'session')
        return status.value
      } finally {
        if (epoch === sessionEpoch.value) sessionPromise.value = null
      }
    })()
    sessionPromise.value = promise
    return promise
  }

  async function signIn(email: string, password: string) {
    error.value = ''
    const epoch = ++sessionEpoch.value
    const session = await $fetch<AuthSessionResponse>('/api/auth/sign-in', { method: 'POST', body: { email, password } })
    if (epoch !== sessionEpoch.value) return null
    accessToken.value = session.accessToken || ''
    try { await loadMe() } catch (cause) { throw new AccountLoadError(cause) }
    if (epoch !== sessionEpoch.value) return null
    status.value = 'AUTHENTICATED'
    return me.value
  }

  async function signOut(destination = '/auth/sign-in') {
    error.value = ''
    await $fetch('/api/auth/sign-out', { method: 'POST' })
    sessionEpoch.value++
    status.value = 'ANONYMOUS'
    accessToken.value = ''
    me.value = null
    sessionPromise.value = null
    await navigateTo(destination)
  }

  async function schoolCapability(schoolId: string) {
    if (!accessToken.value) throw new Error('Sign in to continue.')
    return authorizedFetch<SchoolCapability>(apiUrl(`/schools/${encodeURIComponent(schoolId)}/capability`))
  }

  async function authorizedFetch<T>(url: string, options: RequestOptions = {}) {
    const execute = () => {
      const supplied = new Headers(options.headers)
      for (const [name, value] of Object.entries(authHeaders.value)) supplied.set(name, value)
      return $fetch<T>(url, { ...options, headers: supplied })
    }

    try {
      return await execute()
    } catch (cause) {
      if (responseStatus(cause) !== 401) throw cause

      const refreshed = await ensureSession(true)
      if (refreshed === 'AUTHENTICATED') return execute()

      if (import.meta.client) {
        const route = useRoute()
        const redirect = route.fullPath.startsWith('/auth/')
          ? (['air', 'amira'].includes(config.public.appSurface) ? '/airs' : '/home')
          : route.fullPath
        await navigateTo({ path: '/auth/sign-in', query: { redirect, reason: 'session-expired' } })
      }
      throw cause
    }
  }

  return { status, accessToken, me, error, authHeaders, schoolAdministrations, ensureSession, loadMe, signIn, signOut, schoolCapability, authorizedFetch }
}
