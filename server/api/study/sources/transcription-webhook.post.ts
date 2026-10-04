import { sourceRawBody } from '../../../utils/sourceBody'
import { acceptTranscription } from '../../../services/studySources'
export default defineEventHandler(async event => acceptTranscription(await sourceRawBody(event, 2 * 1024 * 1024), getHeader(event, 'elevenlabs-signature') || '', event))
