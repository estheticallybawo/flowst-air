import { createError } from 'h3'
import { assertStudyVoiceAgentReady } from './studyVoice'

export async function getAminaAgent() {
  const config = useRuntimeConfig()
  if (!config.elevenLabsApiKey || !config.elevenLabsStudyAgentId || (config.studyTextProvider !== 'aws' && !config.groqApiKey) || String(config.elevenLabsStudyLlmSecret).length < 32 || !/^https:\/\//.test(String(config.elevenLabsStudyLlmUrl))) {
    throw createError({ statusCode: 503, statusMessage: 'Live calls are not configured on this server yet.' })
  }
  const url = `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(String(config.elevenLabsStudyAgentId))}`
  let response: Response | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(url, { headers: { 'xi-api-key': String(config.elevenLabsApiKey) }, signal: AbortSignal.timeout(8_000) })
      if (response.ok || (response.status !== 429 && response.status < 500)) break
    } catch {
      if (attempt === 1) throw createError({ statusCode: 503, statusMessage: 'The voice service could not be reached. Check your connection and retry.' })
    }
  }
  if (!response) throw createError({ statusCode: 503, statusMessage: 'The voice service could not be reached. Please retry.' })
  if (!response.ok) throw createError({ statusCode: 503, statusMessage: 'We could not check Amina’s voice agent. Please retry.' })
  const agent = await response.json() as any
  assertStudyVoiceAgentReady(agent)
  const prompt = agent.conversation_config?.agent?.prompt
  const duration = agent.conversation_config?.conversation?.max_duration_seconds
  if (prompt?.llm !== 'custom-llm' || prompt.custom_llm?.url !== config.elevenLabsStudyLlmUrl || !Number.isFinite(duration) || duration < 1 || duration > 60 || agent.conversation_config?.agent?.first_message || (prompt.tool_ids?.length || prompt.tools?.length || prompt.knowledge_base?.length)) {
    throw createError({ statusCode: 503, statusMessage: 'Amina’s agent must use the study model callback, an empty first message, no external tools, and a maximum 60-second testing call.' })
  }
  if (prompt.backup_llm_config?.preference !== 'disabled') throw createError({ statusCode: 503, statusMessage: 'Disable fallback models for Amina’s study agent before testing.' })
  if (agent.platform_settings?.overrides?.custom_llm_extra_body !== true || agent.platform_settings?.overrides?.conversation_config_override?.conversation?.max_duration_seconds === true) throw createError({ statusCode: 503, statusMessage: 'Allow the study session token and disable call-duration overrides on Amina’s agent.' })
  return { maxSeconds: duration as number }
}
