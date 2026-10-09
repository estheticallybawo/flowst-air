import { describe, expect, it } from 'vitest'
import { buildMisuPlanningRequest } from '../server/services/studyMisu'
import type { StudyPreferences } from '../shared/study'

const preferences: StudyPreferences = {
  purpose: 'INTERVIEW',
  scope: 'FOCUSED',
  timeBudgetMinutes: 10,
  context: 'Explain the source in my own words.',
}
const inventory = '[passage-1; Page 1] A held-out test set checks predictions on unseen examples.'

describe('Misu planning output contracts', () => {
  it('requests a complete function proposal without asking for a competing JSON response', () => {
    const request = buildMisuPlanningRequest(preferences, inventory, undefined, 'function_call')
    expect(request.system).toContain('by calling propose_session_plan')
    expect(request.system).toContain('Follow its declared parameter schema')
    expect(request.system).toContain('rationale, conversationStrategy, and evaluationCriteria')
    expect(request.system).toContain("each objective's nested policy")
    expect(request.system).toContain('are optional; the server supplies grounded defaults when omitted')
    expect(request.system).not.toContain('Return only JSON:')
    expect(request.system).not.toContain('"title":"4 to 9 word document title"')
    expect(request.system).toContain('supported only by the uploaded document')
    expect(request.system).toContain('One independent faithful paraphrase suffices')
    expect(request.input).toBe(buildMisuPlanningRequest(preferences, inventory).input)
  })

  it('preserves the raw JSON contract for callers that do not request function output', () => {
    const legacy = buildMisuPlanningRequest(preferences, inventory)
    const rawJson = buildMisuPlanningRequest(preferences, inventory, undefined, 'json')
    expect(rawJson).toEqual(legacy)
    expect(rawJson.system).toContain('Return only JSON: {"title":"4 to 9 word document title","objectives":')
    expect(rawJson.system).not.toContain('by calling propose_session_plan')
    expect(rawJson.system).toContain('maxAttemptsForSameTarget:2')
    expect(rawJson.input).toContain(inventory)
  })
})
