import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  RevokeTokenCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const settings = (event?: Parameters<typeof useRuntimeConfig>[0]) => {
  const config = useRuntimeConfig(event)
  const clientId = String(config.cognitoClientId || '')
  if (!clientId) throw createError({ statusCode: 503, statusMessage: 'Cognito is not configured yet.' })
  return { clientId, client: new CognitoIdentityProviderClient({ region: String(config.awsRegion || 'us-east-1') }) }
}

export async function registerWithCognito(email: string, password: string, event?: Parameters<typeof useRuntimeConfig>[0]) {
  const { client, clientId } = settings(event)
  await client.send(new SignUpCommand({ ClientId: clientId, Username: email, Password: password, UserAttributes: [{ Name: 'email', Value: email }] }))
}

export async function verifyWithCognito(email: string, code: string, event?: Parameters<typeof useRuntimeConfig>[0]) {
  const { client, clientId } = settings(event)
  await client.send(new ConfirmSignUpCommand({ ClientId: clientId, Username: email, ConfirmationCode: code }))
}

export async function signInWithCognito(email: string, password: string, event?: Parameters<typeof useRuntimeConfig>[0]) {
  const { client, clientId } = settings(event)
  const result = await client.send(new InitiateAuthCommand({
    ClientId: clientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: email, PASSWORD: password },
  }))
  if (!result.AuthenticationResult?.AccessToken || !result.AuthenticationResult.RefreshToken) {
    throw createError({ statusCode: 401, statusMessage: 'Cognito did not return a complete session.' })
  }
  return result.AuthenticationResult
}

export async function refreshCognito(refreshToken: string, event?: Parameters<typeof useRuntimeConfig>[0]) {
  const { client, clientId } = settings(event)
  const result = await client.send(new InitiateAuthCommand({ ClientId: clientId, AuthFlow: 'REFRESH_TOKEN_AUTH', AuthParameters: { REFRESH_TOKEN: refreshToken } }))
  if (!result.AuthenticationResult?.AccessToken) throw createError({ statusCode: 401, statusMessage: 'Your session has expired.' })
  return result.AuthenticationResult
}

export async function beginCognitoRecovery(email: string, event?: Parameters<typeof useRuntimeConfig>[0]) {
  const { client, clientId } = settings(event)
  await client.send(new ForgotPasswordCommand({ ClientId: clientId, Username: email }))
}

export async function confirmCognitoRecovery(email: string, code: string, password: string, event?: Parameters<typeof useRuntimeConfig>[0]) {
  const { client, clientId } = settings(event)
  await client.send(new ConfirmForgotPasswordCommand({ ClientId: clientId, Username: email, ConfirmationCode: code, Password: password }))
}

export async function revokeCognito(refreshToken: string, event?: Parameters<typeof useRuntimeConfig>[0]) {
  const { client, clientId } = settings(event)
  await client.send(new RevokeTokenCommand({ ClientId: clientId, Token: refreshToken }))
}
