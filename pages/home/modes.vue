<script setup lang="ts">
import {
  ArrowLeft, ArrowRight, BookOpen, BriefcaseBusiness,
  Captions, Check, ChevronRight, Coffee, FileText, FlaskConical,
  Languages, Lightbulb, MessageCircle, MicOff, Pause, Play,
  RotateCcw, Sparkles, VideoOff, Volume2,
} from "lucide-vue-next";
import AminaDemoAvatar from "~/components/demo/AminaDemoAvatar.vue";
import AirsAgentPresence from "~/components/demo/AirsAgentPresence.vue";
import AirsTideUnlocks from "~/components/demo/AirsTideUnlocks.vue";
import AirsMilestoneUnlocks from "~/components/demo/AirsMilestoneUnlocks.vue";
import { aminaDemoModes, getAminaDemoMode, type DemoModeId } from "~/shared/aminaModeDemo";
import { AMINA_VOICES } from '~/shared/aminaVoices';
import { AMINA_VOICE_ASSETS, getAminaDemoAudio, hasAminaDemoAudio } from '~/shared/aminaVoiceAssets';
import { AGENT_PRESENTATION_KEY } from '~/composables/useAgentPresentation';
import "~/assets/css/amina-modes-demo.css";

useHead({ title: "Explore Amina's modes · Flowst Airs" });
const route = useRoute();
const router = useRouter();
const { available: companionDemoAvailable } = useWebCompanionDemo();
const agentPresentation = useAgentPresentation();
provide(AGENT_PRESENTATION_KEY, agentPresentation.presentation);
const selectedVoiceId = computed(() => agentPresentation.presentation.value.agents.AMIRA.voiceId);
const defaultDemoVoiceName = AMINA_VOICES.find(voice => voice.id === AMINA_VOICE_ASSETS.defaultVoiceId)?.name || 'Amina';
const demoVoiceName = computed(() => AMINA_VOICES.find(voice => voice.id === selectedVoiceId.value)?.name || defaultDemoVoiceName);
const demoVoiceOptions = computed(() => AMINA_VOICES.filter(voice => hasAminaDemoAudio(voice.id, selectedId.value)));
const modeIcons = { study: BookOpen, interview: BriefcaseBusiness, conversation: MessageCircle, language: Languages };
const modeSubtitles = { study: "A desk for your ideas", interview: "Take the next seat", conversation: "Find the words", language: "A little everyday practice" };
const selectedId = computed<DemoModeId>(() => aminaDemoModes.some(mode => mode.id === route.query.mode) ? route.query.mode as DemoModeId : "interview");
const mode = computed(() => getAminaDemoMode(selectedId.value));
const turnIndex = ref(0);
const turn = computed(() => mode.value.prompts[turnIndex.value]!);
const playing = ref(false);
const ended = ref(false);
const previewState = ref<"idle" | "listening" | "thinking" | "speaking">("idle");
const speaker = ref<"amina" | "learner">("amina");
const captionsVisible = ref(true);
const translationsVisible = ref(true);
const feedbackVisible = ref(false);
const elapsed = ref(0);
const motionEnabled = ref(true);
type ExperiencePanel = 'animation' | 'character' | 'milestones' | 'companion';
const openExperience = ref<ExperiencePanel | null>(route.query.avatar === "1" ? 'animation' : null);
const labOpen = computed(() => openExperience.value === 'animation');
const characterUnlocksOpen = computed(() => openExperience.value === 'character');
const milestonesOpen = computed(() => openExperience.value === 'milestones');
const labState = ref<"idle" | "listening" | "thinking" | "speaking">("speaking");
const labBackground = ref("studio");
const labExpression = ref<"auto" | "celebrate" | "wave">("auto");
const labStates = ["idle", "listening", "thinking", "speaking"] as const;
const sampleAudio = ref<HTMLAudioElement>();
const voiceEnabled = ref(true);
const voiceNotice = ref("");
const audioLoading = ref(false);
const paused = ref(false);
let sampleTimer: ReturnType<typeof setTimeout> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;
let generation = 0;
let audioGeneration = 0;
let timerCallback: (() => void) | undefined;
let timerRemaining = 0;
let timerStartedAt = 0;
let phase: 'amina' | 'learner' | 'thinking' = 'amina';
let pausedState: typeof previewState.value = 'idle';
const clock = computed(() => `${Math.floor(elapsed.value / 60).toString().padStart(2, "0")}:${(elapsed.value % 60).toString().padStart(2, "0")}`);
const currentCaption = computed(() => speaker.value === "learner" ? turn.value.learner : turn.value.amina);
const currentTranslation = computed(() => speaker.value === "learner" ? turn.value.learnerTranslation : turn.value.translation);
const stateLabel = computed(() => ended.value ? "Sample complete" : !playing.value ? "Ready to preview" : audioLoading.value ? 'Loading sample audio…' : ({ idle: "Sample ready", listening: "Sample learner response", thinking: "Preparing the next prompt", speaking: "Amina's sample prompt" })[previewState.value]);
const hasSelectedAudio = computed(() => hasAminaDemoAudio(selectedVoiceId.value, selectedId.value));
const audioDescription = computed(() => hasSelectedAudio.value
  ? `${demoVoiceName.value} · prerecorded Amina sample`
  : 'A recording for this voice is unavailable in this mode. Choose another voice or use captions.');

function stopPlayback() {
  generation += 1;
  if (sampleTimer) clearTimeout(sampleTimer);
  if (clockTimer) clearInterval(clockTimer);
  sampleTimer = undefined;
  clockTimer = undefined;
  timerCallback = undefined;
  timerRemaining = 0;
  audioGeneration = 0;
  audioLoading.value = false;
  if (sampleAudio.value) {
    sampleAudio.value.pause();
    sampleAudio.value.removeAttribute('src');
    sampleAudio.value.load();
  }
  paused.value = false;
  playing.value = false;
  previewState.value = "idle";
}
function delaySample(callback: () => void, duration: number, expectedGeneration: number) {
  if (sampleTimer) clearTimeout(sampleTimer);
  timerCallback = callback;
  timerRemaining = duration;
  timerStartedAt = Date.now();
  sampleTimer = setTimeout(() => {
    sampleTimer = undefined;
    timerCallback = undefined;
    timerRemaining = 0;
    if (playing.value && generation === expectedGeneration) callback();
  }, duration);
}
function showLearner(expectedGeneration: number) {
  if (!playing.value || generation !== expectedGeneration || phase !== 'amina') return;
  phase = 'learner';
  speaker.value = 'learner';
  previewState.value = 'listening';
  delaySample(() => {
    phase = 'thinking';
    previewState.value = 'thinking';
    delaySample(() => {
      if (turnIndex.value === mode.value.prompts.length - 1) {
        stopPlayback();
        ended.value = true;
        feedbackVisible.value = true;
      } else {
        turnIndex.value += 1;
        playTurn(expectedGeneration);
      }
    }, 1100, expectedGeneration);
  }, Math.max(3500, Math.min(9000, turn.value.learner.length * 45)), expectedGeneration);
}
function onAudioEnded() {
  audioLoading.value = false;
  if (audioGeneration === generation) showLearner(generation);
}
function onAudioError() {
  if (!playing.value || audioGeneration !== generation || phase !== 'amina') return;
  audioGeneration = 0;
  audioLoading.value = false;
  voiceNotice.value = 'This recording could not play. The caption preview can continue.';
  delaySample(() => showLearner(generation), Math.max(3500, Math.min(10000, turn.value.amina.length * 55)), generation);
}
function playAudio(expectedGeneration: number) {
  const result = sampleAudio.value?.play();
  void result?.catch(() => {
    if (expectedGeneration === generation && playing.value) onAudioError();
  });
}
function playTurn(expectedGeneration: number) {
  if (!playing.value || generation !== expectedGeneration) return;
  speaker.value = "amina";
  phase = 'amina';
  previewState.value = "speaking";
  const url = hasSelectedAudio.value ? getAminaDemoAudio(selectedVoiceId.value, selectedId.value, turnIndex.value) : undefined;
  if (url && sampleAudio.value) {
    audioLoading.value = true;
    previewState.value = 'idle';
    audioGeneration = expectedGeneration;
    sampleAudio.value.src = url;
    sampleAudio.value.muted = !voiceEnabled.value;
    playAudio(expectedGeneration);
  } else {
    audioGeneration = 0;
    delaySample(() => showLearner(expectedGeneration), Math.max(3500, Math.min(10000, turn.value.amina.length * 55)), expectedGeneration);
  }
}
function onAudioPlaying() {
  if (!playing.value || audioGeneration !== generation || phase !== 'amina') return;
  audioLoading.value = false;
  previewState.value = 'speaking';
}
async function changeDemoVoice(event: Event) {
  stopPlayback();
  const select = event.target as HTMLSelectElement;
  await agentPresentation.setAminaVoice(select.value || null);
  select.value = selectedVoiceId.value || '';
}
function togglePlayback() {
  if (playing.value) {
    paused.value = true;
    playing.value = false;
    pausedState = previewState.value;
    previewState.value = 'idle';
    sampleAudio.value?.pause();
    if (sampleTimer) {
      clearTimeout(sampleTimer);
      sampleTimer = undefined;
      timerRemaining = Math.max(0, timerRemaining - (Date.now() - timerStartedAt));
    }
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = undefined;
    return;
  }
  if (paused.value) {
    paused.value = false;
    playing.value = true;
    previewState.value = pausedState;
    clockTimer = setInterval(() => { elapsed.value += 1; }, 1000);
    if (timerCallback) delaySample(timerCallback, timerRemaining, generation);
    else if (audioGeneration === generation) playAudio(generation);
    return;
  }
  if (ended.value) {
    turnIndex.value = 0;
    elapsed.value = 0;
  }
  ended.value = false;
  if (labOpen.value) openExperience.value = null;
  playing.value = true;
  feedbackVisible.value = false;
  const expectedGeneration = ++generation;
  clockTimer = setInterval(() => { elapsed.value += 1; }, 1000);
  playTurn(expectedGeneration);
}
function selectTurn(index: number) {
  stopPlayback();
  turnIndex.value = index;
  speaker.value = "amina";
  ended.value = false;
}
function resetPreview() {
  selectTurn(0);
  elapsed.value = 0;
  feedbackVisible.value = false;
}
function selectMode(id: DemoModeId) {
  stopPlayback();
  void router.replace({ query: { ...route.query, mode: id } });
}
watch(selectedId, () => {
  resetPreview();
  if (labOpen.value) openExperience.value = null;
  voiceNotice.value = "";
});
watch(selectedVoiceId, resetPreview);
function toggleVoice() {
  voiceEnabled.value = !voiceEnabled.value;
  if (sampleAudio.value) sampleAudio.value.muted = !voiceEnabled.value;
  voiceNotice.value = voiceEnabled.value ? 'Sample audio is on.' : 'Sample audio is muted.';
}
function toggleExperience(panel: ExperiencePanel) {
  if (panel === 'animation') stopPlayback();
  openExperience.value = openExperience.value === panel ? null : panel;
}
async function closeExperience(panel: ExperiencePanel) {
  if (openExperience.value !== panel) return;
  openExperience.value = null;
  await nextTick();
  document.getElementById(`experience-${panel}-trigger`)?.focus({ preventScroll: true });
}
onBeforeUnmount(stopPlayback);
</script>

<template>
  <AirAppShell>
    <section class="amina-modes" aria-label="Amina mode demonstrations" :data-mode="selectedId" :style="{ '--mode-accent': mode.accent }">
      <div class="modes-demo-notice"><FlaskConical :size="16" /><span>Experience preview</span><span class="modes-notice-detail">Fictional scenarios and illustrated animation samples. No live call is connected.</span></div>
      <header class="modes-heading">
        <div><p class="modes-overline">Same Amina. A new setting.</p><h1>What would you like to practise?</h1><p>Find your voice in the conversations that matter to you.</p></div>
      </header>

      <section class="modes-study-entry" aria-label="Study mode is available now">
        <div><span class="modes-live-label"><Check :size="14" /> Available now</span><h2>Study with your own material.</h2><p>Bring a resource, choose a goal, and start a guided study session with Amina.</p></div>
        <div class="modes-study-actions"><NuxtLink class="modes-start-study" to="/home/new?mode=study">Start a study session <ArrowRight :size="17" /></NuxtLink><NuxtLink to="/home/new">See all session modes <ChevronRight :size="15" /></NuxtLink></div>
      </section>

      <AirsAgentPresence />

      <nav class="modes-switcher" aria-label="Demonstration modes">
        <button v-for="option in aminaDemoModes" :key="option.id" :aria-pressed="selectedId === option.id" :class="{ selected: selectedId === option.id }" :style="{ '--option-accent': option.accent }" @click="selectMode(option.id)">
          <component :is="modeIcons[option.id]" :size="22" /><span><strong>{{ option.navLabel }}</strong><small>{{ modeSubtitles[option.id] }}</small><span class="mode-availability" :class="{ 'is-available': option.id === 'study' }">{{ option.id === 'study' ? 'Available now · preview below' : 'Concept preview' }}</span></span><ChevronRight :size="16" class="mode-tab-arrow" />
        </button>
      </nav>

      <section class="mode-workspace" :aria-label="mode.title + ' demonstration'">
        <div class="mode-room">
          <header class="room-header"><div><span class="room-purpose">{{ mode.title }}</span><h2>{{ mode.scenarioLabel }}</h2></div><span class="room-sample-tag">Sample scenario</span></header>

          <div v-if="selectedId === 'study'" class="study-setting">
            <article class="study-source">
              <div class="source-document-label"><FileText :size="16" /> Your sample reading <span>1 / 3</span></div>
              <p class="source-chapter">Designing for people</p><h3>Start with the problem.<br />Then find the possibility.</h3>
              <p>Good design begins by understanding what someone is trying to do, where they get stuck, and why that moment matters.</p>
              <blockquote>“What does this person need?” comes before “What could we build?”</blockquote>
              <p>Observation helps us separate the problem from our first idea of a solution. A useful question opens up more than one way forward.</p>
              <footer><BookOpen :size="15" /> Fictional source excerpt · for demonstration</footer>
            </article>
            <div class="study-companion"><span class="setting-name">Your thinking partner</span><div class="study-portrait"><AminaDemoAvatar :state="previewState" :active="motionEnabled" compact /></div><strong>Amina</strong><span>One idea at a time.</span></div>
          </div>

          <div v-else-if="selectedId === 'interview'" class="interview-setting">
            <div class="interview-topline"><span><span class="presence-dot" /> Amina <small>· Interviewer</small></span><span>Interview rehearsal</span></div>
            <div class="interview-portrait"><AminaDemoAvatar :state="previewState" :active="motionEnabled" dark /></div>
            <div class="interview-subject"><span>Make room for your next chapter.</span><h3>A familiar face.<br />A fresh question.</h3></div>
            <div class="self-preview"><VideoOff :size="23" /><span>You</span><small>Camera off</small></div>
            <div class="interview-footer-label"><MicOff :size="14" /> Simulated call · no devices connected</div>
          </div>

          <div v-else-if="selectedId === 'conversation'" class="conversation-setting">
            <div class="conversation-intention"><span class="setting-name">A little rehearsal goes a long way</span><h3>You can be kind.<br />And be clear.</h3><p>Practise asking for what you need, with room to pause and try again.</p><div class="intention-note"><MessageCircle :size="19" /><span><strong>Your intention</strong>Ask for more time while keeping your manager informed.</span></div></div>
            <div class="conversation-portrait"><AminaDemoAvatar :state="previewState" :active="motionEnabled" /><span>Amina plays your manager</span></div>
          </div>

          <div v-else class="language-setting">
            <div class="cafe-copy"><span class="cafe-location"><Coffee :size="17" /> Le petit café · Paris</span><h3>Un café,<br />s’il vous plaît.</h3><p>A small conversation.<br />A lovely place to begin.</p><div class="cafe-menu"><span>Au menu</span><p><span>Un café</span><span>2,50 €</span></p><p><span>Un thé</span><span>3,00 €</span></p><p><span>Un croissant</span><span>2,00 €</span></p><small>Fictional café · sample prices</small></div></div>
            <div class="language-portrait"><AminaDemoAvatar :state="previewState" :active="motionEnabled" /><span>Amina · votre barista</span></div>
            <span class="language-level">French · A2 practice</span>
          </div>

          <div class="room-caption" :class="{ 'caption-hidden': !captionsVisible }">
            <template v-if="captionsVisible"><span class="caption-speaker"><span class="caption-dot" :class="{ 'is-playing': playing }" />{{ speaker === 'amina' ? 'Amina · sample prompt' : 'Learner · sample response' }}</span><p>{{ currentCaption }}</p><p v-if="selectedId === 'language' && translationsVisible && currentTranslation" class="caption-translation">{{ currentTranslation }}</p></template>
            <p v-else>Captions hidden. Turn them on to follow the sample.</p>
          </div>

          <footer class="room-controls">
            <audio ref="sampleAudio" preload="none" @playing="onAudioPlaying" @ended="onAudioEnded" @error="onAudioError" />
            <div class="room-playback"><button class="sample-play-button" @click="togglePlayback"><Pause v-if="playing" :size="18" /><Play v-else :size="18" />{{ playing ? 'Pause preview' : ended ? 'Replay sample' : 'Play sample' }}</button><span class="sample-clock">{{ clock }} <small>preview</small></span></div>
            <div class="room-secondary-controls"><button :aria-pressed="captionsVisible" aria-label="Show sample captions" title="Toggle captions" @click="captionsVisible = !captionsVisible"><Captions :size="20" /></button><button :aria-pressed="voiceEnabled" :disabled="!hasSelectedAudio" aria-label="Play Amina sample audio" title="Toggle Amina’s sample audio" @click="toggleVoice"><Volume2 :size="19" /></button><button aria-label="Restart sample" title="Restart sample" @click="resetPreview"><RotateCcw :size="18" /></button></div>
          </footer>
          <div class="demo-voice-choice">
            <label v-if="demoVoiceOptions.length" for="demo-amina-voice">Amina’s voice <select id="demo-amina-voice" :value="selectedVoiceId || ''" :disabled="!agentPresentation.loaded.value || agentPresentation.loading.value || agentPresentation.saving.value || agentPresentation.conflicted.value" @change="changeDemoVoice"><option value="">Default demo voice ({{ defaultDemoVoiceName }})</option><option v-if="selectedVoiceId && !hasSelectedAudio" :value="selectedVoiceId" disabled>Selected voice · recording unavailable</option><option v-for="voice in demoVoiceOptions" :key="voice.id" :value="voice.id">{{ voice.name }}</option></select></label>
            <p>{{ audioDescription }}</p>
            <p v-if="agentPresentation.error.value" role="alert">{{ agentPresentation.error.value }} <button type="button" :disabled="agentPresentation.loading.value || agentPresentation.saving.value" @click="agentPresentation.refresh(true)">Reload choices</button></p>
          </div>
          <p class="preview-runtime-status" role="status">{{ stateLabel }}<span v-if="voiceNotice"> · {{ voiceNotice }}</span></p>
        </div>

        <aside class="mode-context">
          <header><span class="context-icon"><component :is="modeIcons[selectedId]" :size="21" /></span><div><p>Your practice space</p><h3>{{ mode.contextLabel }}</h3></div></header>
          <p class="context-detail">{{ mode.contextDetail }}</p>
          <div class="context-goal"><span>What you’re here for</span><p>{{ mode.goal }}</p></div>
          <div class="context-sources"><h4>{{ selectedId === 'study' ? 'On the desk' : selectedId === 'interview' ? 'In your interview brief' : selectedId === 'conversation' ? 'Setting the scene' : 'A little context' }}</h4><div v-for="source in mode.sourceItems" :key="source.name" class="context-source"><FileText :size="17" /><span><strong>{{ source.name }}</strong><small>{{ source.detail }}</small></span></div></div>
          <div class="context-exchanges"><h4>Explore the exchange <span>{{ turnIndex + 1 }} / {{ mode.prompts.length }}</span></h4><button v-for="(sample, index) in mode.prompts" :key="sample.amina" :aria-pressed="turnIndex === index" @click="selectTurn(index)"><span>{{ index + 1 }}</span><span>{{ sample.amina }}</span><ChevronRight :size="15" /></button></div>
          <button v-if="selectedId === 'language'" class="context-text-button" :aria-pressed="translationsVisible" @click="translationsVisible = !translationsVisible"><Languages :size="17" />{{ translationsVisible ? 'Hide English translation' : 'Show English translation' }}</button>
          <button class="context-feedback-button" :aria-expanded="feedbackVisible" aria-controls="sample-feedback" @click="feedbackVisible = !feedbackVisible"><Lightbulb :size="18" />{{ feedbackVisible ? 'Hide sample reflection' : 'See a sample reflection' }}<ChevronRight :size="15" /></button>
          <div v-if="feedbackVisible" id="sample-feedback" class="sample-feedback"><strong>About this fictional answer</strong><p>{{ turn.feedback }}</p><small>This reflects the scripted response, not your performance.</small></div>
          <p class="context-footnote">These examples show how Amina could adapt. Nothing here is recorded or saved to your learning history.</p>
        </aside>
      </section>

      <div class="modes-bottom-note"><span><Check :size="16" /> Four settings. One familiar companion.</span></div>

      <section class="experience-disclosures" aria-label="Explore the Airs experience">
        <h2>A little more to explore</h2>
        <div class="experience-disclosure" data-experience="animation">
          <button id="experience-animation-trigger" type="button" class="experience-disclosure-trigger" :aria-expanded="labOpen" aria-controls="amina-animation-lab" @click="toggleExperience('animation')"><span>Animation experience</span><ChevronRight :size="17" aria-hidden="true" /></button>
          <section v-if="labOpen" id="amina-animation-lab" class="animation-lab experience-panel" aria-labelledby="animation-lab-heading">
        <header class="lab-heading"><div><span class="lab-label"><Sparkles :size="17" /> Animation experience</span><h2 id="animation-lab-heading">A little more presence.</h2><p>Explore Amina’s half-body talking simulation and gesture samples.</p></div><button type="button" class="modes-outline-button" @click="closeExperience('animation')">Close animation experience</button></header>
        <div class="lab-layout">
          <div class="lab-stage" :data-background="labBackground"><AminaDemoAvatar :state="labState" :active="motionEnabled" :expression="labExpression" :dark="labBackground === 'night'" /><span class="lab-stage-caption">Animated expression sample · simulated speech</span></div>
          <div class="lab-controls"><h3>Try her conversation states</h3><p>Illustrated mouth shapes and expression frames bring this sample to life. Speech motion is approximate; this is not a connected AI call.</p><div class="lab-state-options" aria-label="Preview animation state"><button v-for="state in labStates" :key="state" :aria-pressed="labState === state && labExpression === 'auto'" @click="labState = state; labExpression = 'auto'">{{ state }}</button></div><div class="lab-gesture-options"><button :aria-pressed="labExpression === 'wave'" @click="labExpression = 'wave'">A little hello</button><button :aria-pressed="labExpression === 'celebrate'" @click="labExpression = 'celebrate'">Celebrate together</button></div><label class="lab-motion-control"><input v-model="motionEnabled" type="checkbox" /> Animate the illustration <span>Respects reduced motion</span></label>
          </div>
        </div>
          </section>
        </div>

        <div class="experience-disclosure" data-experience="character">
          <button id="experience-character-trigger" type="button" class="experience-disclosure-trigger" :aria-expanded="characterUnlocksOpen" aria-controls="airs-character-unlocks" @click="toggleExperience('character')"><span>Character unlocks</span><ChevronRight :size="17" aria-hidden="true" /></button>
          <section v-if="characterUnlocksOpen" id="airs-character-unlocks" class="experience-panel" aria-labelledby="character-unlocks-heading">
        <header class="lab-heading"><div><span class="lab-label"><Coffee :size="17" /> Character unlocks</span><h2 id="character-unlocks-heading">Make the space yours.</h2><p>Preview expressive faces for small avatars, plus optional room settings. Cosmetic samples only.</p></div><button type="button" class="modes-outline-button" @click="closeExperience('character')">Close character unlocks</button></header>
        <AirsTideUnlocks />
          </section>
        </div>

        <div class="experience-disclosure" data-experience="milestones">
          <button id="experience-milestones-trigger" type="button" class="experience-disclosure-trigger" :aria-expanded="milestonesOpen" aria-controls="airs-milestone-unlocks" @click="toggleExperience('milestones')"><span>Milestones &amp; share cards</span><ChevronRight :size="17" aria-hidden="true" /></button>
          <section v-if="milestonesOpen" id="airs-milestone-unlocks" class="experience-panel" aria-labelledby="milestones-heading">
        <header class="lab-heading"><div><span class="lab-label"><Check :size="17" /> Milestones &amp; share cards</span><h2 id="milestones-heading">Give the small steps a moment.</h2><p>Explore milestone examples and a sample share card.</p></div><button type="button" class="modes-outline-button" @click="closeExperience('milestones')">Close milestones and share cards</button></header>
        <AirsMilestoneUnlocks />
          </section>
        </div>

        <div v-if="companionDemoAvailable" class="experience-disclosure" data-experience="companion">
          <button id="experience-companion-trigger" type="button" class="experience-disclosure-trigger" :aria-expanded="openExperience === 'companion'" aria-controls="airs-home-companion-preview" @click="toggleExperience('companion')"><span>Companion on Home</span><ChevronRight :size="17" aria-hidden="true" /></button>
          <section v-if="openExperience === 'companion'" id="airs-home-companion-preview" class="experience-panel companion-experience-intro" aria-labelledby="home-companion-heading">
            <h2 id="home-companion-heading">A little company, right on Home.</h2>
            <p>Try a floating companion with a gentle study invitation and an optional sample walkthrough. This concept preview stays off until you enable it.</p>
            <NuxtLink class="modes-companion-link" to="/home/companion">Try your companion on Home <ArrowRight :size="16" aria-hidden="true" /></NuxtLink>
          </section>
        </div>
      </section>
      <NuxtLink class="modes-return-link" to="/home"><ArrowLeft :size="16" /> Back to your Airs home</NuxtLink>
    </section>
  </AirAppShell>
</template>
