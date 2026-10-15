import { randomUUID } from 'node:crypto'
import { createError, type H3Event } from 'h3'
import { z } from 'zod'
import {
  normalizeAgentPresentation,
  type AgentPresentation,
  type AgentPresentationSnapshot,
} from '../../shared/agentPresentation'
import { isAminaVoiceId } from '../../shared/aminaVoices'
import { readAirsArtifact, writeAirsArtifact } from './airsContext'

const appearanceSchema = z.object({
  skinTone: z.enum(['original', 'porcelain', 'beige', 'honey', 'bronze', 'espresso']),
  hairColor: z.enum(['original', 'black', 'brown', 'blonde']),
}).strict()

const eyeAppearanceSchema = appearanceSchema.extend({
  skinTone: z.enum(['original', 'porcelain', 'beige', 'honey', 'bronze']),
  eyeColor: z.enum(['original', 'brown', 'hazel', 'green', 'blue', 'gray']).default('original'),
}).strict()

const presentationSchema = z.object({
  version: z.literal(1),
  agents: z.object({
    MIRO: eyeAppearanceSchema,
    AMIRA: appearanceSchema.extend({
      skinTone: z.enum(['original', 'beige', 'honey', 'bronze', 'espresso']),
      voiceId: z.string().refine(isAminaVoiceId).nullable(),
    }).strict(),
    KAI: eyeAppearanceSchema,
  }).strict(),
}).strict()

const saveSchema = z.object({
  presentation: presentationSchema,
  revision: z.string().max(100),
}).strict()

export function validateAgentPresentation(value: unknown): AgentPresentation {
  const parsed = presentationSchema.safeParse(value)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Choose supported appearances and an Amina voice.' })
  return parsed.data
}

export async function getAgentPresentation(ownerId: string, event?: H3Event): Promise<AgentPresentationSnapshot> {
  const saved = await readAirsArtifact<AgentPresentationSnapshot>(ownerId, 'AGENT_PRESENTATION', event)
  return {
    presentation: normalizeAgentPresentation(saved?.presentation),
    revision: typeof saved?.revision === 'string' ? saved.revision : '',
    ...(typeof saved?.savedAt === 'string' && Number.isFinite(Date.parse(saved.savedAt)) ? { savedAt: saved.savedAt } : {}),
  }
}

export async function saveAgentPresentation(ownerId: string, input: unknown, event?: H3Event): Promise<AgentPresentationSnapshot> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Choose supported appearances and an Amina voice, then save your team.' })
  const snapshot: AgentPresentationSnapshot = {
    presentation: parsed.data.presentation,
    revision: randomUUID(),
    savedAt: new Date().toISOString(),
  }
  try {
    await writeAirsArtifact(ownerId, 'AGENT_PRESENTATION', snapshot, event, parsed.data.revision)
  } catch (cause) {
    if ((cause as { statusCode?: number }).statusCode === 409) throw createError({ statusCode: 409, statusMessage: 'Your team choices changed in another tab. Reload them before saving.' })
    throw cause
  }
  return snapshot
}
