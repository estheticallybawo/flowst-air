import { BedrockRuntimeClient, ConverseCommand, type ConverseCommandInput, type Message, type ContentBlock } from '@aws-sdk/client-bedrock-runtime'
import { createError, type H3Event } from 'h3'
import { awsClientConfig } from './awsClientConfig'
import { reserveBedrockTestingBudget } from './studyModelBudget'

export interface StudyModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: Array<{ id: string; type?: string; function: { name: string; arguments: string } }>
}
export interface StudyBedrockRequest {
  messages: StudyModelMessage[]
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>
  tool_choice?: 'required' | { type: string; function: { name: string } }
  max_completion_tokens: number
  temperature: number
}

/** Translate protocol only: tool execution and proposal validation stay in the controller. */
export function bedrockConverseInput(request: StudyBedrockRequest): Omit<ConverseCommandInput, 'modelId'> {
  const messages: Message[] = []
  for (const message of request.messages.filter(item => item.role !== 'system')) {
    const role = message.role === 'assistant' ? 'assistant' : 'user'
    const content: ContentBlock[] = message.role === 'tool'
      ? [{ toolResult: { toolUseId: message.tool_call_id!, content: [{ text: message.content || '{}' }], status: 'success' } }]
      : [ ...(message.content ? [{ text: message.content }] : []), ...(message.tool_calls || []).map(call => ({ toolUse: { toolUseId: call.id, name: call.function.name, input: JSON.parse(call.function.arguments) } })) ]
    if (!content.length) continue
    if (messages.at(-1)?.role === role) messages.at(-1)!.content!.push(...content)
    else messages.push({ role, content })
  }
  return {
    system: request.messages.filter(item => item.role === 'system' && item.content).map(item => ({ text: item.content! })),
    messages,
    inferenceConfig: { maxTokens: request.max_completion_tokens, temperature: request.temperature },
    ...(request.tools?.length ? { toolConfig: {
      tools: request.tools.map(tool => {
        // Nova accepts these fields at the top level; the application still enforces
        // the complete original Zod schema, including strict property validation.
        const { type, properties, required } = tool.function.parameters
        return { toolSpec: { name: tool.function.name, description: tool.function.description || tool.function.name, inputSchema: { json: { type: type || 'object', properties: properties || {}, ...(required ? { required } : {}) } as any } } }
      }),
      toolChoice: typeof request.tool_choice === 'object' ? { tool: { name: request.tool_choice.function.name } } : { any: {} },
    } } : {}),
  }
}

export async function requestStudyBedrock(request: StudyBedrockRequest, event?: H3Event, timeoutMs = 45_000): Promise<Response> {
  const config = useRuntimeConfig(event)
  const model = String(config.studyBedrockModelId || 'us.amazon.nova-2-lite-v1:0')
  // Rates and the $20 testing reservation are approved for this on-demand model only.
  if (!/^(?:us\.|eu\.|jp\.|global\.)?amazon\.nova-2-lite-v1:0$/.test(model))
    throw createError({ statusCode: 503, statusMessage: 'Choose the approved Nova 2 Lite model before using the Bedrock testing allowance.', data: { code: 'MODEL_TEST_CONFIGURATION' } })
  const region = String(config.awsRegion || 'us-east-1')
  if (!/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(region)) throw createError({ statusCode: 503, statusMessage: 'The Bedrock region needs an owner check.' })
  const payload = bedrockConverseInput(request)
  const body = JSON.stringify(payload)
  await reserveBedrockTestingBudget(Buffer.byteLength(body, 'utf8'), request.max_completion_tokens, event)
  let result: any
  const apiKey = String(config.studyBedrockApiKey || '')
  if (apiKey) {
    const response = await fetch(`https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/converse`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return new Response(null, { status: response.status, headers: response.headers.get('retry-after') ? { 'retry-after': response.headers.get('retry-after')! } : {} })
    result = await response.json()
  } else {
    const client = new BedrockRuntimeClient({ ...awsClientConfig(region), maxAttempts: 1 })
    try { result = await client.send(new ConverseCommand({ modelId: model, ...payload }), { abortSignal: AbortSignal.timeout(timeoutMs) }) }
    catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      if (status && status >= 400 && status <= 599) return new Response(null, { status })
      throw error
    } finally { client.destroy() }
  }
  const blocks = result.output?.message?.content || []
  if (!['end_turn', 'tool_use', 'max_tokens', 'stop_sequence'].includes(result.stopReason))
    throw createError({ statusCode: 502, statusMessage: 'The learning service could not prepare a usable response. Your saved work remains available.', data: { code: 'AGENT_RESULT_INVALID' } })
  return new Response(JSON.stringify({ choices: [{ finish_reason: result.stopReason === 'max_tokens' ? 'length' : 'stop', message: {
    role: 'assistant', content: blocks.map((part: any) => part.text || '').join(''),
    ...(blocks.some((part: any) => part.toolUse) ? { tool_calls: blocks.filter((part: any) => part.toolUse).map((part: any) => ({ id: part.toolUse.toolUseId, type: 'function', function: { name: part.toolUse.name, arguments: JSON.stringify(part.toolUse.input) } })) } : {}),
  } }] }), { headers: { 'content-type': 'application/json' } })
}
