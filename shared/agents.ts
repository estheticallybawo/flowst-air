export type FlowstAgentId = 'MIRO' | 'KYLA' | 'AMIRA' | 'NEO' | 'KAI' | 'NYLES'

export type LearningOrchestratorAgentId = 'MIRO'
export type TeachingAgentId = 'KYLA' | 'AMIRA' | 'NEO'
export type ReflectionAgentId = 'KAI'
export type BuildAgentId = 'NYLES'
export type FlowSessionAgentId = 'KYLA' | 'AMIRA' | 'KAI'
export type FlowstAgentAvailability = 'AVAILABLE' | 'IN_PREPARATION'

export interface FlowstAgentIdentity {
  id: FlowstAgentId
  name: string
  role: string
  color: string
  availability: FlowstAgentAvailability
  avatar?: string
  portrait?: string
}

export const FLOWST_AGENTS: Record<FlowstAgentId, FlowstAgentIdentity> = {
  MIRO: {
    id: 'MIRO',
    name: 'Misu',
    role: 'Learning planner',
    color: '#8f86ff',
    availability: 'AVAILABLE',
    avatar: '/optimized/v1/mascots/misu-avatar.webp',
    portrait: '/optimized/v1/mascots/misu/portrait.webp',
  },
  KYLA: {
    id: 'KYLA',
    name: 'Kyla',
    role: 'Text tutor',
    color: '#3358fd',
    availability: 'AVAILABLE',
    avatar: '/optimized/v1/mascots/kyla-avatar.webp',
    portrait: '/optimized/v1/mascots/kyla.webp',
  },
  AMIRA: {
    id: 'AMIRA',
    name: 'Amina',
    role: 'Voice tutor',
    color: '#ed8a3d',
    availability: 'AVAILABLE',
    avatar: '/optimized/v1/mascots/amina/avatar.webp',
    portrait: '/optimized/v1/mascots/amina/portrait.webp',
  },
  NEO: {
    id: 'NEO',
    name: 'Neo',
    role: 'Creative companion',
    color: '#51e9d5',
    availability: 'AVAILABLE',
    avatar: '/optimized/v1/mascots/neo/avatar.webp',
    portrait: '/optimized/v1/mascots/neo/portrait.webp',
  },
  KAI: {
    id: 'KAI',
    name: 'Kai',
    role: 'Learning reflection',
    color: '#b86af8',
    availability: 'AVAILABLE',
    avatar: '/optimized/v1/mascots/kai/portrait.webp',
    portrait: '/optimized/v1/mascots/kai/portrait.webp',
  },
  NYLES: {
    id: 'NYLES',
    name: 'Nyles',
    role: 'Build companion',
    color: '#F4C86B',
    availability: 'IN_PREPARATION',
    avatar: '/optimized/v1/mascots/nyles-avatar.webp',
    portrait: '/optimized/v1/mascots/nyles.webp',
  },
}

export const isFlowstAgentId = (value: string): value is FlowstAgentId => value in FLOWST_AGENTS
