export function studySpeechOutcome(cause: any): {
  message: string;
  retryable: boolean;
} {
  const code = cause?.data?.data?.code || cause?.data?.code;
  if (code === "AMIRA_VOICE_ALLOWANCE_USED")
    return {
      message:
        "This study has used its voice allowance. Saved replies and prepared audio remain available in Conversation.",
      retryable: false,
    };
  if (cause?.name === "NotSupportedError")
    return {
      message:
        "This browser could not play the audio format. Your saved reply is available in Conversation.",
      retryable: false,
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
