import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider'

/** Use short-lived Vercel credentials for the app, or the standard AWS chain locally/on Lambda. */
export function awsClientConfig(region: string) {
  const roleArn = process.env.FLOWST_AWS_ROLE_ARN
  return {
    region,
    ...(roleArn ? { credentials: awsCredentialsProvider({ roleArn, clientConfig: { region } }) } : {}),
  }
}
