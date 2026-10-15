import { isAminaVoiceId } from './aminaVoices'

export const AGENT_SKIN_TONES = [
  { id: 'original', label: 'Original', color: '#c79372' },
  { id: 'porcelain', label: 'Porcelain', color: '#f1d8c5' },
  { id: 'beige', label: 'Beige', color: '#dfb893' },
  { id: 'honey', label: 'Honey', color: '#c88b59' },
  { id: 'bronze', label: 'Bronze', color: '#9b6040' },
  { id: 'espresso', label: 'Espresso', color: '#563727' },
] as const

export const AGENT_HAIR_COLORS = [
  { id: 'original', label: 'Original', color: '#392d28' },
  { id: 'black', label: 'Black', color: '#211d1b' },
  { id: 'brown', label: 'Brown', color: '#63402c' },
  { id: 'blonde', label: 'Blonde', color: '#d5b473' },
] as const

export const AGENT_EYE_COLORS = [
  { id: 'original', label: 'Original', color: '#8f79b4' },
  { id: 'brown', label: 'Brown', color: '#70472e' },
  { id: 'hazel', label: 'Hazel', color: '#9b8249' },
  { id: 'green', label: 'Green', color: '#567b58' },
  { id: 'blue', label: 'Blue', color: '#5280ad' },
  { id: 'gray', label: 'Gray', color: '#808b98' },
] as const

export type AgentSkinTone = typeof AGENT_SKIN_TONES[number]['id']
export type AgentHairColor = typeof AGENT_HAIR_COLORS[number]['id']
export type AgentEyeColor = typeof AGENT_EYE_COLORS[number]['id']
export type CustomizableAgentId = 'MIRO' | 'AMIRA' | 'KAI'

const COMPANION_SKIN_TONES = AGENT_SKIN_TONES.filter(tone => tone.id !== 'espresso')
const AMINA_SKIN_TONES = AGENT_SKIN_TONES.filter(tone => tone.id !== 'porcelain')

export function getAgentSkinTones(agent: CustomizableAgentId | 'MISU') {
  return agent === 'AMIRA' ? AMINA_SKIN_TONES : COMPANION_SKIN_TONES
}

export interface AgentAppearance {
  skinTone: AgentSkinTone
  hairColor: AgentHairColor
}

export interface AgentEyeAppearance extends AgentAppearance {
  eyeColor: AgentEyeColor
}

/** Presentation stays separate from learning context and model instructions. */
export interface AgentPresentation {
  version: 1
  agents: {
    MIRO: AgentEyeAppearance
    AMIRA: AgentAppearance & { voiceId: string | null }
    KAI: AgentEyeAppearance
  }
}

export interface AgentPresentationSnapshot {
  presentation: AgentPresentation
  /** Empty until an owner saves their first set of choices. */
  revision: string
  savedAt?: string
}

export const DEFAULT_AGENT_PRESENTATION: AgentPresentation = {
  version: 1,
  agents: {
    MIRO: { skinTone: 'original', hairColor: 'original', eyeColor: 'original' },
    AMIRA: { skinTone: 'original', hairColor: 'original', voiceId: null },
    KAI: { skinTone: 'original', hairColor: 'original', eyeColor: 'original' },
  },
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function appearance(value: unknown, agent: CustomizableAgentId): AgentAppearance {
  const source = object(value)
  return {
    skinTone: getAgentSkinTones(agent).some(tone => tone.id === source.skinTone) ? source.skinTone as AgentSkinTone : 'original',
    hairColor: AGENT_HAIR_COLORS.some(color => color.id === source.hairColor) ? source.hairColor as AgentHairColor : 'original',
  }
}

function eyeAppearance(value: unknown, agent: 'MIRO' | 'KAI'): AgentEyeAppearance {
  const source = object(value)
  return {
    ...appearance(source, agent),
    eyeColor: AGENT_EYE_COLORS.some(color => color.id === source.eyeColor) ? source.eyeColor as AgentEyeColor : 'original',
  }
}

/** Saved legacy or malformed records always render using complete supported choices. */
export function normalizeAgentPresentation(value: unknown): AgentPresentation {
  const source = object(value)
  const agents = source.version === 1 ? object(source.agents) : {}
  const amina = object(agents.AMIRA)
  return {
    version: 1,
    agents: {
      MIRO: eyeAppearance(agents.MIRO, 'MIRO'),
      AMIRA: { ...appearance(amina, 'AMIRA'), voiceId: isAminaVoiceId(amina.voiceId) ? amina.voiceId : null },
      KAI: eyeAppearance(agents.KAI, 'KAI'),
    },
  }
}
