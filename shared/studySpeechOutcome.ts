/** Render only application-owned messages for recognised transcription failures. */
export function studyTranscriptionOutcome(cause: any): string | undefined {
  const code = cause?.data?.data?.code || cause?.data?.code
  const messages: Record<string, string> = {
    SPEECH_PROVIDER_QUOTA: 'The speech provider rejected transcription under its quota. Check the account and API key allowance; Airs has no cumulative voice quota. Keep this page open to retain your take.',
    SPEECH_PROVIDER_KEY_QUOTA: 'The speech provider’s API key reached its own allowance. The account may still have credits. Check the key’s credit limit before retrying. Keep this page open to retain your take.',
    SPEECH_PROVIDER_CREDITS: 'The speech provider reported insufficient credits for transcription. Check the account connected to the app’s key. Keep this page open to retain your take.',
    SPEECH_PROVIDER_PLAN: 'The speech provider requires eligible account or feature access for transcription. Check its request log and plan settings. Keep this page open to retain your take.',
    SPEECH_PROVIDER_RESTRICTED: 'The speech provider has restricted transcription from this deployment, independently of its remaining credits. The Flowst team needs to resolve it. Keep this page open to retain your take.',
    SPEECH_PROVIDER_CONFIGURATION: 'The server’s speech key or model access needs checking before transcription. Keep this page open to retain your take.',
    SPEECH_PROVIDER_BUSY: 'The speech provider is busy. Wait a moment before sending this same take again. Keep this page open to retain your recording.',
    SPEECH_PROVIDER_UNAVAILABLE: 'Transcription is unavailable right now. Keep this page open to retain your take; retry when the service is available.',
    SPEECH_NOT_CONFIGURED: 'Speech transcription is not configured on this server. Keep this page open to retain your take.',
  }
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(messages, code) ? messages[code] : undefined
}

export function studySpeechOutcome(cause: any): {
  message: string;
  retryable: boolean;
} {
  const code = cause?.data?.data?.code || cause?.data?.code;
  const recovery = cause?.data?.data?.retryable ?? cause?.data?.retryable;
  if (cause?.name === "NotSupportedError")
    return {
      message:
        "This browser could not play the audio format. Your saved reply is available in Conversation.",
      retryable: false,
    };
  // Older failed speech records may retain this pre-dispatch restriction code.
  // Quotas no longer block the study; recovery still requires an explicit retry.
  if (code === "AMIRA_VOICE_ALLOWANCE_USED")
    return {
      message:
        "Amina’s voice is unavailable right now. Retry voice when you’re ready, or read your saved reply in Conversation.",
      retryable: true,
    };
  const message = cause?.data?.statusMessage || cause?.statusMessage;
  if (code === "SPEECH_PENDING")
    return {
      message:
        message ||
        "This spoken reply is still being prepared. No second voice request was sent.",
      retryable: true,
    };
  return {
    message:
      message ||
      "Amina’s audio could not be played. Your saved reply is available in Conversation.",
    retryable: typeof recovery === 'boolean' ? recovery : ![
      'SPEECH_NOT_CONFIGURED',
      'SPEECH_PROVIDER_CONFIGURATION',
      'SPEECH_PROVIDER_RESTRICTED',
      'SPEECH_PROVIDER_CREDITS',
      'SPEECH_PROVIDER_QUOTA',
      'SPEECH_PROVIDER_KEY_QUOTA',
      'SPEECH_PROVIDER_PLAN',
      'SPEECH_CACHE_UNAVAILABLE',
      'SPEECH_CACHE_ACCESS',
      'SPEECH_CACHE_AUTH',
      'SPEECH_EXPIRED',
      'SPEECH_RESPONSE_NOT_FOUND',
    ].includes(code),
  };
}
