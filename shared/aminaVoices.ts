import { generatedAminaVoiceAssets } from './aminaVoiceAssets.generated.js';

/** Only owner-approved voices may be selected by a learner. */
export const AMINA_VOICE_IDS = [
  'hpp4J3VqNfWAUOO0d1Us',
  'FGY2WhTYpPnrIDTdsKH5',
  'XrExE9yKIg1WjnnlVkGX',
  '2vbhUP8zyKg4dEZaTWGn',
  'zmcVlqmyk3Jpn5AVYcAL',
  'Obry8zWnqii5oX5Qsllx',
  'XlDdozLmuTofIxK4BjPD',
  'cgSgspJ2msm6clMCkdW9',
  'ii0s2u4R3UFnxKL6DOrz',
] as const;
export const AMINA_DEFAULT_VOICE_ID = AMINA_VOICE_IDS[0];
export const AMINA_VOICE_SAMPLE_TEXT = 'Hi, I’m Amina. We can take this one idea at a time. Choose the voice that feels right for your practice.';
/** Provider metadata confirmed this candidate does not exist on the connected account. */
export const AMINA_UNAVAILABLE_VOICE_IDS: readonly string[] = ['ii0s2u4R3UFnxKL6DOrz'];

export function isAminaVoiceId(value: unknown): value is (typeof AMINA_VOICE_IDS)[number] {
  return typeof value === 'string' && (AMINA_VOICE_IDS as readonly string[]).includes(value) && !AMINA_UNAVAILABLE_VOICE_IDS.includes(value);
}

type VoiceMetadata = { previewUrl?: string };
const generated = generatedAminaVoiceAssets.voices as Record<string, VoiceMetadata>;
/** Learner-facing labels describe the verified speaking style, not a separate character. */
const verified = [
  { name: 'Professional', description: 'Warm, bright and professional · American accent' },
  { name: 'Enthusiastic', description: 'Sunny and enthusiastic · American accent' },
  { name: 'Upbeat', description: 'Professional and upbeat · American accent' },
  { name: 'Conversational', description: 'Warm and conversational · Nigerian accent' },
  { name: 'Clear', description: 'Sweet and clear · Slight Hong Kong / Asian accent' },
  { name: 'Storytelling', description: 'Upbeat and conversational · Nigerian accent' },
  { name: 'Calm', description: 'Calm and soft-spoken · American accent' },
  { name: 'Playful', description: 'Playful and bright · American accent' },
] as const;
export const AMINA_VOICES: readonly Readonly<{ id: string; name: string; description: string; available: boolean; previewUrl?: string }>[] = AMINA_VOICE_IDS.map((id, index) => ({
  id,
  name: verified[index]?.name || `Voice ${index + 1}`,
  description: verified[index]?.description || 'This voice is currently unavailable.',
  available: isAminaVoiceId(id),
  ...(generated[id]?.previewUrl ? { previewUrl: generated[id]!.previewUrl } : {}),
}));
