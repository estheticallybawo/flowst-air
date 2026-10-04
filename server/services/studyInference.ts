import { createError } from 'h3'
import type { H3Event } from 'h3'

/** Study inference is independent of AWS persistence. Never fall back across paid providers. */
export async function groqStudyText(system: string, messages: { role: 'user' | 'assistant'; content: string }[], maxTokens: number, event?: H3Event) {
  const config = useRuntimeConfig(event)
  if (!config.groqApiKey) throw createError({ statusCode: 503, statusMessage: 'Amina’s model connection is not configured.' })
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${config.groqApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.groqModel, messages: [{ role: 'system', content: system }, ...messages], max_completion_tokens: maxTokens, temperature: 0.3, stream: false, ...(String(config.groqModel).includes('gpt-oss') ? { reasoning_effort: 'low' } : {}) }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) throw createError({ statusCode: response.status === 429 ? 429 : 503, statusMessage: 'Amina’s model connection is busy or unavailable. Try again shortly.' })
  const data = await response.json() as { choices?: { message?: { content?: string } }[] }
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw createError({ statusCode: 502, statusMessage: 'Amina could not prepare a reply. Please retry.' })
  return text
}
