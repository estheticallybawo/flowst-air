export function studySpeechOutcome(cause: any): {
  message: string;
  retryable: boolean;
} {
  const code = cause?.data?.data?.code || cause?.data?.code;
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
    retryable: true,
  };
}
