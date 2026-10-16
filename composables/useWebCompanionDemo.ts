import { createWebCompanionState, getWebCompanionInvitation, getWebCompanionTopic, getWebCompanionTopicForDimension, transitionWebCompanion, type WebCompanionAction, type WebCompanionState } from '~/shared/webCompanionDemo';
import type { CompanionMotionAgentId, CompanionMotionStateId } from '~/shared/companionMotion';

export function useWebCompanionDemo() {
  const auth = useAuth();
  const growth = useAirGrowth();
  const config = useRuntimeConfig().public;
  const available = computed(() => config.studySourceFixtureMode === true || config.airGrowthEnabled === true);
  const ownerId = computed(() => auth.status.value === 'AUTHENTICATED' ? auth.me.value?.profile.userId || '' : '');
  const store = useState<{ ownerId: string; state: WebCompanionState }>('airs-web-companion-demo-v2', () => ({ ownerId: '', state: createWebCompanionState() }));
  watch(ownerId, owner => {
    if (store.value.ownerId !== owner) store.value = { ownerId: owner, state: createWebCompanionState() };
  }, { immediate: true, flush: 'sync' });
  const state = computed(() => store.value.state);
  const topic = computed(() => getWebCompanionTopic(state.value.topicId));
  const invitation = computed(() => getWebCompanionInvitation(topic.value, state.value.inviter));
  const agentId = computed<CompanionMotionAgentId>(() => state.value.stage === 'invite' ? state.value.inviter : state.value.stage === 'plan' ? 'MIRO' : state.value.stage === 'practice' ? 'AMIRA' : 'KAI');
  const motionState = computed<CompanionMotionStateId>(() => state.value.stage === 'plan' || state.value.stage === 'reflection' ? 'thinking' : state.value.stage === 'practice' ? 'listening' : 'greeting');
  function dispatch(action: WebCompanionAction) {
    if (!ownerId.value || !available.value) return;
    const current = action.type === 'enable'
      ? transitionWebCompanion(store.value.state, { type: 'topic', topicId: getWebCompanionTopicForDimension(growth.selectedDimension.value).id })
      : store.value.state;
    store.value = { ownerId: ownerId.value, state: transitionWebCompanion(current, action) };
  }
  watch(growth.selectedDimension, dimensionId => {
    const nextTopic = getWebCompanionTopicForDimension(dimensionId);
    if (state.value.enabled && state.value.topicId !== nextTopic.id) dispatch({ type: 'topic', topicId: nextTopic.id });
  }, { flush: 'sync' });
  return { state, topic, invitation, agentId, motionState, available, dispatch };
}
