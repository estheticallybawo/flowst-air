import { createError } from 'h3'
import type { H3Event } from 'h3'
import { airsProviderFailureReason, classifyAirsProviderFailure } from './airsProviderFailure'
import { requestStudyBedrock } from './studyBedrockTransport'

export interface StudyStructuredOutput {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/** Legacy export name retained. Explicit provider selection; never fall back or retry paid dispatch. */
export async function groqStudyText(system: string, messages: { role: 'user' | 'assistant'; content: string }[], maxTokens: number, event?: H3Event, output?: StudyStructuredOutput) {
  const config = useRuntimeConfig(event)
  if (config.studyTextProvider !== 'aws' && !config.groqApiKey) throw createError({ statusCode: 503, statusMessage: 'Amina’s model connection is not configured.' })
  let response: Response
  const structured = output ? { tools: [{ type: 'function', function: output }], tool_choice: { type: 'function', function: { name: output.name } } } : {}
  try { response = config.studyTextProvider === 'aws' ? await requestStudyBedrock({ messages: [{ role: 'system', content: system }, ...messages], max_completion_tokens: maxTokens, temperature: 0.3, ...structured }, event) : await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${config.groqApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.groqModel, messages: [{ role: 'system', content: system }, ...messages], max_completion_tokens: maxTokens, temperature: 0.3, stream: false, ...structured, ...(String(config.groqModel).includes('gpt-oss') ? { reasoning_effort: 'low' } : {}) }),
    signal: AbortSignal.timeout(45_000),
  }) } catch (error) {
    if ((error as { statusCode?: number })?.statusCode) throw error
    throw createError({ statusCode: 503, statusMessage: 'The learning service could not connect. Your source is still available; try again shortly.', data: { code: 'AGENT_CONNECTION_FAILED' } })
  }
  if (!response.ok) {
    const failure = classifyAirsProviderFailure({ providerStatus: response.status, providerReason: await airsProviderFailureReason(response), retryAfter: response.headers.get('retry-after') })
    console.error('Study text provider rejected a request', failure.data)
    throw createError(failure)
  }
  const data = await response.json() as { choices?: { finish_reason?: string; message?: { content?: string; tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }[] }
  if (data.choices?.[0]?.finish_reason === 'length') throw createError({ statusCode: 502, statusMessage: 'The learning service could not finish this response. Your saved material remains available.', data: { code: 'AGENT_OUTPUT_INCOMPLETE' } })
  if (output) {
    const calls = data.choices?.[0]?.message?.tool_calls
    if (calls?.length !== 1 || calls[0]?.function?.name !== output.name || typeof calls[0]?.function?.arguments !== 'string')
      throw createError({ statusCode: 502, statusMessage: 'The learning service did not return the requested review format.', data: { code: 'AGENT_RESULT_INVALID' } })
    return calls[0].function.arguments
  }
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw createError({ statusCode: 502, statusMessage: 'Amina could not prepare a reply. Please retry.' })
  return text
}
