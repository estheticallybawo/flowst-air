import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultObjectivePolicy } from '../shared/studyObjectivePolicy'
import { DEFAULT_STUDY_PREFERENCES, type StudyPreferences } from '../shared/study'
import { readStudyPreferencesField, validateStudyPreferences } from '../server/services/studyPreferences'
import { buildMisuPlanningRequest, generateMisuPlan, standaloneStudyObjectiveCapacity, validateMisuObjectives } from '../server/services/studyMisu'
import { appendStudyVoiceUsage, createStudyConversation, deleteStudyConversation, getStudyChunks, getStudyConversation, indexStudySections } from '../server/services/studyRepository'

afterEach(() => vi.unstubAllGlobals())

const extraction = { kind: 'PDF' as const, sections: [{ id: 'page-1', label: 'Page 1', text: 'Supervised learning uses labelled examples to train a prediction model. A test set checks predictions on unseen examples.' }], excerpt: 'Supervised learning uses labelled examples.' }
const preferences: StudyPreferences = { purpose: 'INTERVIEW', scope: 'FOCUSED', timeBudgetMinutes: 10, context: 'Junior AI role. Focus on explaining training and test data clearly.' }

describe('learner-selected Amina planning context', () => {
  it('uses deliberate defaults and validates multipart choices before inference', () => {
    expect(readStudyPreferencesField()).toEqual(DEFAULT_STUDY_PREFERENCES)
    expect(readStudyPreferencesField(Buffer.from(JSON.stringify(preferences)))).toEqual(preferences)
    expect(() => readStudyPreferencesField(Buffer.from('not-json'))).toThrow()
    for (const timeBudgetMinutes of [0, 4, 121, 12.5, '15']) expect(() => validateStudyPreferences({ ...preferences, timeBudgetMinutes })).toThrow()
    expect(() => validateStudyPreferences({ ...preferences, purpose: 'IGNORE_SOURCE_RULES' })).toThrow()
    expect(() => validateStudyPreferences({ ...preferences, scope: 'UNLIMITED' })).toThrow()
    expect(() => validateStudyPreferences({ ...preferences, context: 'x'.repeat(601) })).toThrow()
    expect(() => validateStudyPreferences({ ...preferences, purpose: 'OTHER', context: ' ' })).toThrow()
    expect(validateStudyPreferences({ ...preferences, context: '  Explain the key ideas.  ' }).context).toBe('Explain the key ideas.')
  })

  it('puts use case, scope, time and context in one source-bounded planning request', () => {
    const request = buildMisuPlanningRequest(preferences, '[page-1] Supervised learning uses labelled examples.')
    expect(request.input).toContain('"purpose":"INTERVIEW"')
    expect(request.input).toContain('"timeBudgetMinutes":10')
    expect(request.input).toContain('Junior AI role')
    expect(request.input).toContain('[page-1]')
    expect(request.system).toContain('1 to 4')
    expect(request.system).toContain('untrusted data')
    expect(request.system).toContain('planningNote')
    expect(request.system).toContain('supported only by the uploaded document')
    expect(buildMisuPlanningRequest({ ...preferences, scope: 'BROAD', purpose: 'CONTENT_CREATION' }, 'passages').system).toContain('3 to 6')
  })

  it('rejects unsupported citations and timing that cannot fit the learner budget', () => {
    const chunks = indexStudySections(extraction)
    const objective = { title: 'Explain supervised learning', outcome: 'Explain labelled examples and held-out test data.', sourceIds: [chunks[0]!.id], estimatedMinutes: 4 }
    expect(validateMisuObjectives({ objectives: [objective] }, chunks, preferences)[0]?.estimatedMinutes).toBe(4)
    expect(validateMisuObjectives({ objectives: [{ ...objective, planningNote: 'Explain this idea for the interview goal.' }] }, chunks, preferences)[0]?.planningNote).toBe('Explain this idea for the interview goal.')
    expect(() => validateMisuObjectives({ objectives: [{ ...objective, planningNote: 'x'.repeat(401) }] }, chunks, preferences)).toThrow()
    expect(() => validateMisuObjectives({ objectives: [{ ...objective, sourceIds: ['invented-source'] }] }, chunks, preferences)).toThrow()
    for (const estimatedMinutes of [0, 2.5, 11, '4', undefined]) expect(() => validateMisuObjectives({ objectives: [{ ...objective, estimatedMinutes }] }, chunks, preferences)).toThrow()
    expect(() => validateMisuObjectives({ objectives: [{ ...objective, estimatedMinutes: 6 }, { ...objective, title: 'Use held-out data', estimatedMinutes: 6 }] }, chunks, preferences)).toThrow(/exceeds your available time/)
    expect(() => validateMisuObjectives({ objectives: [objective] }, chunks, { ...preferences, scope: 'BROAD' })).toThrow()
  })

  it('bounds a deliberately selected objective count independently of voice usage', () => {
    const broad = { ...preferences, scope: 'BROAD' as const, timeBudgetMinutes: 120 }
    const chunks = indexStudySections(extraction)
    const objectives = Array.from({ length: 6 }, (_, index) => ({ title: `Explain supervised learning ${index + 1}`, outcome: 'Explain labelled examples.', sourceIds: [chunks[0]!.id], estimatedMinutes: 1 }))
    const bounded = buildMisuPlanningRequest(broad, 'source passages', 5)
    expect(bounded.system).toContain('3 to 5')
    expect(bounded.system).not.toContain('reserved live calls')
    expect(() => validateMisuObjectives({ objectives }, chunks, broad, 5)).toThrow()
    expect(validateMisuObjectives({ objectives: objectives.slice(0, 5) }, chunks, broad, 5)).toHaveLength(5)
    expect(validateMisuObjectives({ objectives }, chunks, broad)).toHaveLength(6)
    expect(() => buildMisuPlanningRequest(broad, 'sources', 2)).toThrow(/selected study scope/)
  })

  it('does not restrict objective capacity by earlier speech or retired quota settings', () => {
    const study = { preferences: { ...preferences, timeBudgetMinutes: 120 }, voiceUsage: { transcribeSeconds: 1200, pollyCharacters: 25000 } } as any
    for (const appSurface of ['air','amira','flowst']) {
      vi.stubGlobal('useRuntimeConfig', () => ({ public: { appSurface }, studyAwsVoiceTrialMaxSeconds: 300 }))
      expect(standaloneStudyObjectiveCapacity(study)).toBeUndefined()
    }
  })

  it('generates all six broad objectives after earlier voice usage exceeds the retired limits', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', public: { appSurface: 'air' }, studyAwsVoiceTrialMaxSeconds: 120, studyTextProvider: 'groq', groqApiKey: 'test-key', groqModel: 'test-model' }))
    const broad = { ...preferences, scope: 'BROAD' as const, timeBudgetMinutes: 120 }
    const chat = await createStudyConversation('planning-unlimited-owner', 'notes.pdf', 'application/pdf', Buffer.from('fixture'), extraction, undefined, broad)
    await appendStudyVoiceUsage(chat.ownerId, chat.id, {kind:'TRANSCRIBE',units:1200})
    const chunks = await getStudyChunks(chat.ownerId, chat.id)
    const modelPlan = { title: 'Supervised Learning With Labelled Examples', objectives: Array.from({ length: 6 }, (_, index) => ({ title: `Explain supervised learning ${index + 1}`, outcome: 'Explain labelled examples.', sourceIds: [chunks[0]!.id], estimatedMinutes: 1 })) }
    const fetcher = vi.fn().mockResolvedValue(planningResponse(modelPlan));vi.stubGlobal('fetch', fetcher)
    try {
      const planned = await generateMisuPlan(chat.ownerId, chat.id)
      expect(planned.plan.status).toBe('DRAFT');expect(planned.plan.objectives).toHaveLength(6)
      expect(JSON.parse(fetcher.mock.calls[0]?.[1].body).messages[0].content).toContain('3 to 6')
      expect(fetcher).toHaveBeenCalledTimes(1)
    } finally { await deleteStudyConversation(chat.ownerId, chat.id) }
  })

  it('saves the learner context and produces a grounded timed plan through the existing model pipeline', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', studyTextProvider: 'groq', groqApiKey: 'test-key', groqModel: 'test-model' }))
    const chat = await createStudyConversation('planning-context-owner', 'notes.pdf', 'application/pdf', Buffer.from('fixture'), extraction, undefined, preferences)
    const chunks = await getStudyChunks('planning-context-owner', chat.id)
    const modelPlan = { title: 'How Supervised Learning Uses Labelled Examples', objectives: [
      { title: 'Explain supervised learning', outcome: 'Explain how labelled examples guide model training.', sourceIds: [chunks[0]!.id], estimatedMinutes: 4 },
      { title: 'Defend a test set', outcome: 'Explain why predictions are checked on unseen examples.', sourceIds: [chunks[0]!.id], estimatedMinutes: 5 },
    ] }
    const fetcher = vi.fn().mockResolvedValue(planningResponse(modelPlan))
    vi.stubGlobal('fetch', fetcher)
    try {
      const plan = await generateMisuPlan('planning-context-owner', chat.id)
      expect(plan.preferences).toEqual(preferences)
      expect(plan.plan).toMatchObject({ status: 'DRAFT', estimatedTotalMinutes: 9 })
      expect(plan.plan.objectives.map(objective => objective.estimatedMinutes)).toEqual([4, 5])
      expect(plan.plan.objectives[0]?.sources[0]?.label).toBe('Page 1')
      expect((await getStudyConversation('planning-context-owner', chat.id)).preferences).toEqual(preferences)
      const body = JSON.parse(fetcher.mock.calls[0]?.[1].body)
      expect(JSON.stringify(body.messages)).toContain('Junior AI role')
      expect(fetcher).toHaveBeenCalledTimes(1)
    } finally { await deleteStudyConversation('planning-context-owner', chat.id) }
  })

  it('preserves choices and exposes a retryable failure when generated timings exceed the budget', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', studyTextProvider: 'groq', groqApiKey: 'test-key', groqModel: 'test-model' }))
    const chat = await createStudyConversation('planning-budget-failure-owner', 'notes.pdf', 'application/pdf', Buffer.from('fixture'), extraction, undefined, preferences)
    const chunks = await getStudyChunks('planning-budget-failure-owner', chat.id)
    const modelPlan = { title: 'Supervised Learning With Labelled Examples', objectives: ['Explain training', 'Explain a test set'].map(title => ({ title, outcome: 'Explain the role of labelled and unseen examples.', sourceIds: [chunks[0]!.id], estimatedMinutes: 6 })) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(planningResponse(modelPlan)))
    try {
      await expect(generateMisuPlan('planning-budget-failure-owner', chat.id)).rejects.toMatchObject({ statusCode: 502 })
      const saved = await getStudyConversation('planning-budget-failure-owner', chat.id)
      expect(saved.preferences).toEqual(preferences)
      expect(saved.plan.status).toBe('FAILED')
      expect(saved.plan.error).toContain('exceeds your available time')
      expect(saved.plan.objectives).toEqual([])
      expect(saved.plan.courseCompletedAt).toBeUndefined()
    } finally { await deleteStudyConversation('planning-budget-failure-owner', chat.id) }
  })
})

function planningResponse(plan:any) {
  const objectives=plan.objectives.map((objective:any,index:number)=>({...objective,policy:defaultObjectivePolicy({id:'objective-'+(index+1),title:objective.title,outcome:objective.outcome,sources:objective.sourceIds.map((id:string)=>({id,label:'Approved fixture source',excerpt:''}))})}))
  return new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'plan',type:'function',function:{name:'propose_session_plan',arguments:JSON.stringify({...plan,objectives,rationale:'Source-grounded practice for the selected goal.',conversationStrategy:'Independent explanation then application.',evaluationCriteria:[{id:'ACCURACY',description:'Explain the approved source accurately.'}]})}}]}}]}))
}
