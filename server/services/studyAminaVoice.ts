import { createError } from 'h3';
import { isAminaVoiceId } from '../../shared/aminaVoices';

type AminaVoiceConversation = {
  agentPresentation?: { agents: { AMIRA: { voiceId: string | null } } };
};

export function selectedAminaVoice(conversation: AminaVoiceConversation): string | null {
  const voiceId = conversation.agentPresentation?.agents?.AMIRA?.voiceId;
  if (voiceId === undefined || voiceId === null) return null;
  if (!isAminaVoiceId(voiceId)) throw createError({
    statusCode: 409,
    statusMessage: 'This session’s Amina voice is unavailable. Start a new session to choose a voice.',
    data: { code: 'SPEECH_VOICE_UNAVAILABLE', retryable: false },
  });
  return voiceId;
}

export function resolveAminaVoice(conversation: AminaVoiceConversation, configuredDefault: unknown): string {
  const voiceId = selectedAminaVoice(conversation) || String(configuredDefault || '');
  if (!voiceId) throw createError({
    statusCode: 503,
    statusMessage: 'Amina’s voice is not selected on this server. Your saved reply remains available.',
    data: { code: 'SPEECH_NOT_CONFIGURED', retryable: false },
  });
  return voiceId;
}
