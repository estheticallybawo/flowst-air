<script setup lang="ts">
import { ArrowLeft, ArrowRight, Check, Home, Sparkles } from 'lucide-vue-next';
import CompanionMotionAvatar from '~/components/demo/CompanionMotionAvatar.vue';
import { AGENT_PRESENTATION_KEY } from '~/composables/useAgentPresentation';
import '~/assets/css/airs-web-companion.css';

useHead({ title: 'Your companion on Home · Flowst Airs' });
const { state, available, dispatch } = useWebCompanionDemo();
const presentation = useAgentPresentation();
provide(AGENT_PRESENTATION_KEY, presentation.presentation);
const companions = [
  { id: 'MIRO', name: 'Misu', step: 'A little plan', description: 'Review three sample objectives before moving on.' },
  { id: 'AMIRA', name: 'Amina', step: 'An idea to explain', description: 'Try a teach-back prompt, or reveal a fictional answer.' },
  { id: 'KAI', name: 'Kai', step: 'A moment to reflect', description: 'Choose to explore feedback on that sample answer.' },
] as const;

function toggleDemo(event: Event) {
  const checkbox = event.target as HTMLInputElement;
  dispatch({ type: checkbox.checked ? 'enable' : 'disable' });
  checkbox.checked = state.value.enabled;
}

function guardHomeLink(event: MouseEvent) {
  if (!available.value || !state.value.enabled) event.preventDefault();
}
</script>

<template>
  <AirAppShell>
    <section class="web-companion-launcher" aria-labelledby="web-companion-launcher-title">
      <NuxtLink class="web-companion-back" to="/home/modes"><ArrowLeft :size="16" aria-hidden="true" /> Back to mode demos</NuxtLink>
      <p class="web-companion-eyebrow"><Sparkles :size="15" aria-hidden="true" /> Website companion · Concept preview</p>
      <div class="web-companion-launcher__grid">
        <div class="web-companion-launcher__intro">
          <h1 id="web-companion-launcher-title">A little company.<br />Right here on Home.</h1>
          <p class="web-companion-launcher__lede">Try your companion on Home. A small, animated face and a gentle suggestion—without leaving the page.</p>
          <p>Misu helps you review a sample plan, Amina offers a practice prompt, and Kai shares an optional reflection on a fictional answer. You choose every step.</p>

          <div v-if="available" class="web-companion-launcher__activation">
            <label class="web-companion-enable">
              <input type="checkbox" :checked="state.enabled" aria-label="Enable companion demo" aria-describedby="web-companion-enable-description" @change="toggleDemo" />
              <span><strong>Enable companion demo</strong><small>{{ state.enabled ? 'Ready to meet you on Home.' : 'Off until you choose to turn it on.' }}</small></span>
            </label>
            <p id="web-companion-enable-description">This enables the preview on your Airs Home only. It resets when you reload the website.</p>
            <NuxtLink class="web-companion-button web-companion-button--primary web-companion-launcher__go" to="/home" :aria-disabled="!state.enabled" :tabindex="state.enabled ? undefined : -1" @click="guardHomeLink"><Home :size="17" aria-hidden="true" /> Go to Home <ArrowRight :size="17" aria-hidden="true" /></NuxtLink>
            <span class="web-companion-launcher__state" role="status"><Check v-if="state.enabled" :size="14" aria-hidden="true" />{{ state.enabled ? 'Companion demo enabled' : 'Enable the demo to continue' }}</span>
          </div>
          <div v-else class="web-companion-launcher__unavailable" role="status">
            <strong>This preview needs Growth Home.</strong>
            <p>Growth Home is not available in this version. You can still explore the other mode demos.</p>
            <NuxtLink class="web-companion-button" to="/home/modes">Explore mode demos <ArrowRight :size="16" aria-hidden="true" /></NuxtLink>
          </div>
        </div>

        <aside class="web-companion-launcher__preview" aria-labelledby="web-companion-preview-title">
          <div class="web-companion-launcher__preview-heading"><span class="web-companion-eyebrow">The idea, in three small moments</span><h2 id="web-companion-preview-title">Your pace.<br />Your little team.</h2></div>
          <ol class="web-companion-launcher__team">
            <li v-for="companion in companions" :key="companion.id">
              <div class="web-companion-launcher__face"><CompanionMotionAvatar :agent="companion.id" state="greeting" :active="false" thumbnail :label="`${companion.name} · face illustration`" /></div>
              <div><span class="web-companion-launcher__name">{{ companion.name }}</span><h3>{{ companion.step }}</h3><p>{{ companion.description }}</p></div>
            </li>
          </ol>
          <div class="web-companion-launcher__preview-note"><Sparkles :size="17" aria-hidden="true" /><span>A small face beside the page. Not another chat window.</span></div>
        </aside>
      </div>

      <footer class="web-companion-launcher__scope">
        <strong>Concept preview · This website only · Not a browser extension</strong>
        <p>Prepared Home-page topics, not automatic browsing awareness. No microphone or answer collection. This walkthrough does not save learning progress or award Tides. Dismiss, snooze or turn it off whenever you like.</p>
      </footer>
    </section>
  </AirAppShell>
</template>
