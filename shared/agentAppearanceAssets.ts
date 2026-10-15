import { FLOWST_AGENTS } from './agents';
import type { AgentAppearance, AgentEyeColor } from './agentPresentation';

type AppearanceAgent = 'MIRO' | 'MISU' | 'AMIRA' | 'KAI';
const names = { MIRO: 'misu', MISU: 'misu', AMIRA: 'amina', KAI: 'kai' } as const;

export function getAgentAppearanceAssets(agent: AppearanceAgent) {
  const identity = FLOWST_AGENTS[agent === 'MISU' ? 'MIRO' : agent];
  const name = names[agent];
  return {
    portrait: identity.portrait!, avatar: identity.avatar!,
    skinMask: `/mascots/appearance-v1/${name}-skin.png`,
    hairMask: `/mascots/appearance-v1/${name}-hair.png`,
    eyeMask: agent === 'AMIRA' ? null : `/mascots/appearance-v1/${name}-eyes.png`,
  };
}

/** Filters apply only inside exported region masks, never to the whole portrait. */
export function skinToneFilter(agent: AppearanceAgent, tone: AgentAppearance['skinTone']) {
  const darkBase = agent === 'AMIRA';
  const filters = darkBase ? {
    original: 'none',
    porcelain: 'none',
    beige: 'brightness(1.55) contrast(.85) saturate(.68)',
    honey: 'brightness(1.22) contrast(.94) saturate(.82)',
    bronze: 'brightness(.88) saturate(.85)',
    espresso: 'brightness(.63) saturate(.75)',
  } : {
    original: 'none',
    porcelain: 'brightness(1.1) saturate(.7)',
    beige: 'brightness(.94) saturate(.82)',
    honey: 'brightness(.8) saturate(1.02)',
    bronze: 'brightness(.62) saturate(1.08)',
    espresso: 'none',
  };
  return filters[tone] || 'none';
}

export function hairColorFilter(agent: AppearanceAgent, color: AgentAppearance['hairColor']) {
  if (color === 'original') return 'none';
  const darkBase = agent === 'AMIRA';
  const filters = darkBase ? {
    black: 'saturate(0) brightness(.7)',
    brown: 'sepia(.8) saturate(1.25) brightness(1.8)',
    blonde: 'sepia(1) saturate(1.05) brightness(4)',
  } : {
    black: 'saturate(0) brightness(.23)',
    brown: 'sepia(1) saturate(1.1) brightness(.58)',
    blonde: 'sepia(1) saturate(.9) brightness(1.18)',
  };
  return filters[color] || 'none';
}

/** Keep iris shading while the alpha masks protect pupils and catchlights. */
export function eyeColorFilter(color: AgentEyeColor) {
  const filters: Record<AgentEyeColor, string> = {
    original: 'none',
    brown: 'sepia(1) saturate(2.3) hue-rotate(-20deg) brightness(.72)',
    hazel: 'sepia(1) saturate(1.6) hue-rotate(5deg) brightness(.95)',
    green: 'sepia(1) saturate(1.8) hue-rotate(65deg) brightness(.9)',
    blue: 'hue-rotate(-35deg) saturate(1.2)',
    gray: 'saturate(0) brightness(1.05)',
  };
  return filters[color] || 'none';
}
