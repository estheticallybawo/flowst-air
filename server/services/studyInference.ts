import { createError } from 'h3'
import type { H3Event } from 'h3'
import { airsProviderFailureReason, classifyAirsProviderFailure } from './airsProviderFailure'

/** Study inference is independent of AWS persistence. Never fall back across paid providers. */
export async function groqStudyText(system: string, messages: { role: 'user' | 'assistant'; content: string }[], maxTokens: number, event?: H3Event) {
  const config = useRuntimeConfig(event)
  if (!config.groqApiKey) throw createError({ statusCode: 503, statusMessage: 'Amina’s model connection is not configured.' })
  let response: Response
  try { response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${config.groqApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.groqModel, messages: [{ role: 'system', content: system }, ...messages], max_completion_tokens: maxTokens, temperature: 0.3, stream: false, ...(String(config.groqModel).includes('gpt-oss') ? { reasoning_effort: 'low' } : {}) }),
    signal: AbortSignal.timeout(45_000),
  }) } catch {
    throw createError({ statusCode: 503, statusMessage: 'The learning service could not connect. Your source is still available; try again shortly.', data: { code: 'AGENT_CONNECTION_FAILED' } })
  }
  if (!response.ok) {
    const failure = classifyAirsProviderFailure({ providerStatus: response.status, providerReason: await airsProviderFailureReason(response), retryAfter: response.headers.get('retry-after') })
    console.error('Study text provider rejected a request', failure.data)
    throw createError(failure)
  }
  const data = await response.json() as { choices?: { finish_reason?: string; message?: { content?: string } }[] }
  if (data.choices?.[0]?.finish_reason === 'length') throw createError({ statusCode: 502, statusMessage: 'The learning service could not finish this response. Your saved material remains available.', data: { code: 'AGENT_OUTPUT_INCOMPLETE' } })
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw createError({ statusCode: 502, statusMessage: 'Amina could not prepare a reply. Please retry.' })
  return text
}
