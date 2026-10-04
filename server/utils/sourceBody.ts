import { createError, type H3Event } from 'h3'

export async function sourceRawBody(event: H3Event, maximum = 450_000) {
  const length = Number(event.node.req.headers['content-length'] || 0)
  if (length > maximum) throw createError({ statusCode: 413, statusMessage: 'The source request is too large.' })
  const chunks: Buffer[] = []; let bytes = 0
  for await (const chunk of event.node.req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > maximum) throw createError({ statusCode: 413, statusMessage: 'The source request is too large.' })
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}
export async function sourceJsonBody(event: H3Event, maximum?: number) {
  const raw = await sourceRawBody(event, maximum)
  try { return JSON.parse(raw) } catch { throw createError({ statusCode: 400, statusMessage: 'Send a valid source request.' }) }
}
