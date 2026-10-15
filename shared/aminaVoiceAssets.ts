import { generatedAminaVoiceAssets } from './aminaVoiceAssets.generated';
import { getAminaDemoMode, type DemoModeId } from './aminaModeDemo';

export type AminaVoiceAssets = {
  version: 1;
  defaultVoiceId: string | null;
  voices: Record<string, {
    name?: string;
    description?: string;
    previewUrl?: string;
    demo?: Partial<Record<DemoModeId, readonly string[]>>;
  }>;
};
export const AMINA_VOICE_ASSETS: AminaVoiceAssets = generatedAminaVoiceAssets;
export function getAminaVoicePreview(id: string | null) {
  const voice = id || AMINA_VOICE_ASSETS.defaultVoiceId;
  return voice ? AMINA_VOICE_ASSETS.voices[voice]?.previewUrl : undefined;
}
export function getAminaDemoAudio(id: string | null, mode: DemoModeId, turnIndex: number) {
  const voice = id || AMINA_VOICE_ASSETS.defaultVoiceId;
  return voice ? AMINA_VOICE_ASSETS.voices[voice]?.demo?.[mode]?.[turnIndex] : undefined;
}
/** A mode offers audio only once every line of that exact voice is prepared. */
export function hasAminaDemoAudio(id: string | null, mode: DemoModeId) {
  return getAminaDemoMode(mode).prompts.every((_, index) => Boolean(getAminaDemoAudio(id, mode, index)));
}
