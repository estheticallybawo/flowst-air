import { computed, ref, watch, type Ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWebCompanionState, getWebCompanionInvitation, getWebCompanionTopic, getWebCompanionTopicForDimension, transitionWebCompanion, WEB_COMPANION_TOPICS, type WebCompanionAction, type WebCompanionStage, type WebCompanionState } from '../shared/webCompanionDemo'
import { useWebCompanionDemo } from '../composables/useWebCompanionDemo'
import { isAirPublicPage, isAirStandalonePage } from '../shared/airSurface'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })

function makeDemo(options: { owner?: string; fixture?: boolean; growth?: boolean } = {}) {
  const auth = {
    status: ref<'AUTHENTICATED' | 'ANONYMOUS'>(options.owner === '' ? 'ANONYMOUS' : 'AUTHENTICATED'),
    me: ref({ profile: { userId: options.owner ?? 'companion-owner' } }),
  }
  const stateByKey = new Map<string, Ref<unknown>>()
  const growth = { selectedDimension: ref('clear_explanation') }
  const forbidden = {
    fetch: vi.fn(() => { throw new Error('The Home companion must not fetch or call a provider') }),
    localStorage: vi.fn(() => { throw new Error('The Home companion must not persist local data') }),
    sessionStorage: vi.fn(() => { throw new Error('The Home companion must not persist session data') }),
    microphone: vi.fn(() => { throw new Error('The Home companion must not request a microphone') }),
  }
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('useAuth', () => auth)
  vi.stubGlobal('useAirGrowth', () => growth)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { studySourceFixtureMode: options.fixture ?? true, airGrowthEnabled: options.growth ?? false } }))
  vi.stubGlobal('useState', (key: string, initialize: () => unknown) => {
    if (!stateByKey.has(key)) stateByKey.set(key, ref(initialize()))
    return stateByKey.get(key)!
  })
  vi.stubGlobal('fetch', forbidden.fetch)
  vi.stubGlobal('localStorage', { setItem: forbidden.localStorage })
  vi.stubGlobal('sessionStorage', { setItem: forbidden.sessionStorage })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: forbidden.microphone } })
  return { demo: useWebCompanionDemo(), auth, growth, forbidden }
}

function advanceTo(stage: WebCompanionStage): WebCompanionState {
  let state = transitionWebCompanion(createWebCompanionState(), { type: 'enable' })
  const path = [
    ['plan', 'open-plan'], ['practice', 'approve-plan'], ['answer', 'show-sample-answer'], ['reflection', 'reflect'],
  ] as const
  if (stage === 'invite') return state
  for (const [nextStage, type] of path) {
    state = transitionWebCompanion(state, { type })
    if (nextStage === stage) return state
  }
  throw new Error('Unknown companion stage')
}

describe('memory-only Home companion', () => {
  it('starts disabled with fresh state and only the seven authored Home capabilities', () => {
    const state = createWebCompanionState()
    expect(state).toEqual({ enabled: false, topicId: 'retrieval', inviter: 'MIRO', stage: 'invite', visibility: 'open', motion: true })
    expect(createWebCompanionState()).not.toBe(state)
    expect(WEB_COMPANION_TOPICS.map(topic => topic.id)).toEqual(['retrieval', 'explanation', 'precision', 'reasoning', 'monitoring', 'transfer', 'conversation'])
    expect(WEB_COMPANION_TOPICS.map(topic => topic.dimensionId)).toEqual(['verbal_retrieval', 'clear_explanation', 'conceptual_precision', 'reasoning_aloud', 'self_monitoring', 'transfer', 'conversation_flow'])
    for (const topic of WEB_COMPANION_TOPICS) {
      expect(topic.objectives).toHaveLength(3)
      expect(topic.objectives.every(objective => objective.length > 0)).toBe(true)
      expect(topic.sampleAnswer).not.toBe('')
      expect(topic.reflection.observation).toMatch(/(?:scripted|sample|fictional) answer/i)
      expect(topic.reflection.gap).not.toBe('')
      expect(topic.reflection.nextStep).not.toBe('')
      expect(getWebCompanionTopicForDimension(topic.dimensionId)).toBe(topic)
      const invitations = (['MIRO', 'AMIRA', 'KAI'] as const).map(agentId => getWebCompanionInvitation(topic, agentId))
      expect(new Set(invitations).size).toBe(3)
      for (const invitation of invitations) expect(invitation).toContain(topic.title)
    }
    expect(getWebCompanionTopic('unknown')).toBe(WEB_COMPANION_TOPICS[0])
    expect(getWebCompanionTopicForDimension('untrusted-page-content')).toBe(WEB_COMPANION_TOPICS[0])
  })

  it('does not activate or advance without explicit enable, while harmless settings stay local', () => {
    const initial = createWebCompanionState()
    for (const type of ['open-plan', 'approve-plan', 'show-sample-answer', 'reflect', 'restart', 'minimize', 'snooze', 'reopen', 'route-left'] as const)
      expect(transitionWebCompanion(initial, { type })).toBe(initial)
    const selected = transitionWebCompanion(initial, { type: 'topic', topicId: 'reasoning' })
    const configured = transitionWebCompanion(selected, { type: 'motion', enabled: false })
    expect(configured).toMatchObject({ enabled: false, topicId: 'reasoning', motion: false, stage: 'invite' })
    expect(transitionWebCompanion(configured, { type: 'approve-plan' })).toBe(configured)
    expect(transitionWebCompanion(configured, { type: 'enable' })).toMatchObject({ enabled: true, topicId: 'reasoning', motion: false, stage: 'invite', visibility: 'open' })
  })

  it('requires the complete plan approval and sample-answer order', () => {
    const actions = ['open-plan', 'approve-plan', 'show-sample-answer', 'reflect'] as const
    const allowed = { invite: 'open-plan', plan: 'approve-plan', practice: 'show-sample-answer', answer: 'reflect', reflection: null } as const
    const next = { invite: 'plan', plan: 'practice', practice: 'answer', answer: 'reflection' } as const
    for (const stage of ['invite', 'plan', 'practice', 'answer', 'reflection'] as const) {
      const state = advanceTo(stage)
      for (const type of actions) {
        const result = transitionWebCompanion(state, { type })
        if (allowed[stage] === type) expect(result.stage).toBe(next[stage as keyof typeof next])
        else expect(result).toBe(state)
      }
    }
  })

  it.each(['minimize', 'snooze'] as const)('keeps %s quiet until an explicit reopen and blocks hidden progression', type => {
    const plan = advanceTo('plan')
    const quiet = transitionWebCompanion(plan, { type })
    expect(quiet.visibility).toBe(type === 'minimize' ? 'minimized' : 'snoozed')
    expect(quiet.stage).toBe('plan')
    for (const blocked of ['open-plan', 'approve-plan', 'show-sample-answer', 'reflect'] as const)
      expect(transitionWebCompanion(quiet, { type: blocked })).toBe(quiet)
    const reopened = transitionWebCompanion(quiet, { type: 'reopen' })
    expect(reopened).toMatchObject({ visibility: 'open', stage: 'plan' })
    expect(transitionWebCompanion(reopened, { type: 'approve-plan' }).stage).toBe('practice')
  })

  it('revokes an approved workflow when the topic changes and ignores unsupported topics', () => {
    for (const stage of ['plan', 'practice', 'answer', 'reflection'] as const) {
      const state = advanceTo(stage)
      const changed = transitionWebCompanion(state, { type: 'topic', topicId: 'explanation' })
      expect(changed).toMatchObject({ enabled: true, topicId: 'explanation', stage: 'invite' })
      expect(transitionWebCompanion(changed, { type: 'show-sample-answer' })).toBe(changed)
      expect(transitionWebCompanion(changed, { type: 'reflect' })).toBe(changed)
      expect(transitionWebCompanion(state, { type: 'topic', topicId: 'untrusted-page' } as unknown as WebCompanionAction)).toBe(state)
    }
  })

  it('route leave and restart revoke approval, including after reflection, without changing chosen settings', () => {
    const state = { ...advanceTo('reflection'), topicId: 'reasoning' as const, motion: false, visibility: 'snoozed' as const }
    for (const type of ['route-left', 'restart'] as const) {
      const result = transitionWebCompanion(state, { type })
      expect(result).toEqual({ enabled: true, topicId: 'reasoning', inviter: 'MIRO', motion: false, visibility: 'open', stage: 'invite' })
      expect(transitionWebCompanion(result, { type: 'reflect' })).toBe(result)
      expect(transitionWebCompanion(result, { type: 'approve-plan' })).toBe(result)
    }
  })

  it('disable clears all local preferences and progression rather than keeping an approved plan', () => {
    const state = { ...advanceTo('reflection'), topicId: 'reasoning' as const, motion: false }
    const disabled = transitionWebCompanion(state, { type: 'disable' })
    expect(disabled).toEqual(createWebCompanionState())
    expect(transitionWebCompanion(disabled, { type: 'reopen' })).toBe(disabled)
    expect(transitionWebCompanion(disabled, { type: 'reflect' })).toBe(disabled)
  })

  it('derives agent presence only from the guarded sample stage and performs no external IO', () => {
    const { demo, forbidden } = makeDemo()
    expect(demo.state.value.enabled).toBe(false)
    demo.dispatch({ type: 'enable' })
    expect(demo.agentId.value).toBe('MIRO')
    demo.dispatch({ type: 'reflect' })
    expect(demo.agentId.value).toBe('MIRO')
    demo.dispatch({ type: 'open-plan' })
    expect(demo.agentId.value).toBe('MIRO')
    demo.dispatch({ type: 'approve-plan' })
    expect(demo.agentId.value).toBe('AMIRA')
    demo.dispatch({ type: 'reflect' })
    expect(demo.agentId.value).toBe('AMIRA')
    demo.dispatch({ type: 'show-sample-answer' })
    expect(demo.agentId.value).toBe('KAI')
    demo.dispatch({ type: 'reflect' })
    expect(demo.state.value.stage).toBe('reflection')
    for (const effect of Object.values(forbidden)) expect(effect).not.toHaveBeenCalled()
  })

  it.each(['MIRO', 'AMIRA', 'KAI'] as const)('lets %s invite without bypassing Misu approval or scripted-answer-only Kai reflection', agentId => {
    const { demo } = makeDemo()
    demo.dispatch({ type: 'enable' })
    demo.dispatch({ type: 'inviter', agentId })
    expect(demo.agentId.value).toBe(agentId)
    expect(demo.invitation.value).toBe(getWebCompanionInvitation(demo.topic.value, agentId))
    demo.dispatch({ type: 'approve-plan' })
    demo.dispatch({ type: 'reflect' })
    expect(demo.state.value.stage).toBe('invite')
    demo.dispatch({ type: 'open-plan' })
    expect(demo.agentId.value).toBe('MIRO')
    demo.dispatch({ type: 'reflect' })
    expect(demo.state.value.stage).toBe('plan')
    demo.dispatch({ type: 'approve-plan' })
    expect(demo.agentId.value).toBe('AMIRA')
    demo.dispatch({ type: 'reflect' })
    expect(demo.state.value.stage).toBe('practice')
    demo.dispatch({ type: 'show-sample-answer' })
    expect(demo.agentId.value).toBe('KAI')
    demo.dispatch({ type: 'reflect' })
    expect(demo.state.value.stage).toBe('reflection')
  })

  it('validates inviter IDs and revokes approval without reopening a quiet companion', () => {
    const quiet = { ...advanceTo('reflection'), visibility: 'snoozed' as const }
    expect(transitionWebCompanion(quiet, { type: 'inviter', agentId: 'external-agent' } as unknown as WebCompanionAction)).toBe(quiet)
    expect(transitionWebCompanion(quiet, { type: 'inviter', agentId: 'AMIRA' })).toMatchObject({ inviter: 'AMIRA', stage: 'invite', visibility: 'snoozed' })
  })

  it('follows only known selected Home capabilities while enabled and revokes approval on a real selection change', () => {
    const { demo, growth, forbidden } = makeDemo()
    const disabled = demo.state.value
    growth.selectedDimension.value = 'self_monitoring'
    expect(demo.state.value).toEqual(disabled)
    demo.dispatch({ type: 'enable' })
    expect(demo.state.value.topicId).toBe('monitoring')
    demo.dispatch({ type: 'open-plan' })
    demo.dispatch({ type: 'approve-plan' })
    growth.selectedDimension.value = 'transfer'
    expect(demo.state.value).toMatchObject({ enabled: true, topicId: 'transfer', stage: 'invite' })
    demo.dispatch({ type: 'reflect' })
    expect(demo.state.value.stage).toBe('invite')
    demo.dispatch({ type: 'disable' })
    growth.selectedDimension.value = 'conversation_flow'
    expect(demo.state.value).toEqual(createWebCompanionState())
    for (const effect of Object.values(forbidden)) expect(effect).not.toHaveBeenCalled()
  })

  it.each(['minimize', 'snooze'] as const)('capability changes revoke %s approval without resurrecting its suggestion', type => {
    const { demo, growth } = makeDemo()
    demo.dispatch({ type: 'enable' })
    demo.dispatch({ type: 'inviter', agentId: 'KAI' })
    demo.dispatch({ type: 'open-plan' })
    demo.dispatch({ type: 'approve-plan' })
    demo.dispatch({ type })
    growth.selectedDimension.value = 'reasoning_aloud'
    expect(demo.state.value).toMatchObject({ topicId: 'reasoning', inviter: 'KAI', stage: 'invite', visibility: type === 'minimize' ? 'minimized' : 'snoozed' })
    demo.dispatch({ type: 'approve-plan' })
    demo.dispatch({ type: 'show-sample-answer' })
    expect(demo.state.value.stage).toBe('invite')
    demo.dispatch({ type: 'reopen' })
    expect(demo.agentId.value).toBe('KAI')
    expect(demo.state.value).toMatchObject({ stage: 'invite', visibility: 'open' })
  })

  it('clears enablement and sample context on owner change or logout', () => {
    const { demo, auth } = makeDemo()
    demo.dispatch({ type: 'enable' })
    demo.dispatch({ type: 'topic', topicId: 'reasoning' })
    demo.dispatch({ type: 'open-plan' })
    demo.dispatch({ type: 'approve-plan' })
    auth.me.value.profile.userId = 'different-owner'
    expect(demo.state.value).toEqual(createWebCompanionState())
    demo.dispatch({ type: 'enable' })
    auth.status.value = 'ANONYMOUS'
    expect(demo.state.value).toEqual(createWebCompanionState())
    demo.dispatch({ type: 'enable' })
    expect(demo.state.value.enabled).toBe(false)
  })

  it.each([{ owner: '' }, { fixture: false, growth: false }])('does not enable without an owner and an available Home surface: %j', options => {
    const { demo, forbidden } = makeDemo(options)
    demo.dispatch({ type: 'enable' })
    expect(demo.state.value.enabled).toBe(false)
    for (const effect of Object.values(forbidden)) expect(effect).not.toHaveBeenCalled()
  })

  it('uses no timer to reopen a dismissed, snoozed, or disabled companion', () => {
    vi.useFakeTimers()
    const { demo } = makeDemo()
    demo.dispatch({ type: 'enable' })
    for (const type of ['minimize', 'snooze', 'disable'] as const) {
      demo.dispatch({ type })
      expect(vi.getTimerCount()).toBe(0)
    }
  })

  it('keeps the launcher and Home within the existing authenticated standalone surface', () => {
    for (const route of ['/home', '/home/companion']) {
      expect(isAirStandalonePage(route)).toBe(true)
      expect(isAirPublicPage(route)).toBe(false)
    }
  })
})
