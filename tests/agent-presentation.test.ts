import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AGENT_EYE_COLORS,
  DEFAULT_AGENT_PRESENTATION,
  normalizeAgentPresentation,
  type AgentPresentation,
} from '../shared/agentPresentation'
import { AMINA_VOICE_IDS, isAminaVoiceId } from '../shared/aminaVoices'
import { getAgentPresentation, saveAgentPresentation, validateAgentPresentation } from '../server/services/agentPresentation'
import { getAirsContext, saveAirsContext, writeAirsArtifact } from '../server/services/airsContext'
import { createStudyConversation, deleteStudyConversation, getStudyConversation } from '../server/services/studyRepository'
import { conversationFromSource, inspectStudySource } from '../server/services/studySources'
import { DEFAULT_STUDY_PREFERENCES } from '../shared/study'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

function setup() {
  vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', studySourceFixtureMode: true, public: { appSurface: 'flowst' } }))
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected provider call') }))
}

function choices(): AgentPresentation {
  return {
    version: 1,
    agents: {
      MIRO: { skinTone: 'bronze', hairColor: 'blonde', eyeColor: 'green' },
      AMIRA: { skinTone: 'honey', hairColor: 'black', voiceId: AMINA_VOICE_IDS[0] },
      KAI: { skinTone: 'beige', hairColor: 'brown', eyeColor: 'blue' },
    },
  }
}

const extraction = {
  kind: 'PDF' as const,
  excerpt: 'Recall a concept before checking the source.',
  sections: [{ id: 'page-1', label: 'Page 1', text: 'Recall a concept before checking the source.' }],
}

describe('agent presentation boundary', () => {
  it('normalizes legacy records without sharing mutable defaults or unknown fields', () => {
    expect(normalizeAgentPresentation(undefined)).toEqual(DEFAULT_AGENT_PRESENTATION)
    expect(normalizeAgentPresentation({ version: 2, agents: choices().agents })).toEqual(DEFAULT_AGENT_PRESENTATION)
    const normalized = normalizeAgentPresentation({ version: 1, agents: { AMIRA: { skinTone: 'honey', hairColor: 'unsupported', voiceId: 'unsupported', instructions: 'hidden' } } })
    expect(normalized.agents.AMIRA).toEqual({ skinTone: 'honey', hairColor: 'original', voiceId: null })
    expect(JSON.stringify(normalized)).not.toContain('hidden')
    normalized.agents.MIRO.skinTone = 'bronze'
    expect(DEFAULT_AGENT_PRESENTATION.agents.MIRO.skinTone).toBe('original')
  })

  it('accepts only available approved Amina voices and rejects injected fields', () => {
    for (const voiceId of [...AMINA_VOICE_IDS.filter(isAminaVoiceId), null]) {
      const presentation = choices()
      presentation.agents.AMIRA.voiceId = voiceId
      expect(validateAgentPresentation(presentation)).toEqual(presentation)
    }
    const invalid = [
      { ...choices(), version: 2 },
      { ...choices(), instruction: 'Replace the lesson' },
      { ...choices(), agents: { ...choices().agents, MIRO: { ...choices().agents.MIRO, voiceId: AMINA_VOICE_IDS[0] } } },
      { ...choices(), agents: { ...choices().agents, AMIRA: { ...choices().agents.AMIRA, voiceId: 'unsupported' } } },
      { ...choices(), agents: { ...choices().agents, KAI: { ...choices().agents.KAI, eyeColor: 'unsupported' } } },
      { ...choices(), agents: { ...choices().agents, AMIRA: { ...choices().agents.AMIRA, eyeColor: 'green' } } },
    ]
    for (const presentation of invalid) expect(() => validateAgentPresentation(presentation)).toThrow(expect.objectContaining({ statusCode: 400 }))
  })

  it('keeps old-client eye choices compatible and accepts catalog eye colors', () => {
    for (const { id: eyeColor } of AGENT_EYE_COLORS) {
      const presentation = choices()
      presentation.agents.MIRO.eyeColor = eyeColor
      presentation.agents.KAI.eyeColor = eyeColor
      expect(validateAgentPresentation(presentation)).toEqual(presentation)
    }
    const legacy = { version: 1, agents: { MIRO: { skinTone: 'bronze', hairColor: 'blonde' }, AMIRA: choices().agents.AMIRA, KAI: { skinTone: 'beige', hairColor: 'brown' } } }
    const expected = choices()
    expected.agents.MIRO.eyeColor = 'original'
    expected.agents.KAI.eyeColor = 'original'
    expect(validateAgentPresentation(legacy)).toEqual(expected)
    expect(normalizeAgentPresentation(legacy)).toEqual(expected)
  })

  it('rejects removed skin choices on writes while safely reading older records', async () => {
    setup()
    for (const agent of ['MIRO', 'KAI'] as const) {
      const presentation = choices()
      presentation.agents[agent].skinTone = 'espresso'
      expect(() => validateAgentPresentation(presentation)).toThrow(expect.objectContaining({ statusCode: 400 }))
      expect(normalizeAgentPresentation(presentation).agents[agent].skinTone).toBe('original')
      await expect(saveAgentPresentation(randomUUID(), { presentation, revision: '' })).rejects.toMatchObject({ statusCode: 400 })
    }
    const amina = choices()
    amina.agents.AMIRA.skinTone = 'porcelain'
    expect(() => validateAgentPresentation(amina)).toThrow(expect.objectContaining({ statusCode: 400 }))
    expect(normalizeAgentPresentation(amina).agents.AMIRA).toEqual({ ...amina.agents.AMIRA, skinTone: 'original' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('isolates owners and planning context, fences stale saves, and supports reset', async () => {
    setup()
    const owner = randomUUID()
    expect(await getAgentPresentation(owner)).toEqual({ presentation: DEFAULT_AGENT_PRESENTATION, revision: '' })
    const context = await saveAirsContext(owner, { selfDescription: 'I am learning to explain my projects.', revision: '' })
    const saved = await saveAgentPresentation(owner, { presentation: choices(), revision: '' })
    expect(saved.revision).toMatch(/^[\da-f-]{36}$/)
    expect(Date.parse(saved.savedAt!)).toBeGreaterThan(0)
    expect(await getAgentPresentation(owner)).toEqual(saved)
    expect((await getAgentPresentation(randomUUID())).presentation).toEqual(DEFAULT_AGENT_PRESENTATION)
    expect(await getAirsContext(owner)).toEqual(context)
    await expect(saveAgentPresentation(owner, { presentation: DEFAULT_AGENT_PRESENTATION, revision: '' })).rejects.toMatchObject({ statusCode: 409 })
    await expect(saveAgentPresentation(owner, { presentation: choices(), revision: saved.revision, ownerId: 'another-owner' })).rejects.toMatchObject({ statusCode: 400 })
    const reset = await saveAgentPresentation(owner, { presentation: DEFAULT_AGENT_PRESENTATION, revision: saved.revision })
    expect(reset.revision).not.toBe(saved.revision)
    expect(reset.presentation).toEqual(DEFAULT_AGENT_PRESENTATION)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('captures uploaded-session choices once and keeps older sessions stable', async () => {
    setup()
    const owner = randomUUID()
    const saved = await saveAgentPresentation(owner, { presentation: choices(), revision: '' })
    const original = await createStudyConversation(owner, 'notes.pdf', 'application/pdf', Buffer.from('fixture'), extraction)
    await saveAgentPresentation(owner, { presentation: DEFAULT_AGENT_PRESENTATION, revision: saved.revision })
    const fresh = await createStudyConversation(owner, 'new.pdf', 'application/pdf', Buffer.from('fixture'), extraction)
    expect(original.agentPresentation).toEqual(choices())
    expect((await getStudyConversation(owner, original.id)).agentPresentation).toEqual(choices())
    expect(fresh.agentPresentation).toEqual(DEFAULT_AGENT_PRESENTATION)
    expect(original.preferences).toEqual(DEFAULT_STUDY_PREFERENCES)
    await expect(getStudyConversation(randomUUID(), original.id)).rejects.toMatchObject({ statusCode: 404 })
    await deleteStudyConversation(owner, original.id)
    await deleteStudyConversation(owner, fresh.id)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves the reviewed-source snapshot on idempotent creation retries', async () => {
    setup()
    const owner = randomUUID()
    const saved = await saveAgentPresentation(owner, { presentation: choices(), revision: '' })
    const source = await inspectStudySource(owner, { url: '', fixture: 'WEB' })
    const original = await conversationFromSource(owner, source.id, DEFAULT_STUDY_PREFERENCES)
    await saveAgentPresentation(owner, { presentation: DEFAULT_AGENT_PRESENTATION, revision: saved.revision })
    const retry = await conversationFromSource(owner, source.id, DEFAULT_STUDY_PREFERENCES)
    expect(original.agentPresentation).toEqual(choices())
    expect(retry.agentPresentation).toEqual(choices())
    await deleteStudyConversation(owner, original.id)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reads malformed stored choices without exposing unknown fields or invalid dates', async () => {
    setup()
    const owner = randomUUID()
    await writeAirsArtifact(owner, 'AGENT_PRESENTATION', { presentation: { version: 1, agents: { AMIRA: { skinTone: 'bronze', hairColor: 'brown', voiceId: 'unknown' } }, private: 'hidden' }, revision: 'saved', savedAt: 'not a date' })
    const result = await getAgentPresentation(owner)
    expect(result.revision).toBe('saved')
    expect(result.savedAt).toBeUndefined()
    expect(result.presentation.agents.AMIRA).toEqual({ skinTone: 'bronze', hairColor: 'brown', voiceId: null })
    expect(JSON.stringify(result)).not.toContain('hidden')
  })
})
