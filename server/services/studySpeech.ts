export async function studySpeechFailure(response: Response, action: 'transcription' | 'playback') {
  const detail = await response.json().catch(() => ({})) as { detail?: { code?: string, message?: string } }
  const code = detail.detail?.code || ''
  const message = detail.detail?.message || ''
  if (code === 'invalid_api_key' || /api key id used as api key/i.test(message))
    return 'ELEVENLABS_API_KEY is an API key ID, not the secret key. Create or rotate a key in ElevenLabs and put the full secret in .env.local.'
  if (response.status === 401) return 'ElevenLabs rejected the API key. Check or rotate ELEVENLABS_API_KEY in .env.local.'
  if (/zero.retention|enable_logging|enterprise/i.test(message))
    return 'ElevenLabs zero-retention speech is unavailable for this account. Check its privacy entitlement before using personal material.'
  if (response.status === 403) return 'ElevenLabs rejected this request. Check API key permissions and zero-retention eligibility.'
  return action === 'transcription' ? 'Transcription failed. Please retry your recording.' : 'Amina’s audio is unavailable. The transcript is saved.'
}
