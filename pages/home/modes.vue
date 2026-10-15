<script setup lang="ts">
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Captions,
  Check,
  ChevronRight,
  Coffee,
  FileText,
  FlaskConical,
  Languages,
  Lightbulb,
  MessageCircle,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  VideoOff,
  Volume2,
} from "lucide-vue-next";
import AminaDemoAvatar from "~/components/demo/AminaDemoAvatar.vue";
import AirsAgentPresence from "~/components/demo/AirsAgentPresence.vue";
import AirsTideUnlocks from "~/components/demo/AirsTideUnlocks.vue";
import AirsMilestoneUnlocks from "~/components/demo/AirsMilestoneUnlocks.vue";
import {
  aminaDemoModes,
  getAminaDemoMode,
  type DemoModeId,
} from "~/shared/aminaModeDemo";
import "~/assets/css/amina-modes-demo.css";

useHead({ title: "Explore Amina's modes · Flowst Airs" });
const route = useRoute();
const router = useRouter();
const modeIcons = {
  study: BookOpen,
  interview: BriefcaseBusiness,
  conversation: MessageCircle,
  language: Languages,
};
const modeSubtitles = {
  study: "A desk for your ideas",
  interview: "Take the next seat",
  conversation: "Find the words",
  language: "A little everyday practice",
};
const selectedId = computed<DemoModeId>(() =>
  aminaDemoModes.some((mode) => mode.id === route.query.mode)
    ? (route.query.mode as DemoModeId)
    : "interview",
);
const mode = computed(() => getAminaDemoMode(selectedId.value));
const turnIndex = ref(0);
const turn = computed(() => mode.value.prompts[turnIndex.value]!);
const playing = ref(false);
const ended = ref(false);
const previewState = ref<"idle" | "listening" | "thinking" | "speaking">(
  "idle",
);
const speaker = ref<"amina" | "learner">("amina");
const captionsVisible = ref(true);
const translationsVisible = ref(true);
const feedbackVisible = ref(false);
const elapsed = ref(0);
const motionEnabled = ref(true);
const labOpen = ref(route.query.avatar === "1");
const characterUnlocksOpen = ref(false);
const milestonesOpen = ref(false);
const labState = ref<"idle" | "listening" | "thinking" | "speaking">(
  "speaking",
);
const labBackground = ref("studio");
const labExpression = ref<"auto" | "celebrate" | "wave">("auto");
const labStates = ["idle", "listening", "thinking", "speaking"] as const;
const labElement = ref<HTMLElement>();
const characterUnlocksHeading = ref<HTMLElement>();
const milestonesHeading = ref<HTMLElement>();
const localVoices = ref<SpeechSynthesisVoice[]>([]);
const voiceEnabled = ref(false);
const voiceNotice = ref("");
const synthesisAvailable = ref(false);
let sampleTimer: ReturnType<typeof setTimeout> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;
let generation = 0;
const clock = computed(
  () =>
    `${Math.floor(elapsed.value / 60)
      .toString()
      .padStart(2, "0")}:${(elapsed.value % 60).toString().padStart(2, "0")}`,
);
const currentCaption = computed(() =>
  speaker.value === "learner" ? turn.value.learner : turn.value.amina,
);
const currentTranslation = computed(() =>
  speaker.value === "learner"
    ? turn.value.learnerTranslation
    : turn.value.translation,
);
const stateLabel = computed(() =>
  ended.value
    ? "Sample complete"
    : !playing.value
      ? "Ready to preview"
      : {
          idle: "Sample ready",
          listening: "Sample learner response",
          thinking: "Preparing the next prompt",
          speaking: "Amina's sample prompt",
        }[previewState.value],
);
const availableVoice = computed(() =>
  localVoices.value.find((voice) =>
    voice.lang
      .toLowerCase()
      .startsWith(selectedId.value === "language" ? "fr" : "en"),
  ),
);

function stopPlayback() {
  generation += 1;
  if (sampleTimer) clearTimeout(sampleTimer);
  if (clockTimer) clearInterval(clockTimer);
  sampleTimer = undefined;
  clockTimer = undefined;
  if (import.meta.client && synthesisAvailable.value)
    window.speechSynthesis.cancel();
  playing.value = false;
  previewState.value = "idle";
}
function delaySample(
  callback: () => void,
  duration: number,
  expectedGeneration: number,
) {
  if (sampleTimer) clearTimeout(sampleTimer);
  sampleTimer = setTimeout(() => {
    if (playing.value && generation === expectedGeneration) callback();
  }, duration);
}
function playTurn(expectedGeneration: number) {
  if (!playing.value || generation !== expectedGeneration) return;
  speaker.value = "amina";
  previewState.value = "speaking";
  let advanced = false;
  const showLearner = () => {
    if (advanced || !playing.value || generation !== expectedGeneration) return;
    advanced = true;
    speaker.value = "learner";
    previewState.value = "listening";
    delaySample(
      () => {
        previewState.value = "thinking";
        delaySample(
          () => {
            if (turnIndex.value === mode.value.prompts.length - 1) {
              stopPlayback();
              ended.value = true;
              feedbackVisible.value = true;
            } else {
              turnIndex.value += 1;
              playTurn(expectedGeneration);
            }
          },
          1100,
          expectedGeneration,
        );
      },
      Math.max(3500, Math.min(9000, turn.value.learner.length * 45)),
      expectedGeneration,
    );
  };
  if (voiceEnabled.value && availableVoice.value && synthesisAvailable.value) {
    const utterance = new SpeechSynthesisUtterance(turn.value.amina);
    utterance.voice = availableVoice.value;
    utterance.lang = availableVoice.value.lang;
    utterance.rate = selectedId.value === "language" ? 0.88 : 0.96;
    utterance.onend = showLearner;
    utterance.onerror = () => {
      if (generation !== expectedGeneration) return;
      voiceNotice.value =
        "Sample audio is unavailable. The caption preview can continue.";
      showLearner();
    };
    window.speechSynthesis.speak(utterance);
    delaySample(
      () => {
        window.speechSynthesis.cancel();
        showLearner();
      },
      25000,
      expectedGeneration,
    );
  } else {
    delaySample(
      showLearner,
      Math.max(3500, Math.min(10000, turn.value.amina.length * 55)),
      expectedGeneration,
    );
  }
}
function togglePlayback() {
  if (playing.value) {
    stopPlayback();
    return;
  }
  if (ended.value) {
    turnIndex.value = 0;
    elapsed.value = 0;
  }
  ended.value = false;
  labOpen.value = false;
  playing.value = true;
  feedbackVisible.value = false;
  const expectedGeneration = ++generation;
  clockTimer = setInterval(() => {
    elapsed.value += 1;
  }, 1000);
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
  labOpen.value = false;
  voiceEnabled.value = false;
  voiceNotice.value = "";
});
function toggleVoice() {
  stopPlayback();
  if (!availableVoice.value) {
    voiceNotice.value = `This browser has no local ${selectedId.value === "language" ? "French" : "English"} voice. Use the animated caption preview instead.`;
    return;
  }
  voiceEnabled.value = !voiceEnabled.value;
  voiceNotice.value = voiceEnabled.value
    ? "A local browser voice will read Amina's sample lines. This is not her production voice."
    : "Sample audio is off.";
}
async function openLab() {
  stopPlayback();
  labOpen.value = !labOpen.value;
  if (labOpen.value) {
    await nextTick();
    labElement.value?.focus({ preventScroll: true });
    labElement.value?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
}
async function toggleCharacterUnlocks() {
  characterUnlocksOpen.value = !characterUnlocksOpen.value;
  if (characterUnlocksOpen.value) {
    await nextTick();
    characterUnlocksHeading.value?.focus({ preventScroll: true });
    characterUnlocksHeading.value?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
}
async function toggleMilestones() {
  milestonesOpen.value = !milestonesOpen.value;
  if (milestonesOpen.value) {
    await nextTick();
    milestonesHeading.value?.focus({ preventScroll: true });
    milestonesHeading.value?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
}
async function closeExperience(
  panel: "animation" | "character" | "milestones",
) {
  const panelIds = {
    animation: "amina-animation-lab",
    character: "airs-character-unlocks",
    milestones: "airs-milestone-unlocks",
  };
  if (panel === "animation") labOpen.value = false;
  if (panel === "character") characterUnlocksOpen.value = false;
  if (panel === "milestones") milestonesOpen.value = false;
  await nextTick();
  document
    .querySelector<HTMLButtonElement>(
      `.experience-entry[aria-controls="${panelIds[panel]}"]`,
    )
    ?.focus({ preventScroll: true });
}
onMounted(() => {
  synthesisAvailable.value = "speechSynthesis" in window;
  const updateVoices = () => {
    localVoices.value = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.localService);
  };
  if (synthesisAvailable.value) {
    updateVoices();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    onBeforeUnmount(() =>
      window.speechSynthesis.removeEventListener("voiceschanged", updateVoices),
    );
  }
});
onBeforeUnmount(stopPlayback);
</script>

<template>
  <AirAppShell>
    <section
      class="amina-modes"
      aria-label="Amina mode demonstrations"
      :data-mode="selectedId"
      :style="{ '--mode-accent': mode.accent }"
    >
      <div class="modes-demo-notice">
        <FlaskConical :size="16" /><span>Experience preview</span
        ><span class="modes-notice-detail"
          >Fictional scenarios and illustration samples. Live avatar calling is
          not enabled.</span
        >
      </div>
      <header class="modes-heading">
        <div>
          <p class="modes-overline">Same Amina. A new setting.</p>
          <h1>What would you like to practise?</h1>
          <p>Find your voice in the conversations that matter to you.</p>
        </div>
        <button
          class="modes-outline-button"
          :aria-expanded="labOpen"
          aria-controls="amina-animation-lab"
          @click="openLab"
        >
          <Sparkles :size="17" /> Explore her animation <ArrowDown :size="15" />
        </button>
      </header>

      <section
        class="modes-study-entry"
        aria-label="Study mode is available now"
      >
        <div>
          <span class="modes-live-label"
            ><Check :size="14" /> Available now</span
          >
          <h2>Study with your own material.</h2>
          <p>
            Bring a resource, choose a goal, and start a guided study session
            with Amina.
          </p>
        </div>
        <div class="modes-study-actions">
          <NuxtLink class="modes-start-study" to="/home/new?mode=study"
            >Start a study session <ArrowRight :size="17" /></NuxtLink
          ><NuxtLink to="/home/new"
            >See all session modes <ChevronRight :size="15"
          /></NuxtLink>
        </div>
      </section>

      <AirsAgentPresence />

      <nav
        class="experience-entry-grid"
        aria-label="Explore the Airs experience"
      >
        <button
          type="button"
          class="experience-entry"
          :aria-expanded="labOpen"
          aria-controls="amina-animation-lab"
          @click="openLab"
        >
          <span class="experience-entry-icon"><Sparkles :size="21" /></span
          ><span class="experience-entry-copy"
            ><strong>Animation experience</strong
            ><small
              >Meet Amina’s illustrated expressions and conversation
              states.</small
            ></span
          ><ArrowDown :size="17" />
        </button>
        <button
          type="button"
          class="experience-entry"
          :aria-expanded="characterUnlocksOpen"
          aria-controls="airs-character-unlocks"
          @click="toggleCharacterUnlocks"
        >
          <span class="experience-entry-icon"><Coffee :size="21" /></span
          ><span class="experience-entry-copy"
            ><strong>Character unlocks</strong
            ><small
              >Try companion looks and new places to practise.</small
            ></span
          ><ArrowDown :size="17" />
        </button>
        <button
          type="button"
          class="experience-entry"
          :aria-expanded="milestonesOpen"
          aria-controls="airs-milestone-unlocks"
          @click="toggleMilestones"
        >
          <span class="experience-entry-icon"><Check :size="21" /></span
          ><span class="experience-entry-copy"
            ><strong>Milestones &amp; share cards</strong
            ><small
              >Explore progress moments and a card you could share.</small
            ></span
          ><ArrowDown :size="17" />
        </button>
      </nav>

      <nav class="modes-switcher" aria-label="Demonstration modes">
        <button
          v-for="option in aminaDemoModes"
          :key="option.id"
          :aria-pressed="selectedId === option.id"
          :class="{ selected: selectedId === option.id }"
          :style="{ '--option-accent': option.accent }"
          @click="selectMode(option.id)"
        >
          <component :is="modeIcons[option.id]" :size="22" /><span
            ><strong>{{ option.navLabel }}</strong
            ><small>{{ modeSubtitles[option.id] }}</small
            ><span
              class="mode-availability"
              :class="{ 'is-available': option.id === 'study' }"
              >{{
                option.id === "study"
                  ? "Available now · preview below"
                  : "Concept preview"
              }}</span
            ></span
          ><ChevronRight :size="16" class="mode-tab-arrow" />
        </button>
      </nav>

      <section
        class="mode-workspace"
        :aria-label="mode.title + ' demonstration'"
      >
        <div class="mode-room">
          <header class="room-header">
            <div>
              <span class="room-purpose">{{ mode.title }}</span>
              <h2>{{ mode.scenarioLabel }}</h2>
            </div>
            <span class="room-sample-tag">Sample scenario</span>
          </header>

          <div v-if="selectedId === 'study'" class="study-setting">
            <article class="study-source">
              <div class="source-document-label">
                <FileText :size="16" /> Your sample reading <span>1 / 3</span>
              </div>
              <p class="source-chapter">Designing for people</p>
              <h3>Start with the problem.<br />Then find the possibility.</h3>
              <p>
                Good design begins by understanding what someone is trying to
                do, where they get stuck, and why that moment matters.
              </p>
              <blockquote>
                “What does this person need?” comes before “What could we
                build?”
              </blockquote>
              <p>
                Observation helps us separate the problem from our first idea of
                a solution. A useful question opens up more than one way
                forward.
              </p>
              <footer>
                <BookOpen :size="15" /> Fictional source excerpt · for
                demonstration
              </footer>
            </article>
            <div class="study-companion">
              <span class="setting-name">Your thinking partner</span>
              <div class="study-portrait">
                <AminaDemoAvatar
                  :state="previewState"
                  :active="motionEnabled"
                  compact
                />
              </div>
              <strong>Amina</strong><span>One idea at a time.</span>
            </div>
          </div>

          <div v-else-if="selectedId === 'interview'" class="interview-setting">
            <div class="interview-topline">
              <span
                ><span class="presence-dot" /> Amina
                <small>· Interviewer</small></span
              ><span>Interview rehearsal</span>
            </div>
            <div class="interview-portrait">
              <AminaDemoAvatar
                :state="previewState"
                :active="motionEnabled"
                dark
              />
            </div>
            <div class="interview-subject">
              <span>Make room for your next chapter.</span>
              <h3>A familiar face.<br />A fresh question.</h3>
            </div>
            <div class="self-preview">
              <VideoOff :size="23" /><span>You</span><small>Camera off</small>
            </div>
            <div class="interview-footer-label">
              <MicOff :size="14" /> Simulated call · no devices connected
            </div>
          </div>

          <div
            v-else-if="selectedId === 'conversation'"
            class="conversation-setting"
          >
            <div class="conversation-intention">
              <span class="setting-name"
                >A little rehearsal goes a long way</span
              >
              <h3>You can be kind.<br />And be clear.</h3>
              <p>
                Practise asking for what you need, with room to pause and try
                again.
              </p>
              <div class="intention-note">
                <MessageCircle :size="19" /><span
                  ><strong>Your intention</strong>Ask for more time while
                  keeping your manager informed.</span
                >
              </div>
            </div>
            <div class="conversation-portrait">
              <AminaDemoAvatar
                :state="previewState"
                :active="motionEnabled"
              /><span>Amina plays your manager</span>
            </div>
          </div>

          <div v-else class="language-setting">
            <div class="cafe-copy">
              <span class="cafe-location"
                ><Coffee :size="17" /> Le petit café · Paris</span
              >
              <h3>Un café,<br />s’il vous plaît.</h3>
              <p>A small conversation.<br />A lovely place to begin.</p>
              <div class="cafe-menu">
                <span>Au menu</span>
                <p><span>Un café</span><span>2,50 €</span></p>
                <p><span>Un thé</span><span>3,00 €</span></p>
                <p><span>Un croissant</span><span>2,00 €</span></p>
                <small>Fictional café · sample prices</small>
              </div>
            </div>
            <div class="language-portrait">
              <AminaDemoAvatar
                :state="previewState"
                :active="motionEnabled"
              /><span>Amina · votre barista</span>
            </div>
            <span class="language-level">French · A2 practice</span>
          </div>

          <div
            class="room-caption"
            :class="{ 'caption-hidden': !captionsVisible }"
          >
            <template v-if="captionsVisible"
              ><span class="caption-speaker"
                ><span
                  class="caption-dot"
                  :class="{ 'is-playing': playing }"
                />{{
                  speaker === "amina"
                    ? "Amina · sample prompt"
                    : "Learner · sample response"
                }}</span
              >
              <p>{{ currentCaption }}</p>
              <p
                v-if="
                  selectedId === 'language' &&
                  translationsVisible &&
                  currentTranslation
                "
                class="caption-translation"
              >
                {{ currentTranslation }}
              </p></template
            >
            <p v-else>Captions hidden. Turn them on to follow the sample.</p>
          </div>

          <footer class="room-controls">
            <div class="room-playback">
              <button class="sample-play-button" @click="togglePlayback">
                <Pause v-if="playing" :size="18" /><Play v-else :size="18" />{{
                  playing
                    ? "Pause preview"
                    : ended
                      ? "Replay sample"
                      : "Play sample"
                }}</button
              ><span class="sample-clock"
                >{{ clock }} <small>preview</small></span
              >
            </div>
            <div class="room-secondary-controls">
              <button
                :aria-pressed="captionsVisible"
                aria-label="Show sample captions"
                title="Toggle captions"
                @click="captionsVisible = !captionsVisible"
              >
                <Captions :size="20" /></button
              ><button
                :aria-pressed="voiceEnabled"
                aria-label="Enable local browser sample voice"
                title="Local browser voice"
                @click="toggleVoice"
              >
                <Volume2 :size="19" /></button
              ><button
                aria-label="Restart sample"
                title="Restart sample"
                @click="resetPreview"
              >
                <RotateCcw :size="18" />
              </button>
            </div>
          </footer>
          <p class="preview-runtime-status" role="status">
            {{ stateLabel }}<span v-if="voiceNotice"> · {{ voiceNotice }}</span>
          </p>
        </div>

        <aside class="mode-context">
          <header>
            <span class="context-icon"
              ><component :is="modeIcons[selectedId]" :size="21"
            /></span>
            <div>
              <p>Your practice space</p>
              <h3>{{ mode.contextLabel }}</h3>
            </div>
          </header>
          <p class="context-detail">{{ mode.contextDetail }}</p>
          <div class="context-goal">
            <span>What you’re here for</span>
            <p>{{ mode.goal }}</p>
          </div>
          <div class="context-sources">
            <h4>
              {{
                selectedId === "study"
                  ? "On the desk"
                  : selectedId === "interview"
                    ? "In your interview brief"
                    : selectedId === "conversation"
                      ? "Setting the scene"
                      : "A little context"
              }}
            </h4>
            <div
              v-for="source in mode.sourceItems"
              :key="source.name"
              class="context-source"
            >
              <FileText :size="17" /><span
                ><strong>{{ source.name }}</strong
                ><small>{{ source.detail }}</small></span
              >
            </div>
          </div>
          <div class="context-exchanges">
            <h4>
              Explore the exchange
              <span>{{ turnIndex + 1 }} / {{ mode.prompts.length }}</span>
            </h4>
            <button
              v-for="(sample, index) in mode.prompts"
              :key="sample.amina"
              :aria-pressed="turnIndex === index"
              @click="selectTurn(index)"
            >
              <span>{{ index + 1 }}</span
              ><span>{{ sample.amina }}</span
              ><ChevronRight :size="15" />
            </button>
          </div>
          <button
            v-if="selectedId === 'language'"
            class="context-text-button"
            :aria-pressed="translationsVisible"
            @click="translationsVisible = !translationsVisible"
          >
            <Languages :size="17" />{{
              translationsVisible
                ? "Hide English translation"
                : "Show English translation"
            }}
          </button>
          <button
            class="context-feedback-button"
            :aria-expanded="feedbackVisible"
            aria-controls="sample-feedback"
            @click="feedbackVisible = !feedbackVisible"
          >
            <Lightbulb :size="18" />{{
              feedbackVisible
                ? "Hide sample reflection"
                : "See a sample reflection"
            }}<ChevronRight :size="15" />
          </button>
          <div
            v-if="feedbackVisible"
            id="sample-feedback"
            class="sample-feedback"
          >
            <strong>About this fictional answer</strong>
            <p>{{ turn.feedback }}</p>
            <small
              >This reflects the scripted response, not your performance.</small
            >
          </div>
          <p class="context-footnote">
            These examples show how Amina could adapt. Nothing here is recorded
            or saved to your learning history.
          </p>
        </aside>
      </section>

      <div class="modes-bottom-note">
        <span><Check :size="16" /> Four settings. One familiar companion.</span
        ><button @click="openLab">
          See the animation experience <ArrowRight :size="16" />
        </button>
      </div>

      <section
        v-if="labOpen"
        id="amina-animation-lab"
        class="animation-lab experience-panel"
        aria-labelledby="animation-lab-heading"
      >
        <header class="lab-heading">
          <div>
            <span class="lab-label"
              ><Sparkles :size="17" /> Animation experience</span
            >
            <h2 id="animation-lab-heading" ref="labElement" tabindex="-1">
              A little more presence.
            </h2>
            <p>
              Explore Amina’s illustrated talking simulation and expression
              samples.
            </p>
          </div>
          <button
            type="button"
            class="modes-outline-button"
            @click="closeExperience('animation')"
          >
            Close animation experience
          </button>
        </header>
        <div class="lab-layout">
          <div class="lab-stage" :data-background="labBackground">
            <AminaDemoAvatar
              :state="labState"
              :active="motionEnabled"
              :expression="labExpression"
              :dark="labBackground === 'night'"
            /><span class="lab-stage-caption">Animated expression sample · simulated speech</span>
          </div>
          <div class="lab-controls">
            <h3>Try her conversation states</h3>
            <p>
              Illustrated mouth shapes and expression frames bring this sample
              to life. Speech motion is approximate; this is not a connected AI
              call.
            </p>
            <div class="lab-state-options" aria-label="Preview animation state">
              <button
                v-for="state in labStates"
                :key="state"
                :aria-pressed="
                  labState === state && labExpression === 'auto'
                "
                @click="
                  labState = state;
                  labExpression = 'auto';
                "
              >
                {{ state }}
              </button>
            </div>
            <div class="lab-gesture-options">
              <button
                :aria-pressed="labExpression === 'wave'"
                @click="
                  labExpression = 'wave';
                "
              >
                A little hello</button
              ><button
                :aria-pressed="labExpression === 'celebrate'"
                @click="
                  labExpression = 'celebrate';
                "
              >
                Celebrate together
              </button>
            </div>
            <label class="lab-motion-control"
              ><input v-model="motionEnabled" type="checkbox" /> Animate the
              illustration <span>Respects reduced motion</span></label
            >
          </div>
        </div>
      </section>

      <section
        v-if="characterUnlocksOpen"
        id="airs-character-unlocks"
        class="experience-panel"
        aria-labelledby="character-unlocks-heading"
      >
        <header class="lab-heading">
          <div>
            <span class="lab-label"
              ><Coffee :size="17" /> Character unlocks</span
            >
            <h2
              id="character-unlocks-heading"
              ref="characterUnlocksHeading"
              tabindex="-1"
            >
              Make the space yours.
            </h2>
            <p>
              Choose a companion, explore a setting, and preview cosmetic
              rewards.
            </p>
          </div>
          <button
            type="button"
            class="modes-outline-button"
            @click="closeExperience('character')"
          >
            Close character unlocks
          </button>
        </header>
        <AirsTideUnlocks />
      </section>

      <section
        v-if="milestonesOpen"
        id="airs-milestone-unlocks"
        class="experience-panel"
        aria-labelledby="milestones-heading"
      >
        <header class="lab-heading">
          <div>
            <span class="lab-label"
              ><Check :size="17" /> Milestones &amp; share cards</span
            >
            <h2 id="milestones-heading" ref="milestonesHeading" tabindex="-1">
              Give the small steps a moment.
            </h2>
            <p>Explore milestone examples and a sample share card.</p>
          </div>
          <button
            type="button"
            class="modes-outline-button"
            @click="closeExperience('milestones')"
          >
            Close milestones and share cards
          </button>
        </header>
        <AirsMilestoneUnlocks />
      </section>
      <NuxtLink class="modes-return-link" to="/home"
        ><ArrowLeft :size="16" /> Back to your Airs home</NuxtLink
      >
    </section>
  </AirAppShell>
</template>
