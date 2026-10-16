<script setup lang="ts">
import { ArrowRight, Moon, RotateCcw, Settings2, X } from 'lucide-vue-next';
import CompanionMotionAvatar from '~/components/demo/CompanionMotionAvatar.vue';
import { FLOWST_AGENTS } from '~/shared/agents';
import type { WebCompanionAction } from '~/shared/webCompanionDemo';
import '~/assets/css/airs-web-companion.css';

const { state, topic, invitation, agentId, motionState, available, dispatch } = useWebCompanionDemo();
const identity = computed(() => FLOWST_AGENTS[agentId.value]);
const heading = ref<HTMLElement>();
const reopenButton = ref<HTMLButtonElement>();
const optionsButton = ref<HTMLButtonElement>();
const motionInput = ref<HTMLInputElement>();
const optionsOpen = ref(false);
const optionsId = `web-companion-options-${useId()}`;
const cloudVisible = computed(() => state.value.visibility === 'open' || optionsOpen.value);
const expanded = computed(() => cloudVisible.value && (state.value.stage !== 'invite' || optionsOpen.value));
const inviters = ['MIRO', 'AMIRA', 'KAI'] as const;
const stageHeading = computed(() => ({
  invite: identity.value.name,
  plan: 'Your sample practice plan',
  practice: 'An idea to explain with Amina',
  answer: 'A fictional answer to explore',
  reflection: 'Kai’s sample reflection',
})[state.value.stage]);

async function advance(action: WebCompanionAction) {
  optionsOpen.value = false;
  dispatch(action);
  await nextTick();
  heading.value?.focus({ preventScroll: true });
}

async function hideSuggestion(type: 'minimize' | 'snooze') {
  optionsOpen.value = false;
  dispatch({ type });
  await nextTick();
  reopenButton.value?.focus({ preventScroll: true });
}

async function closeOptions() {
  optionsOpen.value = false;
  await nextTick();
  optionsButton.value?.focus({ preventScroll: true });
}

async function toggleOptions() {
  if (optionsOpen.value) return closeOptions();
  optionsOpen.value = true;
  await nextTick();
  motionInput.value?.focus({ preventScroll: true });
}

function toggleMotion(event: Event) {
  const checkbox = event.target as HTMLInputElement;
  dispatch({ type: 'motion', enabled: checkbox.checked });
  checkbox.checked = state.value.motion;
}

async function turnOff() {
  optionsOpen.value = false;
  dispatch({ type: 'disable' });
  await nextTick();
  document.getElementById('main-content')?.focus({ preventScroll: true });
}

onBeforeUnmount(() => dispatch({ type: 'route-left' }));
</script>

<template>
  <section v-if="state.enabled && available" class="web-companion" data-testid="web-companion" :data-stage="state.stage" :data-agent="agentId" :data-visibility="state.visibility" :data-topic="state.topicId" :data-options-open="optionsOpen" :data-expanded="expanded" :style="{ '--web-companion-character': identity.color }" aria-label="Website companion concept preview">
    <div v-if="cloudVisible" class="web-companion__cloud">
      <div class="web-companion__speech">
        <header class="web-companion__header">
          <div><h2 ref="heading" tabindex="-1">{{ optionsOpen ? 'Companion options' : stageHeading }}</h2><span>Home companion · Concept preview</span></div>
          <button v-if="optionsOpen" type="button" class="web-companion__icon-button" aria-label="Close companion options" @click="closeOptions"><X :size="17" aria-hidden="true" /></button>
          <button v-else type="button" class="web-companion__icon-button" aria-label="Dismiss suggestion" title="Dismiss suggestion" @click="hideSuggestion('minimize')"><X :size="17" aria-hidden="true" /></button>
        </header>

        <div class="web-companion__body">
          <template v-if="state.visibility === 'open' && !optionsOpen">
            <div v-if="state.stage === 'invite'" class="web-companion__content web-companion__invitation">
              <p>{{ invitation }}</p>
              <div class="web-companion__invite-actions">
                <NuxtLink class="web-companion-button web-companion-button--primary" to="/home/new?mode=study">Start a study session <ArrowRight :size="15" aria-hidden="true" /></NuxtLink>
                <button type="button" class="web-companion-text-button" @click="advance({ type: 'open-plan' })">Preview a sample</button>
              </div>
            </div>

            <div v-else-if="state.stage === 'plan'" class="web-companion__content">
              <p>A prepared sample plan for <strong>{{ topic.title }}</strong>. Review it before moving to Amina’s prompt.</p>
              <ol class="web-companion__objectives"><li v-for="objective in topic.objectives" :key="objective">{{ objective }}</li></ol>
              <button type="button" class="web-companion-button web-companion-button--primary" @click="advance({ type: 'approve-plan' })">Approve sample plan <ArrowRight :size="15" aria-hidden="true" /></button>
            </div>

            <div v-else-if="state.stage === 'practice'" class="web-companion__content">
              <span class="web-companion__sample-label">Sample teach-back prompt</span>
              <p class="web-companion__prompt">{{ topic.prompt }}</p>
              <p class="web-companion__hint">Think it through, or explore a fictional answer. No microphone or answer collection in this demo.</p>
              <button type="button" class="web-companion-button web-companion-button--primary" @click="advance({ type: 'show-sample-answer' })">Show sample answer <ArrowRight :size="15" aria-hidden="true" /></button>
            </div>

            <div v-else-if="state.stage === 'answer'" class="web-companion__content">
              <span class="web-companion__sample-label">Fictional learner answer</span>
              <blockquote>{{ topic.sampleAnswer }}</blockquote>
              <p>Want a reflection on this sample? It’s not an assessment of you.</p>
              <button type="button" class="web-companion-button web-companion-button--primary" @click="advance({ type: 'reflect' })">Show sample reflection <ArrowRight :size="15" aria-hidden="true" /></button>
            </div>

            <div v-else class="web-companion__content">
              <p class="web-companion__hint">Prepared feedback on the fictional answer only—not a judgment of your understanding.</p>
              <dl class="web-companion__reflection">
                <div><dt>What the sample shows</dt><dd>{{ topic.reflection.observation }}</dd></div>
                <div><dt>What it doesn’t show yet</dt><dd>{{ topic.reflection.gap }}</dd></div>
                <div><dt>A possible next step</dt><dd>{{ topic.reflection.nextStep }}</dd></div>
              </dl>
            </div>
          </template>

          <div v-if="optionsOpen" :id="optionsId" class="web-companion__options" aria-label="Companion options">
            <div class="web-companion__controls">
              <label class="web-companion__motion"><input ref="motionInput" type="checkbox" :checked="state.motion" @change="toggleMotion" /><span>Animate companion</span></label>
              <button type="button" class="web-companion-text-button" @click="advance({ type: 'restart' })"><RotateCcw :size="14" aria-hidden="true" /> Restart demo</button>
              <button type="button" class="web-companion-text-button" @click="hideSuggestion('snooze')"><Moon :size="14" aria-hidden="true" /> Snooze companion</button>
              <button type="button" class="web-companion-text-button" @click="turnOff">Turn off companion</button>
            </div>
            <details class="web-companion__scope"><summary>What this preview uses</summary><p>{{ topic.context }}</p><p>Only the capability selected on this Airs Home page—not other websites or hidden browsing. Changing capability or leaving Home resets the sample plan.</p><p>No microphone, answer collection, saved learning progress or Tides. Not a browser extension.</p></details>
          </div>
        </div>
        <p v-if="state.stage !== 'invite' && state.visibility === 'open'" class="web-companion__disclosure">Sample walkthrough · No progress or Tides saved.</p>
      </div>
    </div>

    <div class="web-companion__mascot-row">
      <div v-if="state.stage === 'invite' && state.visibility === 'open'" class="web-companion__inviters" role="group" aria-label="Choose who invites you">
        <button v-for="inviter in inviters" :key="inviter" type="button" :aria-label="`Invite with ${FLOWST_AGENTS[inviter].name}`" :aria-pressed="state.inviter === inviter" :title="FLOWST_AGENTS[inviter].name" @click="dispatch({ type: 'inviter', agentId: inviter })"><CompanionMotionAvatar :agent="inviter" state="idle" :active="false" thumbnail :label="`${FLOWST_AGENTS[inviter].name} face illustration`" /></button>
      </div>
      <span v-else-if="state.visibility !== 'open'" class="web-companion__quiet-label">{{ state.visibility === 'snoozed' ? 'Snoozed' : 'Here when you need me' }}</span>
      <button ref="optionsButton" type="button" class="web-companion__icon-button web-companion__gear" aria-label="Companion options" title="Companion options" :aria-expanded="optionsOpen" :aria-controls="optionsId" @click="toggleOptions"><Settings2 :size="18" aria-hidden="true" /></button>
      <button v-if="state.visibility !== 'open'" ref="reopenButton" type="button" class="web-companion__head web-companion__head-button" aria-label="Reopen companion" title="Reopen companion" @click="advance({ type: 'reopen' })"><CompanionMotionAvatar :agent="agentId" :state="motionState" :active="false" :label="`${identity.name} · illustrated face in a concept preview`" /></button>
      <div v-else class="web-companion__head"><CompanionMotionAvatar :agent="agentId" :state="motionState" :active="state.motion" :label="`${identity.name} · illustrated face in a concept preview`" /></div>
    </div>
  </section>
</template>
