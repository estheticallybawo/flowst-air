import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { H3Event } from 'h3'
import type { AuthIdentity } from '../../shared/auth'

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

const bearerToken = (event: H3Event) => {
  const header = getHeader(event, 'authorization')
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

const mockIdentity = (token: string): AuthIdentity | null => {
  const match = /^mock:([a-z-]+)$/.exec(token)
  if (!match) return null
  const scenario = match[1]!
  return {
    userId: `mock-${scenario}`,
    email: `${scenario}@flowst.local`,
    scenario,
  }
}

export async function authenticateRequest(event: H3Event): Promise<AuthIdentity | null> {
  return authenticateAccessToken(bearerToken(event), event)
}

/** Also verifies the first authenticated WebSocket message; no token in the URL. */
export async function authenticateAccessToken(token: string, event?: H3Event): Promise<AuthIdentity | null> {
  if (!token) return null
  const config = useRuntimeConfig(event)

  if (config.flowstAuthMode === 'mock' && process.env.NODE_ENV !== 'production') {
    return mockIdentity(token)
  }

  const region = String(config.awsRegion || 'us-east-1')
  const poolId = String(config.cognitoUserPoolId || '')
  const clientId = String(config.cognitoClientId || '')
  if (!poolId || !clientId) return null
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`
  let jwks = jwksByIssuer.get(issuer)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
    jwksByIssuer.set(issuer, jwks)
  }

  try {
    const { payload } = await jwtVerify(token, jwks, { issuer })
    if (payload.token_use !== 'access' || payload.client_id !== clientId || !payload.sub) return null
    return { userId: payload.sub, email: typeof payload.email === 'string' ? payload.email : '' }
  } catch {
    return null
  }
}

export async function requireIdentity(event: H3Event) {
  const identity = await authenticateRequest(event)
  if (!identity) throw createError({ statusCode: 401, statusMessage: 'Sign in to continue.' })
  return identity
}
