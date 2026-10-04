<script setup lang="ts">
definePageMeta({});
import {
  ArrowLeft,
  Clapperboard,
  CircleAlert,
  Headphones,
  Volume2,
  ListChecks,
  LockKeyhole,
  MessageCircleMore,
  Mic2,
  MicOff,
  Captions,
  PhoneOff,
  Play,
  RotateCcw,
  Send,
  Square,
  Trash2,
} from "lucide-vue-next";
import type { StudyConversation, StudyMode, StudyTurn } from "~/shared/study";
import {
  DEFAULT_STUDY_PREFERENCES,
  STUDY_PURPOSE_LABELS,
} from "~/shared/study";
import { STUDY_LIVE_START_MESSAGE } from "~/shared/studyLive";
import { microphoneError } from "~/shared/userErrors";
import { learnerStudyError } from "~/shared/studyPresentation";
import type { AirAccess } from "~/shared/airAccess";

const route = useRoute();
const auth = useAuth();
const mediaLifecycle = useAirMediaLifecycle();
let disposed = false;
let mediaStopped = false;
let microphoneRequest = 0;
function prepareExit() {
  const unsent =
    recorderStatus.value === "RECORDING" || recorderStatus.value === "REVIEW";
  if (
    unsent &&
    !window.confirm(
      "Leave and discard your unsent recording? Previously saved practice stays in your library.",
    )
  )
    return false;
  live.stop();
  mediaStopped = true;
  microphoneRequest++;
  if (recorder) {
    recorder.onstop = null;
    recorder.ondataavailable = null;
  }
  stopMicrophone();
  playbackRequest++;
  playback?.pause();
  playingTurnId.value = "";
  preparingSpeechTurnId.value = "";
  discardRecording();
  return true;
}
async function leaveSession() {
  await navigateTo("/airs");
}
onBeforeRouteLeave(() => prepareExit());
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (
    recorderStatus.value === "RECORDING" ||
    recorderStatus.value === "REVIEW"
  ) {
    event.preventDefault();
    event.returnValue = "";
  }
}
const standaloneAir = ["air", "amira"].includes(
  useRuntimeConfig().public.appSurface,
);
const studyAccess = ref<AirAccess | null>(null);
const accessError = ref("");
const canStudy = computed(
  () =>
    !study.value?.abandonedAt &&
    (!standaloneAir || studyAccess.value?.allowedActions.PRACTISE === true),
);
async function refreshStudyAccess() {
  studyAccess.value = null;
  accessError.value = "";
  try {
    studyAccess.value =
      await auth.authorizedFetch<AirAccess>("/api/air/access");
  } catch {
    accessError.value =
      "We could not check study access. Your saved transcript is still readable. Try again.";
  }
}
const id = computed(() => String(route.params.id || ""));
const study = ref<StudyConversation | null>(null);
const initialLoading = ref(true);
// Recorded exercises are separate from the live room, preserving saved practice compatibility.
const recordedPracticeMode = computed(
  () => route.query.practice === "recorded",
);
const visibleTurns = computed(() =>
  recordedPracticeMode.value
    ? study.value?.turns || []
    : (study.value?.turns || []).filter(
        (turn) =>
          turn.kind !== "WELCOME" &&
          !(turn.role === "USER" && turn.text === STUDY_LIVE_START_MESSAGE),
      ),
);
const live = useAminaLiveCall(id, load);
const preferences = computed(
  () => study.value?.preferences || DEFAULT_STUDY_PREFERENCES,
);
const purposeLabel = computed(
  () => STUDY_PURPOSE_LABELS[preferences.value.purpose],
);
// Measured connected conversation time, for this visit only; it is not a saved completion signal.
const conversationSeconds = ref(0);
let lastCallSeconds = 0;
watch(
  live.elapsedSeconds,
  (seconds) => {
    if (seconds < lastCallSeconds) lastCallSeconds = 0;
    conversationSeconds.value += Math.max(0, seconds - lastCallSeconds);
    lastCallSeconds = seconds;
  },
  { flush: "sync" },
);
const conversationClock = computed(
  () =>
    `${Math.floor(conversationSeconds.value / 60)
      .toString()
      .padStart(
        2,
        "0",
      )}:${(conversationSeconds.value % 60).toString().padStart(2, "0")}`,
);
const plannedStudyMinutes = computed(
  () => study.value?.plan.estimatedTotalMinutes,
);
const hasCurrentEvidence = computed(() =>
  study.value?.practice.attempts.some(
    (attempt) =>
      attempt.objectiveId === study.value?.plan.activeObjectiveId &&
      attempt.mode === "DISCUSSION",
  ),
);
const canReviewProgress = computed(
  () =>
    canStudy.value &&
    !study.value?.plan.courseCompletedAt &&
    hasCurrentEvidence.value &&
    !study.value?.practice.awaitingAnswer,
);

const inputLevel = computed(() =>
  live.running.value ? live.level.value : microphoneLevel.value,
);
async function startLiveCall() {
  if (
    !canStudy.value ||
    busy.value ||
    planBusy.value ||
    microphoneRequesting.value ||
    recorderStatus.value !== "IDLE"
  )
    return;
  stopCurrentPlayback();
  await live.start();
}
const error = ref("");
const busy = ref(false);
const planBusy = ref(false);
const planPreparing = ref(false);
const planReviewing = ref(false);
const handoffBusy = ref(false),
  handoffReady = ref(false),
  handoffError = ref(""),
  conversationStarted = ref(false);
const adjustingPlan = ref(false),
  adjustment = ref("");
const adjustedPreferences = ref({ ...DEFAULT_STUDY_PREFERENCES });
const planPhaseLabels: Record<string, string> = {
  READING_SOURCE: "I’m reading the included material.",
  PREPARING_GOALS: "I’m preparing your practice goals.",
  CHECKING_REFERENCES: "I’m checking the plan’s source references.",
  PLAN_READY: "Your draft is ready to review.",
};
const recorderStatus = ref<"IDLE" | "RECORDING" | "REVIEW" | "SENDING">("IDLE");
const microphoneLevel = ref(0);
const recordingSeconds = ref(0);
const playingTurnId = ref("");
const preparingSpeechTurnId = ref("");
const audioPromptTurnId = ref("");
const voiceFailureTurnId = ref("");
const microphoneRequesting = ref(false);
const transcript = ref<HTMLElement | null>(null);
let planPoll: ReturnType<typeof setTimeout> | undefined;
let recorder: MediaRecorder | undefined;
let microphone: MediaStream | undefined;
let audioContext: AudioContext | undefined;
let meterFrame = 0;
let recordingTimer: ReturnType<typeof setInterval> | undefined;
let recordedAudio: Blob | undefined;
let recordingId: string | undefined;
let playback: HTMLAudioElement | undefined;
let playbackPrimed = false;
let playbackRequest = 0;
const speechUrls = new Map<string, string>();
const activeObjective = computed(() =>
  study.value?.plan.objectives.find(
    (objective) => objective.id === study.value?.plan.activeObjectiveId,
  ),
);
const sessionPane = ref<"plan" | "context" | "">("");
const conversationVisible = ref(false);
onMounted(() => {
  conversationVisible.value = window.matchMedia("(min-width: 768px)").matches;
});
const sessionActive = computed(
  () =>
    !study.value?.abandonedAt &&
    study.value?.plan.status === "APPROVED" &&
    conversationStarted.value &&
    Boolean(study.value.plan.functionRefs?.length),
);
const latestReply = computed(() =>
  study.value?.turns.filter((turn) => turn.role === "AMIRA").at(-1),
);
const welcomeTurn = computed(() =>
  study.value?.turns.find((turn) => turn.kind === "WELCOME"),
);
const introductionTurn = computed(() =>
  study.value?.turns.find(
    (turn) => turn.kind === "INTRO" && turn.role === "AMIRA",
  ),
);
const readyToPractice = computed(() => Boolean(introductionTurn.value));
const objectiveIndex = computed(() =>
  Math.max(
    0,
    study.value?.plan.objectives.findIndex(
      (item) => item.id === study.value?.plan.activeObjectiveId,
    ) ?? 0,
  ),
);
const objectiveExplanations = computed(
  () =>
    study.value?.turns.filter(
      (turn) =>
        turn.role === "USER" &&
        turn.kind === "PRACTICE" &&
        turn.objectiveId === activeObjective.value?.id,
    ) || [],
);
const lessonStep = computed(() =>
  study.value?.progression?.stage === "COMPLETE"
    ? "Keep practicing what you learned"
    : study.value?.progression?.stage === "SCENARIO"
      ? "Use the idea in a scenario"
      : study.value?.progression?.stage === "ORAL_EXAM"
        ? "Answer the oral exam"
        : !recordedPracticeMode.value
          ? "Discuss this objective, then end the call to review your saved explanation"
          : !welcomeTurn.value
            ? "Welcome"
            : !introductionTurn.value
              ? "Introduction"
              : objectiveExplanations.value.length < 1
                ? "Explore the idea"
                : objectiveExplanations.value.length < 2
                  ? "Try a scenario or explain again"
                  : study.value?.plan.recommendation
                    ? "Review Misu’s recommendation"
                    : "Review feedback and explain it again",
);
const conversationActivity = computed(() => {
  if (!recordedPracticeMode.value && !live.running.value) {
    if (live.error.value || live.availability.value?.enabled === false)
      return {
        phase: "error",
        label: "Call unavailable",
        detail: "Retry the connection to start your conversation.",
      };
    if (!canStudy.value)
      return {
        phase: "blocked",
        label: "Study access unavailable",
        detail: "Your saved conversation is still available.",
      };
    if (live.availabilityLoading.value)
      return {
        phase: "connecting",
        label: "Preparing your call",
        detail: "Checking voice access.",
      };
    if (live.hasConnected.value)
      return {
        phase: "ended",
        label: "Call ended",
        detail: "Start another call when you are ready.",
      };
    return {
      phase: "ready",
      label: "Ready to talk",
      detail: "Start your call. Amina will guide you through this goal.",
    };
  }
  if (live.status.value === "CONNECTING")
    return {
      phase: "connecting",
      label: "Connecting your live call",
      detail: "Connecting your microphone to Amina.",
    };
  if (live.status.value === "SPEAKING")
    return {
      phase: "speaking",
      label: "Amina is speaking",
      detail: "You can speak to interrupt her.",
    };
  if (live.status.value === "LISTENING")
    return {
      phase: "listening",
      label: live.muted.value
        ? "Your microphone is muted"
        : "Amina is listening",
      detail: live.muted.value
        ? "Unmute when you want to speak."
        : "Speak naturally. There is no Send button during a live call.",
    };
  if (live.status.value === "IDLE" && live.hasConnected.value)
    return {
      phase: "ended",
      label: "Call ended",
      detail:
        "Review confirmed turns or start another call when you are ready.",
    };
  if (live.status.value === "ERROR")
    return {
      phase: "error",
      label: "Live call ended",
      detail: live.error.value,
    };
  if (voiceFailureTurnId.value && preparingSpeechTurnId.value)
    return {
      phase: "processing",
      label: "Retrying Amina’s voice",
      detail: "Voice conversation will resume when playback starts.",
    };
  if (
    voiceFailureTurnId.value &&
    audioPromptTurnId.value === voiceFailureTurnId.value
  )
    return {
      phase: "blocked",
      label: "Voice playback paused",
      detail:
        "Tap Listen to hear Amina. Voice conversation resumes when playback starts.",
    };
  if (voiceFailureTurnId.value)
    return {
      phase: "error",
      label: "Voice conversation temporarily unavailable",
      detail:
        "Your transcript is saved. Retry voice to continue speaking practice.",
    };
  if (error.value)
    return {
      phase: "error",
      label: "Something needs attention",
      detail: "Your work stays here. Read the message below and try again.",
    };
  if (recorderStatus.value === "SENDING")
    return {
      phase: "processing",
      label: "Processing your answer",
      detail:
        "Your transcript and feedback will appear after the turn is saved.",
    };
  if (microphoneRequesting.value)
    return {
      phase: "connecting",
      label: "Connecting to your microphone",
      detail: "Allow microphone access to begin speaking.",
    };
  if (recorderStatus.value === "RECORDING")
    return {
      phase: "listening",
      label: "Listening to your explanation",
      detail: "Stop recording when you’re ready to review it.",
    };
  if (preparingSpeechTurnId.value)
    return {
      phase: "processing",
      label: "Preparing Amina’s voice",
      detail: "Her saved reply is already in the transcript.",
    };
  if (busy.value)
    return {
      phase: "processing",
      label: "Preparing Amina’s reply",
      detail: "The next turn will appear here when it is saved.",
    };
  if (playingTurnId.value)
    return {
      phase: "speaking",
      label: "Amina is speaking",
      detail: "Follow her saved reply in the transcript.",
    };
  if (recorderStatus.value === "REVIEW")
    return {
      phase: "review",
      label: "Review your recording",
      detail:
        "Send it to Amina or record again. Your audio has not been saved to the chat.",
    };
  if (audioPromptTurnId.value)
    return {
      phase: "blocked",
      label: "Voice playback paused",
      detail: "Tap Listen on Amina’s reply to hear it.",
    };
  if (!readyToPractice.value)
    return {
      phase: "ready",
      label: "Ready for your introduction",
      detail: "Tap I’m ready when you want to begin.",
    };
  return {
    phase: "ready",
    label: "Ready for your turn",
    detail: "Tap the microphone to explain this objective out loud.",
  };
});
const modes: Array<{ id: StudyMode; label: string; helper: string }> = [
  {
    id: "DISCUSSION",
    label: "Discuss",
    helper: "Explore the material together",
  },
  {
    id: "ORAL_EXAM",
    label: "Oral exam",
    helper: "Five questions and feedback",
  },
  { id: "SCENARIO", label: "Scenario", helper: "Reason through a case" },
];

function modeAvailable(mode: StudyMode) {
  // Until a refreshed conversation includes progression, keep later stages
  // locked. The server remains the authority on every mode change.
  return (
    study.value?.progression?.availableModes.includes(mode) ??
    mode === "DISCUSSION"
  );
}

function modeLockReason(mode: StudyMode) {
  if (mode === "ORAL_EXAM")
    return "Finish and confirm Misu’s course objectives first.";
  if (mode === "SCENARIO") return "Complete five oral exam answers first.";
  return "Finish the current practice stage first.";
}

useHead({
  title: computed(() =>
    study.value
      ? `${study.value.document.title || study.value.document.name} · Flowst Air`
      : "Study session · Flowst Air",
  ),
});

async function load() {
  const loaded = await auth.authorizedFetch<StudyConversation>(
    `/api/study/conversations/${id.value}`,
  );
  if (disposed) return;
  study.value = loaded;
  await nextTick();
  transcript.value?.scrollTo({ top: transcript.value.scrollHeight });
}

async function retryLoad() {
  error.value = "";
  try {
    await load();
  } catch (cause) {
    error.value = learnerStudyError(
      cause,
      "Your study chat could not be loaded. Try again.",
    );
  }
}

async function ensureWelcome() {
  if (!canStudy.value || disposed || mediaStopped) return;
  if (
    study.value?.plan.status !== "APPROVED" ||
    !study.value.plan.functionRefs?.length ||
    welcomeTurn.value
  )
    return;
  const response = await auth.authorizedFetch<{ turn: { id: string } }>(
    `/api/study/conversations/${id.value}/welcome`,
    {
      method: "POST",
    },
  );
  await load();
  return response.turn.id;
}

function schedulePlanPoll() {
  if (planPoll) clearTimeout(planPoll);
  planPoll = setTimeout(async () => {
    try {
      await load();
      if (study.value?.plan.status === "PENDING") {
        const started = Date.parse(study.value.plan.generationStartedAt || "");
        if (!started || Date.now() - started > 300_000)
          error.value =
            "Plan preparation has not completed. Check again or retry explicitly.";
        else schedulePlanPoll();
      }
    } catch (cause: any) {
      error.value = learnerStudyError(
        cause,
        "Misu’s plan could not be loaded. Try again.",
      );
    }
  }, 2500);
}

async function preparePlan(regenerate = false, adjust = false) {
  if (!canStudy.value || disposed || live.running.value) return;
  if (planBusy.value) return;
  planBusy.value = true;
  planPreparing.value = true;
  error.value = "";
  schedulePlanPoll();
  try {
    const prepared = await auth.authorizedFetch<StudyConversation>(
      `/api/study/conversations/${id.value}/plan`,
      {
        method: "POST",
        body: {
          regenerate,
          ...(adjust
            ? {
                adjustment: adjustment.value,
                preferences: adjustedPreferences.value,
              }
            : {}),
        },
      },
    );
    study.value = prepared;
    if (prepared.plan.status === "DRAFT") adjustingPlan.value = false;
    if (prepared.plan.status === "PENDING") schedulePlanPoll();
  } catch (cause: any) {
    error.value = learnerStudyError(
      cause,
      "Your plan could not be prepared. Try again in a moment.",
    );
    await load().catch(() => undefined);
  } finally {
    planBusy.value = false;
    planPreparing.value = false;
  }
}

async function prepareHandoff(automaticWelcome = false) {
  if (disposed || handoffBusy.value || !canStudy.value) return;
  handoffBusy.value = true;
  handoffReady.value = false;
  handoffError.value = "";
  try {
    const welcomeId = await ensureWelcome();
    if (disposed) return;
    handoffReady.value = Boolean(welcomeTurn.value);
    await nextTick();
    document
      .querySelector<HTMLElement>(".prepared-handoff")
      ?.focus({ preventScroll: true });
    if (!handoffReady.value) throw new Error("Welcome unavailable");
    if (automaticWelcome && welcomeId) await playSpeech(welcomeId, true);
  } catch {
    if (!disposed)
      handoffError.value =
        "Your approval is saved. Amina’s welcome could not be prepared. Retry when you’re ready.";
  } finally {
    handoffBusy.value = false;
  }
}
async function approvePlan() {
  if (!canStudy.value || !study.value || planBusy.value) return;
  primePlayback();
  planBusy.value = true;
  handoffBusy.value = true;
  handoffError.value = "";
  error.value = "";
  try {
    study.value = await auth.authorizedFetch<StudyConversation>(
      `/api/study/conversations/${id.value}/plan/approve`,
      { method: "POST", body: { version: study.value.plan.version } },
    );
  } catch (cause: any) {
    error.value = learnerStudyError(
      cause,
      "Your plan could not be approved. Try again.",
    );
  } finally {
    planBusy.value = false;
    handoffBusy.value = false;
  }
  if (study.value?.plan.status === "APPROVED") await prepareHandoff(true);
}
async function startConversation() {
  if (!handoffReady.value || handoffBusy.value || disposed) return;
  stopCurrentPlayback();
  voiceFailureTurnId.value = "";
  audioPromptTurnId.value = "";
  conversationStarted.value = true;
  if (recordedPracticeMode.value) await beginLesson();
  else await startLiveCall();
}

async function confirmNext() {
  const objectiveId = study.value?.plan.recommendation?.objectiveId;
  if (!objectiveId || planBusy.value || live.running.value) return;
  planBusy.value = true;
  try {
    study.value = await auth.authorizedFetch<StudyConversation>(
      `/api/study/conversations/${id.value}/plan/confirm`,
      { method: "POST", body: { objectiveId } },
    );
  } catch (cause: any) {
    error.value = learnerStudyError(
      cause,
      "The next objective could not be opened. Try again.",
    );
  } finally {
    planBusy.value = false;
  }
}

async function retryRecommendation() {
  if (!canStudy.value || live.running.value) return;
  if (planBusy.value) return;
  planBusy.value = true;
  planReviewing.value = true;
  error.value = "";
  try {
    study.value = await auth.authorizedFetch<StudyConversation>(
      `/api/study/conversations/${id.value}/plan/recommend`,
      { method: "POST" },
    );
  } catch (cause: any) {
    error.value = learnerStudyError(
      cause,
      "Misu could not review your attempt. Try again.",
    );
  } finally {
    planBusy.value = false;
    planReviewing.value = false;
  }
}

onMounted(async () => {
  mediaLifecycle.beforeExit.value = prepareExit;
  window.addEventListener("beforeunload", warnBeforeUnload);
  try {
    if (standaloneAir) await refreshStudyAccess();
    await load();
    if (!recordedPracticeMode.value && !study.value?.abandonedAt)
      void live.checkAvailability();
    if (study.value?.plan.status === "APPROVED") {
      conversationStarted.value = study.value.turns.some(
        (turn) =>
          turn.kind === "INTRO" ||
          (turn.role === "USER" && turn.text !== STUDY_LIVE_START_MESSAGE),
      );
      if (!conversationStarted.value) await prepareHandoff(false);
    }
    if (study.value?.plan.status === "PENDING") {
      if (!study.value.plan.generationStartedAt) await preparePlan();
      else schedulePlanPoll();
    }
  } catch (cause: any) {
    error.value = learnerStudyError(
      cause,
      "Your study chat could not be loaded. Try again.",
    );
  } finally {
    initialLoading.value = false;
  }
});
onBeforeUnmount(() => {
  disposed = true;
  mediaStopped = true;
  microphoneRequest++;
  mediaLifecycle.beforeExit.value = null;
  window.removeEventListener("beforeunload", warnBeforeUnload);
  if (recorder) {
    recorder.onstop = null;
    recorder.ondataavailable = null;
  }
  if (planPoll) clearTimeout(planPoll);
  playbackRequest++;
  stopMicrophone();
  playback?.pause();
  for (const url of speechUrls.values()) URL.revokeObjectURL(url);
  speechUrls.clear();
  recordedAudio = undefined;
  study.value = null;
});

async function sendControl(
  action: "INTRO" | "START_SCENARIO" | "START_ORAL_EXAM",
) {
  if (
    !canStudy.value ||
    live.running.value ||
    disposed ||
    busy.value ||
    voiceFailureTurnId.value
  )
    return;
  busy.value = true;
  error.value = "";
  try {
    const response = await auth.authorizedFetch<{ agentTurn?: { id: string } }>(
      `/api/study/conversations/${id.value}/control`,
      { method: "POST", body: { action } },
    );
    await load();
    if (response.agentTurn?.id) await playSpeech(response.agentTurn.id, true);
  } catch (cause: any) {
    error.value = learnerStudyError(
      cause,
      "Amina could not reply right now. Check the transcript for completed turns, then try again.",
    );
  } finally {
    busy.value = false;
  }
}

async function beginLesson() {
  if (!canStudy.value || disposed || voiceFailureTurnId.value) return;
  mediaStopped = false;
  stopCurrentPlayback();
  primePlayback();
  await sendControl("INTRO");
}

async function chooseMode(mode: StudyMode) {
  if (
    !canStudy.value ||
    disposed ||
    busy.value ||
    voiceFailureTurnId.value ||
    study.value?.mode === mode ||
    !modeAvailable(mode)
  )
    return;
  mediaStopped = false;
  stopCurrentPlayback();
  if (mode !== "DISCUSSION") primePlayback();
  busy.value = true;
  error.value = "";
  try {
    await auth.authorizedFetch(`/api/study/conversations/${id.value}/mode`, {
      method: "POST",
      body: { mode },
    });
    await load();
  } catch (cause: any) {
    error.value = learnerStudyError(
      cause,
      "Study mode could not be changed. Try again.",
    );
  } finally {
    busy.value = false;
  }
  if (study.value?.mode === mode && mode !== "DISCUSSION") {
    await sendControl(
      mode === "SCENARIO" ? "START_SCENARIO" : "START_ORAL_EXAM",
    );
  }
}

function stopMicrophone() {
  if (recorder?.state === "recording") recorder.stop();
  if (recordingTimer) clearInterval(recordingTimer);
  recordingTimer = undefined;
  if (meterFrame) cancelAnimationFrame(meterFrame);
  meterFrame = 0;
  microphone?.getTracks().forEach((track) => track.stop());
  microphone = undefined;
  void audioContext?.close();
  audioContext = undefined;
  microphoneLevel.value = 0;
}

async function startRecording() {
  if (live.status.value === "ERROR") {
    live.status.value = "IDLE";
    live.error.value = "";
  }
  if (!canStudy.value || disposed || live.running.value) return;
  if (
    !readyToPractice.value ||
    busy.value ||
    voiceFailureTurnId.value ||
    recorderStatus.value === "RECORDING"
  )
    return;
  stopCurrentPlayback();
  mediaStopped = false;
  const request = ++microphoneRequest;
  error.value = "";
  recordedAudio = undefined;
  recordingId = undefined;
  microphoneRequesting.value = true;
  try {
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    )
      throw new Error(
        "This browser needs microphone recording support and HTTPS or localhost.",
      );
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (disposed || mediaStopped || request !== microphoneRequest) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    microphone = stream;
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(microphone);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.frequencyBinCount);
    const measure = () => {
      analyser.getByteFrequencyData(samples);
      microphoneLevel.value = Math.min(
        1,
        samples.reduce((sum, value) => sum + value, 0) / samples.length / 75,
      );
      meterFrame = requestAnimationFrame(measure);
    };
    measure();
    const chunks: BlobPart[] = [];
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
      (type) => MediaRecorder.isTypeSupported(type),
    );
    recorder = new MediaRecorder(
      microphone,
      mimeType ? { mimeType } : undefined,
    );
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      recordedAudio = new Blob(chunks, {
        type: recorder?.mimeType || "audio/webm",
      });
      recordingId = recordedAudio.size ? crypto.randomUUID() : undefined;
      recorderStatus.value = recordedAudio.size ? "REVIEW" : "IDLE";
      stopMicrophone();
    };
    recorder.start();
    recordingSeconds.value = 0;
    recorderStatus.value = "RECORDING";
    recordingTimer = setInterval(() => {
      recordingSeconds.value++;
      if (recordingSeconds.value >= 120) stopRecording();
    }, 1000);
  } catch (cause: any) {
    stopMicrophone();
    recorderStatus.value = "IDLE";
    error.value = microphoneError(cause);
  } finally {
    microphoneRequesting.value = false;
  }
}

function stopRecording() {
  if (recorder?.state === "recording") recorder.stop();
}

function discardRecording() {
  recordedAudio = undefined;
  recordingId = undefined;
  recorderStatus.value = "IDLE";
  recordingSeconds.value = 0;
}

async function sendRecording() {
  if (!canStudy.value || disposed) return;
  if (
    !recordedAudio ||
    recorderStatus.value !== "REVIEW" ||
    voiceFailureTurnId.value
  )
    return;
  const generation = microphoneRequest;
  stopCurrentPlayback();
  primePlayback();
  recorderStatus.value = "SENDING";
  error.value = "";
  let requestStarted = false;
  let response: { userTurn?: StudyTurn; agentTurn?: StudyTurn };
  try {
    const body = new FormData();
    // One ID belongs to one recording, including retries after an uncertain POST.
    // The server uses it to return the saved turn instead of creating a duplicate.
    body.append("recordingId", (recordingId ||= crypto.randomUUID()));
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(
        await recordedAudio.arrayBuffer(),
      );
      const sampleRate = 16_000;
      const frameCount = Math.ceil(decoded.duration * sampleRate);
      if (frameCount < 1600 || frameCount > 1_920_000)
        throw new Error("Keep your recording between 0.1 and 120 seconds.");
      const pcm = new ArrayBuffer(frameCount * 2);
      const view = new DataView(pcm);
      const channels = Array.from(
        { length: decoded.numberOfChannels },
        (_, channel) => decoded.getChannelData(channel),
      );
      for (let frame = 0; frame < frameCount; frame++) {
        const index = (frame * decoded.sampleRate) / sampleRate;
        const lower = Math.floor(index);
        const fraction = index - lower;
        let sample = 0;
        for (const channel of channels)
          sample +=
            (channel[lower] || 0) * (1 - fraction) +
            (channel[Math.min(lower + 1, channel.length - 1)] || 0) * fraction;
        sample = Math.max(-1, Math.min(1, sample / channels.length));
        view.setInt16(
          frame * 2,
          sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767),
          true,
        );
      }
      body.append(
        "audio",
        new Blob([pcm], { type: "application/octet-stream" }),
        "answer.pcm",
      );
    } finally {
      await context.close();
    }
    if (disposed || generation !== microphoneRequest) return;
    requestStarted = true;
    response = await auth.authorizedFetch<{
      userTurn?: StudyTurn;
      agentTurn?: StudyTurn;
    }>(`/api/study/conversations/${id.value}/recorded-turn`, {
      method: "POST",
      body,
    });
  } catch (cause: any) {
    if (disposed || generation !== microphoneRequest) return;
    recorderStatus.value = "REVIEW";
    error.value = learnerStudyError(
      cause,
      requestStarted
        ? "We could not confirm whether your recording was saved. Your take is still here; check the transcript or retry sending this same take."
        : "We could not prepare that recording. It is still here; retry or record again.",
    );
    return;
  }
  // The POST acknowledged the saved turn. Refreshing the view or playing audio
  // may still fail, but neither can make this take unsent or available to resend.
  if (disposed || generation !== microphoneRequest) return;
  recordedAudio = undefined;
  recordingId = undefined;
  recorderStatus.value = "IDLE";
  const savedTurns = [response.userTurn, response.agentTurn].filter(
    (turn): turn is StudyTurn => Boolean(turn),
  );
  if (study.value && savedTurns.length) {
    const knownIds = new Set(study.value.turns.map((turn) => turn.id));
    study.value = {
      ...study.value,
      turns: [
        ...study.value.turns,
        ...savedTurns.filter((turn) => !knownIds.has(turn.id)),
      ],
    };
    await nextTick();
    transcript.value?.scrollTo({ top: transcript.value.scrollHeight });
  }
  try {
    await load();
  } catch {
    error.value =
      "Your answer was saved, but the latest chat could not load. Your transcript is here; refresh to see Misu’s latest review.";
  }
  if (response.agentTurn?.id) await playSpeech(response.agentTurn.id, true);
}

function stopCurrentPlayback() {
  if (!playingTurnId.value && !preparingSpeechTurnId.value) return;
  playbackRequest++;
  playback?.pause();
  playingTurnId.value = "";
  preparingSpeechTurnId.value = "";
}

function primePlayback() {
  if (playbackPrimed || playingTurnId.value) return;
  const audio = (playback ||= new Audio());
  // Start the same media element on the learner's click. Reusing it after the
  // network reply helps browsers that grant audible playback per element.
  const sampleCount = 400;
  const wave = new Uint8Array(44 + sampleCount * 2);
  const view = new DataView(wave.buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++)
      wave[offset + index] = value.charCodeAt(index);
  };
  write(0, "RIFF");
  view.setUint32(4, wave.length - 8, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, sampleCount * 2, true);
  audio.src = `data:audio/wav;base64,${btoa(String.fromCharCode(...wave))}`;
  void audio
    .play()
    .then(() => {
      playbackPrimed = true;
    })
    .catch(() => undefined);
}

async function playSpeech(turnId: string, automatic = false) {
  if (disposed || live.running.value || (automatic && mediaStopped)) return;
  if (!automatic) mediaStopped = false;
  if (!automatic && playingTurnId.value === turnId && playback) {
    stopCurrentPlayback();
    return;
  }
  const request = ++playbackRequest;
  playback?.pause();
  playingTurnId.value = "";
  preparingSpeechTurnId.value = turnId;
  audioPromptTurnId.value = "";
  let url = speechUrls.get(turnId);
  if (!url && !canStudy.value) {
    preparingSpeechTurnId.value = "";
    return;
  }
  try {
    if (!url) {
      const blob = await auth.authorizedFetch<Blob>(
        `/api/study/conversations/${id.value}/speech`,
        { method: "POST", body: { turnId }, responseType: "blob" },
      );
      if (request !== playbackRequest) return;
      url = URL.createObjectURL(blob);
      speechUrls.set(turnId, url);
      void load().catch(() => undefined);
    }
    if (request !== playbackRequest) return;
    const audio = (playback ||= new Audio());
    audio.src = url;
    audio.onended = () => {
      if (request === playbackRequest) playingTurnId.value = "";
    };
    await audio.play();
    if (request === playbackRequest) {
      playbackPrimed = true;
      preparingSpeechTurnId.value = "";
      playingTurnId.value = turnId;
      if (voiceFailureTurnId.value === turnId) voiceFailureTurnId.value = "";
    }
  } catch (cause: any) {
    if (request !== playbackRequest) return;
    preparingSpeechTurnId.value = "";
    playingTurnId.value = "";
    if (cause?.name === "NotAllowedError") {
      audioPromptTurnId.value = turnId;
      return;
    }
    if (cause?.name === "AbortError") return;
    // A real speech-service or audio-decoding failure must pause Voice conversation,
    // not silently turn the lesson into a text-only conversation.
    if (url) {
      speechUrls.delete(turnId);
      URL.revokeObjectURL(url);
    }
    voiceFailureTurnId.value = turnId;
    error.value = "";
  }
}

async function retryVoice() {
  const turnId = voiceFailureTurnId.value;
  if (!turnId || preparingSpeechTurnId.value) return;
  error.value = "";
  if (audioPromptTurnId.value === turnId) {
    await playSpeech(turnId);
    return;
  }
  primePlayback();
  await playSpeech(turnId, true);
}

async function remove() {
  if (
    !window.confirm(
      standaloneAir
        ? "Delete this document, conversation, and practice? If its objectives are unfinished, choose Replace study document in your library to explicitly abandon it and upload a replacement."
        : "Delete this document, conversation, and all practice feedback?",
    )
  )
    return;
  live.stop();
  stopMicrophone();
  try {
    await auth.authorizedFetch(`/api/study/conversations/${id.value}`, {
      method: "DELETE",
    });
    await navigateTo("/airs");
  } catch (cause: any) {
    error.value = learnerStudyError(
      cause,
      "This chat could not be deleted. Your study data is still here; try again.",
    );
  }
}
</script>

<template>
  <AirStudyShell :session="sessionActive">
    <template v-if="sessionActive && study" #session-navigation>
      <AirSessionNavigation
        controls-only
        :title="study.document.title || study.document.name"
        :plan-open="sessionPane === 'plan'"
        :conversation-open="conversationVisible"
        @leave="leaveSession"
        @plan="sessionPane = sessionPane === 'plan' ? '' : 'plan'"
        @conversation="
          conversationVisible = !conversationVisible;
          sessionPane = '';
        "
      />
    </template>
    <AirSkeleton
      v-if="initialLoading"
      variant="room"
      label="Loading your study room"
    />
    <div v-else-if="!study" class="air-panel" role="alert">
      <h1>Study room unavailable</h1>
      <p>{{ error }}</p>
      <button
        type="button"
        class="air-button"
        @click="
          initialLoading = true;
          load()
            .catch(
              (cause) =>
                (error = learnerStudyError(
                  cause,
                  'Your study room could not be loaded. Try again.',
                )),
            )
            .finally(() => (initialLoading = false));
        "
      >
        Retry
      </button>
      <NuxtLink to="/airs" class="air-text-link">Back to library</NuxtLink>
    </div>
    <div v-else class="study-page" :class="{ 'session-active': sessionActive }">
      <nav v-if="!sessionActive" class="setup-room-nav">
        <NuxtLink to="/airs/library">Saved sessions</NuxtLink
        ><span>{{ study.document.title || study.document.name }}</span
        ><button @click="leaveSession">Leave session</button>
      </nav>
      <details
        v-if="study.document.provenance && !sessionActive"
        class="setup-source-details"
      >
        <summary>Source you reviewed</summary>
        <AirSourceProvenance :provenance="study.document.provenance" />
      </details>
      <AirSessionNavigation
        v-if="sessionActive"
        context-only
        :title="study.document.title || study.document.name"
        :plan-open="sessionPane === 'plan'"
        :conversation-open="conversationVisible"
        @leave="leaveSession"
        @plan="sessionPane = sessionPane === 'plan' ? '' : 'plan'"
        @conversation="
          conversationVisible = !conversationVisible;
          sessionPane = '';
        "
      />
      <AirSessionNavigation
        v-if="sessionActive && !standaloneAir"
        controls-only
        :title="study.document.title || study.document.name"
        :plan-open="sessionPane === 'plan'"
        :conversation-open="conversationVisible"
        @plan="sessionPane = sessionPane === 'plan' ? '' : 'plan'"
        @conversation="
          conversationVisible = !conversationVisible;
          sessionPane = '';
        "
      />
      <p v-if="accessError" class="air-error" role="alert">
        {{ accessError }} <button @click="refreshStudyAccess">Try again</button>
      </p>
      <section
        v-else-if="standaloneAir && studyAccess?.tier === 'RESTRICTED'"
        class="air-panel"
      >
        <h2>Study access is currently unavailable</h2>
        <p>Your saved material remains readable and can be deleted.</p>
        <NuxtLink class="air-text-link" to="/airs/settings"
          >Review account access</NuxtLink
        >
      </section>
      <header v-if="!sessionActive && study.abandonedAt" class="study-header">
        <NuxtLink to="/airs/library" class="back">
          <ArrowLeft :size="17" /> All study chats
        </NuxtLink>
        <div class="study-title">
          <AgentAvatar agent="AMIRA" />
          <div>
            <span>Your Flowst Airs study room · {{ study.document.kind }}</span>
            <h1>{{ study.document.title || study.document.name }}</h1>
            <small
              v-if="
                study.document.title &&
                study.document.title !== study.document.name
              "
              class="original-file"
              >From {{ study.document.name }}</small
            >
          </div>
        </div>
        <p>{{ study.document.excerpt }}</p>
        <div class="header-actions">
          <button
            v-if="sessionActive"
            type="button"
            class="mobile-session-panel"
            :aria-pressed="sessionPane === 'plan'"
            @click="sessionPane = sessionPane === 'plan' ? '' : 'plan'"
          >
            Study plan</button
          ><button
            v-if="sessionActive"
            type="button"
            class="mobile-session-panel"
            :aria-pressed="sessionPane === 'context'"
            @click="sessionPane = sessionPane === 'context' ? '' : 'context'"
          >
            Session info</button
          ><button type="button" class="leave-session" @click="leaveSession">
            Leave session
          </button>
          <button type="button" class="delete" @click="remove">
            <Trash2 :size="16" /> Delete chat
          </button>
        </div>
      </header>

      <section
        v-if="study.abandonedAt"
        class="air-panel"
        aria-label="Abandoned study"
      >
        <p class="air-eyebrow">Abandoned study</p>
        <h2>Your saved material is still available</h2>
        <p>
          You ended this study plan to make room for a replacement. Its saved
          conversation remains readable; abandoning it did not complete its
          objectives.
        </p>
        <NuxtLink class="air-button" to="/airs/new"
          >Start a replacement study</NuxtLink
        >
        <AirConversation
          :turns="visibleTurns"
          :allow-playback="false"
          :live-running="false"
          :can-study="false"
          :cached-ids="[]"
          playing-id=""
          preparing-id=""
          audio-prompt-id=""
        />
      </section>
      <section
        v-if="!study.abandonedAt && study.plan.status !== 'APPROVED'"
        class="plan-review"
        aria-label="Your session plan"
      >
        <MisuPlanGuide
          :plan="study.plan"
          :preferences="preferences"
          :preparing="planPreparing"
          :saving-approval="planBusy && !planPreparing"
        />
        <AirSkeleton
          v-if="planPreparing || study.plan.status === 'PENDING'"
          variant="plan"
          label="Misu is preparing your session plan"
        />
        <p v-else-if="study.plan.status === 'FAILED'">
          {{
            learnerStudyError(
              { data: { statusMessage: study.plan.error } },
              "Your plan could not be prepared. Try again below.",
            )
          }}
        </p>
        <template v-else>
          <p>
            Review the objectives, source locations, and teaching approach.
            Approve when you're ready, or ask me to adjust the plan.
          </p>
          <details
            v-if="study.plan.functionRefs?.length"
            class="learning-guidance"
          >
            <summary>How learning guidance works</summary>
            <p>
              Teaching approach:
              <strong>{{
                study.plan.functionRefs
                  .map(
                    (ref) => `${ref.id.replaceAll("-", " ")} (v${ref.version})`,
                  )
                  .join(" + ")
              }}</strong
              >. Amina will introduce the idea, guide practice, then invite you
              to explain it in your own words.
            </p>
          </details>
          <div class="study-brief" aria-label="Your study preferences">
            <strong>{{ purposeLabel }}</strong>
            <p>
              {{
                preferences.scope === "FOCUSED"
                  ? "Focused scope"
                  : "Broad scope"
              }}
              · {{ preferences.timeBudgetMinutes }} minutes available<span
                v-if="plannedStudyMinutes"
              >
                · approximately {{ plannedStudyMinutes }} minutes planned</span
              >
            </p>
            <p v-if="preferences.context">{{ preferences.context }}</p>
            <small
              >These are effort estimates. Progress depends on your saved
              practice and confirmed checkpoints.</small
            >
          </div>
          <ol class="objectives">
            <li v-for="objective in study.plan.objectives" :key="objective.id">
              <strong>{{ objective.title }}</strong
              ><small v-if="objective.estimatedMinutes" class="objective-time"
                >About {{ objective.estimatedMinutes }} min</small
              >
              <p>{{ objective.outcome }}</p>
              <p v-if="objective.planningNote" class="planning-note">
                <strong>Misu’s plan explanation:</strong>
                {{ objective.planningNote }}
              </p>
              <AirCitation
                v-for="source in objective.sources"
                :key="source.id"
                class="source"
                :source="source"
              />
            </li>
          </ol>
        </template>
        <p v-if="error" class="error" role="alert">
          <CircleAlert :size="16" /> {{ error }}
        </p>
        <p
          v-if="study.plan.status === 'DRAFT' && !recordedPracticeMode"
          class="plan-call-note"
        >
          Approving prepares your session with Amina. Your microphone stays off
          until you choose Start conversation. Each pilot call reserves 60
          seconds, including unused time.
          <NuxtLink to="/airs/about">Microphone &amp; privacy</NuxtLink>
        </p>
        <section
          v-if="adjustingPlan"
          class="plan-adjustment"
          aria-label="Adjust your plan"
        >
          <label
            >What would you like me to change?<textarea
              v-model="adjustment"
              maxlength="600"
              rows="3"
            />
          </label>
          <label
            >Practice goal<select v-model="adjustedPreferences.purpose">
              <option
                v-for="(label, value) in STUDY_PURPOSE_LABELS"
                :key="value"
                :value="value"
              >
                {{ label }}
              </option>
            </select></label
          >
          <label
            >Available minutes<input
              v-model.number="adjustedPreferences.timeBudgetMinutes"
              type="number"
              min="5"
              max="120"
          /></label>
          <details>
            <summary>Scope and focus</summary>
            <label
              >Coverage<select v-model="adjustedPreferences.scope">
                <option value="FOCUSED">One useful goal</option>
                <option value="BROAD">The main ideas</option>
              </select></label
            ><label
              >Session focus<textarea
                v-model="adjustedPreferences.context"
                maxlength="600"
                rows="2"
              />
            </label>
          </details>
          <button :disabled="planBusy" @click="preparePlan(true, true)">
            Draft adjusted plan</button
          ><button :disabled="planBusy" @click="adjustingPlan = false">
            Keep current draft
          </button>
        </section>
        <div class="plan-actions">
          <button
            v-if="study.plan.status === 'DRAFT'"
            type="button"
            :disabled="planBusy || !canStudy"
            @click="approvePlan"
          >
            {{ planBusy ? "Saving approval…" : "Approve plan" }}
          </button>
          <button
            v-if="
              study.plan.status === 'DRAFT' || study.plan.status === 'FAILED'
            "
            type="button"
            class="secondary"
            :disabled="planBusy || !canStudy"
            @click="
              study.plan.status === 'FAILED'
                ? preparePlan(true)
                : ((adjustedPreferences = { ...preferences }),
                  (adjustingPlan = true))
            "
          >
            <span v-if="study.plan.status === 'FAILED'">Retry plan</span>
            <span v-else>Adjust plan</span>
          </button>
        </div>
      </section>

      <section
        v-else-if="!study.abandonedAt && !study.plan.functionRefs?.length"
        class="plan-review"
        role="alert"
      >
        <h2>This chat needs a new study plan</h2>
        <p>
          This older chat cannot continue with the current study approach.
          Return to your study library to review your options.
        </p>
        <NuxtLink to="/airs">Return to study library</NuxtLink>
      </section>

      <section
        v-if="study.progression?.stage === 'COMPLETE'"
        class="air-panel session-recap"
        aria-label="Session recap"
      >
        <p class="air-eyebrow">Session complete</p>
        <h2>Here is what you practised</h2>
        <p>
          You completed the planned activities. Completion does not measure
          mastery.
        </p>
        <ul>
          <li v-for="objective in study.plan.objectives" :key="objective.id">
            {{ objective.title }}
          </li>
        </ul>
        <p>
          {{ study.practice.attempts.length }} saved practice attempts. Your
          explanations and feedback remain in the transcript below.
        </p>
        <h3>Where to go next</h3>
        <p>
          Revisit an explanation, try recalling an idea without your notes, or
          return to your library for another resource.
        </p>
        <NuxtLink class="air-button" to="/airs">Return to library</NuxtLink>
      </section>
      <section
        v-if="
          !study.abandonedAt &&
          study.plan.status === 'APPROVED' &&
          !conversationStarted
        "
        class="prepared-handoff"
        tabindex="-1"
        aria-label="Preparing your conversation"
      >
        <AgentActivity
          v-if="!handoffReady"
          agent="MISU"
          state="connecting"
          :busy="handoffBusy"
          :label="
            handoffError
              ? 'Your approval is saved. Amina’s preparation needs a retry.'
              : 'I’m preparing your session with Amina. I’ll share your context, source and approved plan.'
          "
        />
        <AgentActivity
          agent="AMIRA"
          :state="playingTurnId ? 'composing' : 'working'"
          :busy="handoffBusy || !!preparingSpeechTurnId || !!playingTurnId"
          :label="
            handoffReady
              ? playingTurnId
                ? 'Speaking your welcome. Microphone off.'
                : preparingSpeechTurnId
                  ? 'Welcome saved. Preparing spoken welcome. Microphone off.'
                  : 'Your welcome is ready. Microphone off.'
              : handoffError
                ? 'Your welcome isn’t ready yet. Microphone off.'
                : 'Preparing your first practice. Microphone off.'
          "
        />
        <p v-if="handoffError" role="alert">{{ handoffError }}</p>
        <button
          v-if="handoffError"
          :disabled="handoffBusy"
          @click="prepareHandoff(true)"
        >
          Retry preparation
        </button>
        <template v-if="handoffReady"
          ><h2>Hi, I’m Amina.</h2>
          <p>{{ welcomeTurn?.text }}</p>
          <p v-if="voiceFailureTurnId || audioPromptTurnId">
            Spoken playback is unavailable. You can read the welcome and start
            when ready.
          </p>
          <div class="handoff-actions">
            <button
              :disabled="handoffBusy || !canStudy"
              @click="startConversation"
            >
              Start conversation</button
            ><button
              :disabled="!!preparingSpeechTurnId"
              @click="welcomeTurn && playSpeech(welcomeTurn.id)"
            >
              {{ playingTurnId ? "Stop welcome" : "Replay welcome" }}</button
            ><button @click="leaveSession">Not now</button>
          </div></template
        >
      </section>
      <template
        v-if="
          conversationStarted &&
          !study.abandonedAt &&
          study.plan.status === 'APPROVED' &&
          study.plan.functionRefs?.length
        "
      >
        <AirCallRoom
          :goal="
            activeObjective?.outcome ||
            activeObjective?.title ||
            'Review your session plan'
          "
          :objective="activeObjective?.title || ''"
          :study-minutes="preferences.timeBudgetMinutes"
          :conversation-clock="conversationSeconds > 0 ? conversationClock : ''"
          :activity="conversationActivity"
          :level="inputLevel"
          :loading="!recordedPracticeMode && live.availabilityLoading.value"
          :recorded-mode="recordedPracticeMode"
          :microphone-active="
            recorderStatus === 'RECORDING' ||
            (live.running.value &&
              live.status.value !== 'CONNECTING' &&
              !live.muted.value)
          "
          :live-status="live.status.value"
          :muted="live.muted.value"
          :elapsed="live.elapsedSeconds.value"
          :caption="live.caption.value"
          :caption-saved="live.savedCaption.value"
          :captions-visible="live.captionsVisible.value"
          :live-running="live.running.value"
          :plan-open="sessionPane === 'plan'"
          :conversation-open="conversationVisible"
          @close-plan="sessionPane = ''"
          @close-conversation="conversationVisible = false"
        >
          <template #plan>
            <MisuPlanGuide :plan="study.plan" :preferences="preferences" />
            <AirsKaiReview
              :conversation-id="id"
              :can-review="
                Boolean(hasCurrentEvidence) &&
                !study.practice.awaitingAnswer &&
                !live.running.value
              "
            />
            <div class="study-brief" aria-label="Your study preferences">
              <strong>{{ purposeLabel }}</strong>
              <p>
                {{
                  preferences.scope === "FOCUSED"
                    ? "Focused scope"
                    : "Broad scope"
                }}
                · {{ preferences.timeBudgetMinutes }} minutes available
              </p>
              <p v-if="plannedStudyMinutes">
                About {{ plannedStudyMinutes }} minutes of planned activities.
              </p>
              <p v-if="preferences.context">{{ preferences.context }}</p>
              <p v-if="conversationSeconds > 0">
                {{ conversationClock }} conversation time this visit.
              </p>
              <small
                >The conversation timer pauses between calls. Your study budget
                also includes reading and reflection; it does not extend the
                pilot voice allowance.</small
              >
            </div>
            <ol class="session-objectives" aria-label="Learning objectives">
              <li
                v-for="objective in study.plan.objectives"
                :key="objective.id"
                :aria-current="
                  objective.id === study.plan.activeObjectiveId
                    ? 'step'
                    : undefined
                "
              >
                <strong>{{ objective.title }}</strong
                ><span v-if="objective.estimatedMinutes">
                  · about {{ objective.estimatedMinutes }} min</span
                >
              </li>
            </ol>
            <aside class="mode-panel" aria-label="Study mode" tabindex="0">
              <div class="active-objective" v-if="activeObjective">
                <span
                  >Objective {{ objectiveIndex + 1 }} of
                  {{ study.plan.objectives.length }} · Your session plan</span
                ><strong>{{ activeObjective.title }}</strong
                ><small>{{ activeObjective.outcome }}</small>
                <div>
                  <AirCitation
                    v-for="source in activeObjective.sources"
                    :key="source.id"
                    class="source"
                    :source="source"
                  />
                </div>
              </div>
              <div
                v-if="recordedPracticeMode"
                class="lesson-path"
                aria-label="Study stages"
              >
                <strong>Your study path</strong>
                <ol>
                  <li
                    :class="{
                      complete: !!study.plan.courseCompletedAt,
                      current: study.progression?.stage === 'COURSE',
                    }"
                  >
                    Explore & explain
                  </li>
                  <li
                    :class="{
                      complete:
                        (study.progression?.oralAnswersCompleted || 0) >=
                        (study.progression?.oralAnswersRequired || 5),
                      current: study.progression?.stage === 'ORAL_EXAM',
                    }"
                  >
                    Oral exam
                  </li>
                  <li
                    :class="{
                      complete: study.progression?.stage === 'COMPLETE',
                      current: study.progression?.stage === 'SCENARIO',
                    }"
                  >
                    Scenario
                  </li>
                </ol>
                <p>Next: {{ lessonStep }}</p>
              </div>
              <div class="voice-usage">
                <span class="usage-label">Voice conversation</span>
                <strong
                  >{{
                    Math.max(
                      0,
                      $config.public.studyAwsVoiceTrialMaxSeconds -
                        (study.voiceUsage?.transcribeSeconds || 0),
                    )
                  }}
                  voice input seconds remaining</strong
                >
                <div
                  class="voice-progress"
                  role="progressbar"
                  aria-label="Voice input time used"
                  aria-valuemin="0"
                  :aria-valuemax="$config.public.studyAwsVoiceTrialMaxSeconds"
                  :aria-valuenow="study.voiceUsage?.transcribeSeconds || 0"
                >
                  <i
                    :style="{
                      width: `${Math.min(100, ((study.voiceUsage?.transcribeSeconds || 0) / $config.public.studyAwsVoiceTrialMaxSeconds) * 100)}%`,
                    }"
                  />
                </div>
                <small
                  >Completed transcripts are saved; raw audio is not.</small
                >
              </div>
              <div
                class="progress-recommendation"
                v-if="study.plan.recommendation"
              >
                <strong
                  >{{
                    study.plan.recommendation.action === "ADVANCE"
                      ? "Suggested next step"
                      : study.plan.recommendation.action === "COMPLETE"
                        ? study.plan.courseCompletedAt
                          ? "Objectives completed"
                          : "Suggested completion"
                        : "Try the idea again"
                  }}
                </strong>
                <div class="misu-review-heading">
                  <AgentAvatar agent="MIRO" size="compact" /><span
                    >Misu · Learning planner</span
                  >
                </div>
                <p>{{ study.plan.recommendation.reason }}</p>
                <small
                  >Review checkpoint:
                  {{ study.plan.recommendation.basedOnAttemptCount }} saved
                  {{
                    study.plan.recommendation.basedOnAttemptCount === 1
                      ? "attempt"
                      : "attempts"
                  }}
                  in this chat. Misu reviews recent attempts on this objective.
                  This is a suggestion, not a mastery assessment. You choose
                  whether to continue.</small
                >
                <details
                  class="learning-guidance"
                  v-if="study.practice.attempts.length"
                >
                  <summary>Inspect saved attempts used in this review</summary>
                  <template
                    v-for="attempt in study.practice.attempts
                      .slice(0, study.plan.recommendation.basedOnAttemptCount)
                      .filter(
                        (item) =>
                          item.objectiveId === study?.plan.activeObjectiveId,
                      )
                      .slice(-5)"
                    :key="attempt.evidenceId || attempt.answer"
                  >
                    <p><strong>Question:</strong> {{ attempt.question }}</p>
                    <p>
                      <strong>Your explanation:</strong> {{ attempt.answer }}
                    </p>
                    <p>
                      <strong>Amina’s feedback:</strong> {{ attempt.feedback }}
                    </p>
                    <AirCitation
                      v-for="source in attempt.sources"
                      :key="source.id"
                      :source="source"
                    />
                  </template>
                </details>
                <button
                  v-if="
                    study.plan.recommendation.action === 'ADVANCE' ||
                    (study.plan.recommendation.action === 'COMPLETE' &&
                      !study.plan.courseCompletedAt)
                  "
                  type="button"
                  :disabled="planBusy || live.running.value"
                  @click="confirmNext"
                >
                  {{
                    study.plan.recommendation.action === "COMPLETE"
                      ? "Confirm objectives complete"
                      : "Continue to next objective"
                  }}
                </button>
              </div>
              <div
                class="progress-recommendation"
                v-else-if="study.plan.recommendationError"
              >
                <strong>Progress review unavailable</strong>
                <p>
                  {{
                    learnerStudyError(
                      {
                        data: { statusMessage: study.plan.recommendationError },
                      },
                      "Your feedback could not be reviewed yet. Try again.",
                    )
                  }}
                </p>
                <button
                  type="button"
                  :disabled="planBusy || live.running.value"
                  @click="retryRecommendation"
                >
                  Retry plan review
                </button>
              </div>
              <div
                v-if="!recordedPracticeMode && !study.plan.courseCompletedAt"
                class="progress-recommendation"
              >
                <div class="misu-review-heading">
                  <AgentAvatar agent="MIRO" size="compact" /><strong
                    >Misu · Review this objective</strong
                  >
                </div>
                <p v-if="planReviewing" role="status">
                  Misu is reviewing your saved explanation and Amina’s feedback.
                </p>
                <p v-if="live.running.value">
                  End the call when you are ready to review your saved
                  explanation.
                </p>
                <p v-else-if="hasCurrentEvidence">
                  Ask for a progress review based on your saved explanation. You
                  choose whether to move on.
                </p>
                <p v-else>
                  Explain this objective during a call. A saved explanation is
                  needed before a progress review.
                </p>
                <button
                  type="button"
                  :disabled="
                    !canReviewProgress || planBusy || live.running.value
                  "
                  @click="retryRecommendation"
                >
                  {{ planBusy ? "Reviewing…" : "Review saved explanation" }}
                </button>
              </div>
              <div
                v-if="study.plan.courseCompletedAt"
                class="progress-recommendation"
              >
                <strong>Objective completion saved</strong>
                <p>
                  You can upload another resource or explicitly choose optional
                  practice. Completion is not a mastery score.
                </p>
                <NuxtLink v-if="standaloneAir" to="/airs/new"
                  >Upload another resource</NuxtLink
                >
              </div>
              <h2 v-if="recordedPracticeMode && readyToPractice">
                How shall we study?
              </h2>
              <button
                v-for="(mode, modeIndex) in recordedPracticeMode &&
                readyToPractice
                  ? modes
                  : []"
                :key="mode.id"
                type="button"
                class="mode-choice"
                :class="[
                  mode.id.toLowerCase().replace('_', '-'),
                  {
                    selected: study.mode === mode.id,
                    locked: !modeAvailable(mode.id),
                  },
                ]"
                :aria-pressed="study.mode === mode.id"
                :aria-label="
                  modeAvailable(mode.id)
                    ? mode.label
                    : `${mode.label} locked. ${modeLockReason(mode.id)}`
                "
                :title="
                  modeAvailable(mode.id) ? undefined : modeLockReason(mode.id)
                "
                :disabled="
                  !canStudy ||
                  !modeAvailable(mode.id) ||
                  busy ||
                  !!voiceFailureTurnId ||
                  recorderStatus !== 'IDLE' ||
                  live.running.value
                "
                @click="chooseMode(mode.id)"
              >
                <span class="mode-icon" aria-hidden="true">
                  <MessageCircleMore
                    v-if="mode.id === 'DISCUSSION'"
                    :size="19"
                  />
                  <ListChecks v-else-if="mode.id === 'ORAL_EXAM'" :size="19" />
                  <Clapperboard v-else :size="19" />
                </span>
                <span class="mode-copy"
                  ><strong>{{ mode.label }}</strong
                  ><small>{{ mode.helper }}</small></span
                >
                <span class="mode-step" aria-hidden="true">{{
                  modeIndex + 1
                }}</span>
                <LockKeyhole
                  v-if="!modeAvailable(mode.id)"
                  class="mode-lock"
                  :size="14"
                  aria-hidden="true"
                />
              </button>
              <div class="practice-progress" v-if="study.mode !== 'DISCUSSION'">
                <span>{{
                  study.mode === "ORAL_EXAM"
                    ? `Question
                  ${study.practice.questionNumber} of 5`
                    : "Scenario practice"
                }}</span
                ><small
                  >{{ study.practice.attempts.length }} attempts saved</small
                >
              </div>
              <p class="source-note">
                Amina names document sources when using them and labels general
                knowledge separately.
              </p>
            </aside>
            <button type="button" class="delete" @click="remove">
              <Trash2 :size="16" /> Delete chat
            </button>
          </template>
          <template #controls>
            <div
              class="call-actions"
              :class="{ 'live-dock': live.running.value }"
            >
              <div v-if="live.running.value" class="live-call-controls">
                <button
                  type="button"
                  :aria-pressed="live.muted.value"
                  @click="live.toggleMute"
                >
                  <span class="call-control-icon">
                    <MicOff v-if="live.muted.value" :size="22" />
                    <Mic2 v-else :size="22" /> </span
                  >{{ live.muted.value ? "Unmute" : "Mute" }}</button
                ><button
                  type="button"
                  :aria-pressed="live.captionsVisible.value"
                  @click="
                    live.captionsVisible.value = !live.captionsVisible.value
                  "
                >
                  <span class="call-control-icon">
                    <Captions :size="22" /> </span
                  >Captions</button
                ><button type="button" class="end-live-call" @click="live.stop">
                  <span class="call-control-icon">
                    <PhoneOff :size="22" /> </span
                  >End call
                </button>
              </div>
              <div v-else-if="!recordedPracticeMode" class="live-call-entry">
                <button
                  type="button"
                  :disabled="
                    !canStudy ||
                    !live.availability.value?.enabled ||
                    recorderStatus !== 'IDLE' ||
                    busy ||
                    planBusy ||
                    microphoneRequesting
                  "
                  @click="startLiveCall"
                >
                  Start conversation</button
                ><small v-if="live.availability.value?.enabled"
                  >60-second pilot call. Starting reserves 60 seconds of your
                  document’s voice allowance, even if you end early.
                  <NuxtLink to="/airs/about"
                    >Microphone &amp; privacy</NuxtLink
                  ></small
                >
                <p
                  v-if="
                    live.availability.value && !live.availability.value.enabled
                  "
                  role="alert"
                >
                  {{ live.availability.value.message }}
                  <button type="button" @click="live.checkAvailability">
                    Retry connection
                  </button>
                </p>
                <small v-if="!live.availability.value && !live.error.value"
                  >Checking live call availability…</small
                >
                <p v-if="live.error.value" role="alert">
                  {{ live.error.value }}
                  <NuxtLink
                    v-if="live.nextAction.value"
                    :to="live.nextAction.value"
                    >{{
                      live.errorCode.value === "AMIRA_SESSION_EXPIRED"
                        ? "Sign in again"
                        : live.errorCode.value === "AMIRA_ACCESS_RESTRICTED"
                          ? "View account access"
                          : "Open library"
                    }}
                  </NuxtLink>
                  <button type="button" @click="live.checkAvailability">
                    Retry availability
                  </button>
                </p>
              </div>
              <p v-if="error" class="error" role="alert">
                <CircleAlert :size="16" /> {{ error }}
              </p>
              <div
                v-if="
                  recordedPracticeMode &&
                  voiceFailureTurnId &&
                  !live.running.value
                "
                class="voice-recovery"
                role="alert"
              >
                <p>
                  Your saved transcript is available. Voice conversation resumes
                  when reply playback starts.
                </p>
                <button
                  type="button"
                  :disabled="!!preparingSpeechTurnId || !canStudy"
                  @click="retryVoice"
                >
                  {{
                    preparingSpeechTurnId
                      ? "Preparing voice…"
                      : audioPromptTurnId === voiceFailureTurnId
                        ? "Listen now"
                        : "Retry voice"
                  }}
                </button>
              </div>
              <details
                v-if="recordedPracticeMode && !live.running.value"
                class="recorded-practice"
                open
              >
                <summary>Recorded practice</summary>
                <div
                  v-if="!live.running.value && !introductionTurn"
                  class="ready-panel"
                >
                  <p v-if="welcomeTurn">
                    Amina is ready to introduce your document and first
                    objective.
                  </p>
                  <p v-else>Preparing Amina’s welcome…</p>
                  <button
                    type="button"
                    :disabled="
                      busy || !welcomeTurn || !!voiceFailureTurnId || !canStudy
                    "
                    @click="beginLesson"
                  >
                    <span v-if="busy">Preparing your introduction…</span>
                    <span v-else>I’m ready</span>
                  </button>
                </div>
                <div v-else-if="!live.running.value" class="record-controls">
                  <div class="record-context">
                    <strong v-if="voiceFailureTurnId"
                      >Voice conversation is paused</strong
                    >
                    <strong v-else-if="recorderStatus === 'RECORDING'"
                      >Recording your thinking</strong
                    >
                    <strong v-else-if="recorderStatus === 'REVIEW'"
                      >Recording ready to send</strong
                    >
                    <strong v-else-if="recorderStatus === 'SENDING'"
                      >Transcribing and asking Amina…</strong
                    >
                    <strong v-else>Your turn to explain</strong>
                    <span v-if="voiceFailureTurnId"
                      >Retry Amina’s voice above to continue.</span
                    >
                    <span v-else-if="recorderStatus === 'RECORDING'"
                      >{{ recordingSeconds }}s · Tap the button to stop</span
                    >
                    <span v-else-if="recorderStatus === 'REVIEW'"
                      >Send it or record again. We save the transcript, not your
                      audio.</span
                    >
                    <span v-else
                      >Tap the round button to record. No typing needed.</span
                    >
                  </div>
                  <div class="record-actions">
                    <button
                      type="button"
                      class="record-button"
                      :class="{ recording: recorderStatus === 'RECORDING' }"
                      :disabled="
                        !canStudy ||
                        recorderStatus === 'SENDING' ||
                        recorderStatus === 'REVIEW' ||
                        busy ||
                        !!voiceFailureTurnId
                      "
                      :aria-label="
                        recorderStatus === 'RECORDING'
                          ? 'Stop recording'
                          : 'Start recording'
                      "
                      @click="
                        recorderStatus === 'RECORDING'
                          ? stopRecording()
                          : startRecording()
                      "
                    >
                      <Square
                        v-if="recorderStatus === 'RECORDING'"
                        :size="25"
                      />
                      <Mic2 v-else :size="29" />
                    </button>
                    <button
                      v-if="recorderStatus === 'REVIEW'"
                      type="button"
                      class="send-recording"
                      :disabled="!!voiceFailureTurnId"
                      @click="sendRecording"
                    >
                      <Send :size="17" /> Send recording
                    </button>
                    <button
                      v-if="recorderStatus === 'REVIEW'"
                      type="button"
                      class="rerecord"
                      @click="discardRecording"
                    >
                      <RotateCcw :size="15" /> Record again
                    </button>
                  </div>
                </div>
              </details>
              <button
                v-if="
                  recordedPracticeMode && latestReply && !live.running.value
                "
                class="room-playback"
                type="button"
                :disabled="
                  !!preparingSpeechTurnId ||
                  (!canStudy && !speechUrls.has(latestReply.id))
                "
                @click="playSpeech(latestReply.id)"
              >
                <Square v-if="playingTurnId === latestReply.id" :size="19" />
                <Volume2 v-else :size="19" />{{
                  playingTurnId === latestReply.id
                    ? "Pause reply"
                    : preparingSpeechTurnId
                      ? "Preparing reply…"
                      : "Listen to reply"
                }}
              </button>
            </div>
          </template>
          <template #conversation>
            <AirConversation
              :turns="visibleTurns"
              :allow-playback="recordedPracticeMode"
              :live-running="live.running.value"
              :playing-id="playingTurnId"
              :preparing-id="preparingSpeechTurnId"
              :audio-prompt-id="audioPromptTurnId"
              :can-study="canStudy"
              :cached-ids="[...speechUrls.keys()]"
              @play="playSpeech"
            />
          </template>
        </AirCallRoom>
      </template>
    </div>
  </AirStudyShell>
</template>

<style scoped>
.setup-room-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 0.85rem;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.setup-room-nav span {
  max-width: 45ch;
  overflow-wrap: anywhere;
}
.setup-room-nav button {
  min-height: 44px;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.setup-source-details {
  margin: 16px 0;
}
.setup-source-details summary {
  min-height: 44px;
  cursor: pointer;
}

.prepared-handoff {
  max-width: 680px;
  margin: 32px auto;
  padding: 28px;
  border: 1px solid #d9e1dd;
  border-radius: 16px;
  background: #fff;
  line-height: 1.7;
}
.handoff-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.prepared-handoff button,
.plan-adjustment button {
  min-height: 44px;
  padding: 12px 18px;
  border: 1px solid #173d32;
  border-radius: 10px;
  background: #173d32;
  color: white;
  cursor: pointer;
}
.plan-adjustment {
  padding: 20px 0;
}
.plan-adjustment label {
  display: block;
  margin: 14px 0;
}
.plan-adjustment input,
.plan-adjustment select,
.plan-adjustment textarea {
  display: block;
  width: 100%;
  padding: 12px;
  border: 1px solid #adbab5;
  border-radius: 8px;
  box-sizing: border-box;
  font: inherit;
}
.prepared-handoff button:focus-visible {
  outline: 3px solid #608977;
  outline-offset: 3px;
}

.study-page {
  padding-bottom: 40px;
  --air-orange: #d9673c;
  --air-deep: #332921;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #8b5746;
  font-size: 0.75rem;
  font-weight: 800;
}

.study-header {
  position: relative;
  margin-bottom: 18px;
  padding: 22px 28px 26px;
  overflow: hidden;
  border-radius: 29px;
  background:
    radial-gradient(circle at 90% 0%, #ffe5a8 0, transparent 31%),
    linear-gradient(115deg, #fff3e7 0%, #ffe3d0 100%);
}

.study-header::after {
  position: absolute;
  right: -42px;
  bottom: -82px;
  width: 230px;
  height: 230px;
  border: 1px solid rgba(190, 105, 52, 0.18);
  border-radius: 50%;
  box-shadow:
    0 0 0 32px rgba(255, 255, 255, 0.13),
    0 0 0 64px rgba(255, 255, 255, 0.1);
  pointer-events: none;
  content: "";
}

.study-title {
  margin: 18px 0 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.study-title span {
  color: #9c5d49;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
}

.study-title h1 {
  margin: 2px 0;
  max-width: 760px;
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1.08;
  letter-spacing: -0.045em;
  text-wrap: balance;
  overflow-wrap: anywhere;
}

.original-file {
  display: block;
  margin-top: 7px;
  color: #87695c;
  font-size: 0.72rem;
  font-weight: 650;
}

.study-header p {
  max-width: 680px;
  color: #6b5349;
  font-size: 0.88rem;
  line-height: 1.55;
}

.header-actions {
  position: absolute;
  right: 0;
  top: 10px;
}

.delete {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #915343;
  font-size: 0.72rem;
  font-weight: 750;
}

.study-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 230px;
  grid-template-areas: "guide conversation portrait";
  gap: 14px;
  align-items: start;
}

.mode-panel,
.conversation {
  border-radius: 27px;
  box-shadow: 0 16px 38px rgba(116, 67, 43, 0.08);
}

.mode-panel {
  grid-area: guide;
  padding: 16px;
  background: #fff7ef;
}

.mode-panel h2 {
  margin: 0 0 14px;
  font-size: 0.9rem;
}

.mode-choice {
  position: relative;
  width: 100%;
  margin: 0 0 7px;
  min-height: 64px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 16px;
  text-align: left;
  transition:
    transform 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.mode-choice.discussion {
  background: #fff1e4;
  color: #9b5133;
}

.mode-choice.oral-exam {
  background: #eaf4ef;
  color: #326a60;
}

.mode-choice.scenario {
  background: #f0edfa;
  color: #675a92;
}

.mode-choice:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 7px 18px rgba(127, 70, 42, 0.1);
}

.mode-choice:active:not(:disabled) {
  transform: translateY(1px);
}

.mode-panel button:focus-visible,
.conversation button:focus-visible,
.delete:focus-visible {
  outline: 3px solid #b94e2c;
  outline-offset: 3px;
}

.mode-choice.selected {
  border-color: currentColor;
  box-shadow: 0 5px 16px rgba(127, 70, 42, 0.09);
}

.mode-choice:disabled {
  cursor: not-allowed;
  opacity: 0.52;
  filter: grayscale(0.25);
}

.mode-choice.locked {
  border-style: dashed;
  border-color: currentColor;
}

.mode-icon {
  width: 39px;
  height: 39px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.76);
}

.mode-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.mode-step {
  margin-left: auto;
  align-self: flex-start;
  font-size: 0.61rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.mode-lock {
  position: absolute;
  right: 9px;
  bottom: 8px;
}

.mode-copy strong {
  font-size: 0.78rem;
}

.mode-copy small,
.source-note,
.practice-progress small {
  color: var(--ink-soft);
  font-size: 0.68rem;
}

.practice-progress {
  margin-top: 20px;
  padding: 12px;
  display: grid;
  gap: 4px;
  border-radius: 13px;
  background: #f7f1ec;
  font-size: 0.72rem;
  font-weight: 750;
}

.source-note {
  margin: 20px 4px;
  line-height: 1.5;
}

.conversation {
  grid-area: conversation;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fffefa;
}

.air-presence {
  position: relative;
  grid-area: portrait;
  height: clamp(310px, 39vw, 405px);
  overflow: hidden;
  border-radius: 27px;
  background: #f9b968;
  box-shadow: 0 16px 38px rgba(142, 83, 40, 0.15);
}

.air-presence img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.air-presence::after {
  position: absolute;
  inset: 35% 0 0;
  background: linear-gradient(
    transparent 5%,
    rgba(55, 29, 18, 0.12) 30%,
    rgba(43, 25, 18, 0.9) 100%
  );
  content: "";
}

.portrait-caption {
  position: absolute;
  z-index: 1;
  right: 17px;
  bottom: 21px;
  left: 17px;
  color: #fff;
}

.portrait-caption span {
  display: block;
  margin-bottom: 11px;
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.portrait-caption strong {
  display: block;
  font-size: clamp(1.35rem, 2vw, 1.8rem);
  line-height: 1.08;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.portrait-caption p {
  margin: 10px 0;
  color: #fff4e9;
  font-size: 0.76rem;
  line-height: 1.45;
}

.portrait-caption small {
  display: inline-block;
  margin-top: 6px;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.15);
  font-size: 0.65rem;
  font-weight: 700;
  backdrop-filter: blur(8px);
}

.turn-list {
  max-height: min(58dvh, 650px);
  padding: 26px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.conversation-activity {
  display: grid;
  gap: 7px;
  padding: 11px 20px;
  border-top: 1px solid #f1dfcf;
  background: #fff9ef;
}

.activity-state {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.activity-state strong {
  color: #613a30;
  font-size: 0.76rem;
}

.activity-state p {
  margin: 2px 0 0;
  color: #80685c;
  font-size: 0.68rem;
  line-height: 1.35;
}

.activity-dot {
  width: 9px;
  height: 9px;
  margin-top: 5px;
  flex: none;
  border-radius: 50%;
  background: #4b937b;
}

.phase-connecting .activity-dot,
.phase-processing .activity-dot {
  background: #d98742;
  animation: activity-pulse 1.3s ease-in-out infinite;
}

.phase-listening .activity-dot {
  background: #d44f49;
  animation: activity-pulse 1.3s ease-in-out infinite;
}

.phase-review .activity-dot,
.phase-blocked .activity-dot {
  background: #d98742;
}

.phase-speaking .activity-dot {
  background: #6d65b6;
}

.phase-error .activity-dot {
  background: #c3443b;
}

.activity-context {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 12px;
  padding-left: 19px;
  color: #74584c;
  font-size: 0.65rem;
  font-weight: 750;
}

.activity-sources {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.activity-sources small {
  color: #95796b;
  font-size: 0.64rem;
}

.activity-sources span {
  padding: 2px 6px;
  border-radius: 999px;
  background: #fff;
  color: #8a5340;
}

.voice-retry {
  justify-self: start;
  min-height: 44px;
  margin-left: 19px;
  padding: 0 17px;
  border-radius: 999px;
  background: #a94730;
  color: #fff;
  font-size: 0.73rem;
  font-weight: 850;
}

.voice-retry:disabled {
  opacity: 0.55;
}

@keyframes activity-pulse {
  50% {
    opacity: 0.45;
    transform: scale(0.8);
  }
}

.welcome {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  color: #a2684e;
}

.welcome h2 {
  margin: 14px 0 4px;
  color: var(--ink);
}

.welcome p {
  max-width: 320px;
  color: var(--ink-soft);
  font-size: 0.82rem;
}

.turn {
  width: fit-content;
  max-width: min(92%, 640px);
  margin-bottom: 16px;
  padding: 14px 17px;
  border-radius: 19px;
  background: #f7f2e9;
}

.turn.user {
  margin-left: auto;
  background: #e9f2f2;
}

.turn.air {
  background: #fff0de;
}

.turn-role {
  color: #7f5241;
  font-size: 0.68rem;
  font-weight: 850;
}

.turn p {
  margin: 6px 0;
  white-space: pre-wrap;
  line-height: 1.65;
  font-size: 0.9rem;
}

.turn .audio-prompt {
  margin-top: 10px;
  color: #8a5340;
  font-size: 0.76rem;
  font-weight: 750;
}

.sources {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.source,
.general {
  padding: 4px 7px;
  border-radius: 99px;
  background: #fff;
  color: #8a5340;
  font-size: 0.62rem;
  font-weight: 700;
}

.general {
  background: #f8e7bb;
  color: #5f4c27;
}

.live-caption {
  color: #816755;
  font-size: 0.72rem;
  font-style: italic;
}

.voice-controls {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 13px;
  border-top: 1px solid #ede6e2;
}

.voice-controls button {
  min-width: 175px;
  min-height: 44px;
  padding: 0 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 999px;
  background: #9c5d49;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
}

.voice-controls button.active {
  background: #3d6864;
}

.voice-controls button:disabled {
  opacity: 0.55;
}

.voice-controls span {
  color: var(--ink-soft);
  font-size: 0.68rem;
}

.composer {
  margin: 0 20px 18px;
  padding: 5px;
  display: flex;
  border: 1px solid #ddd4cf;
  border-radius: 999px;
  background: #fff;
}

.composer input {
  min-width: 0;
  flex: 1;
  padding: 10px 15px;
  outline: 0;
  background: transparent;
  font-size: 0.8rem;
}

.composer button {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #9c5d49;
  color: #fff;
}

.composer button:disabled {
  opacity: 0.5;
}

.error {
  margin: 10px 18px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 9px;
  border-left: 4px solid #b84e32;
  border-radius: 11px;
  background: #fff1e7;
  color: #833621;
  font-size: 0.84rem;
  line-height: 1.45;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 1100px) {
  .study-layout {
    grid-template-columns: 210px minmax(0, 1fr);
    grid-template-areas: "portrait portrait" "guide conversation";
  }

  .air-presence {
    height: 210px;
  }

  .air-presence img {
    inset: 0 0 0 auto;
    width: 48%;
    object-position: center 17%;
  }

  .air-presence::after {
    inset: 0;
    background: linear-gradient(
      90deg,
      #f7a951 0%,
      #f8b667 43%,
      rgba(248, 182, 103, 0.1) 75%
    );
  }

  .portrait-caption {
    top: 25px;
    bottom: auto;
    left: 28px;
    width: 45%;
  }
}

@media (max-width: 780px) {
  .study-layout {
    grid-template-columns: 1fr;
    grid-template-areas: "portrait" "guide" "conversation";
  }

  .mode-panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .mode-panel h2 {
    width: 100%;
  }

  .active-objective,
  .lesson-path,
  .voice-usage,
  .progress-recommendation {
    width: 100%;
  }

  .mode-panel .mode-choice {
    min-width: 0;
    flex: 1 1 90px;
    justify-content: center;
    flex-direction: column;
    gap: 5px;
    padding: 9px 5px;
    text-align: center;
  }

  .mode-step {
    position: absolute;
    top: 7px;
    right: 8px;
  }

  .mode-choice small,
  .source-note {
    display: none;
  }

  .practice-progress {
    margin: 0;
  }

  .turn-list {
    max-height: 55dvh;
  }

  .header-actions {
    position: static;
    margin-top: 12px;
  }
}

@media (max-width: 510px) {
  .study-header {
    padding: 20px 18px 22px;
  }

  .study-title h1 {
    font-size: 1.75rem;
  }

  .air-presence {
    height: 178px;
  }

  .air-presence img {
    width: 54%;
  }

  .portrait-caption {
    top: 20px;
    left: 20px;
    width: 50%;
  }

  .portrait-caption strong {
    font-size: 1.25rem;
  }

  .portrait-caption p,
  .portrait-caption small {
    display: none;
  }

  .turn-list {
    padding: 17px;
  }

  .voice-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .voice-controls button {
    width: 100%;
  }

  .voice-controls span {
    text-align: center;
  }

  .turn {
    max-width: 95%;
  }
}

.plan-review {
  padding: clamp(23px, 4vw, 36px);
  max-width: 880px;
  border-radius: 27px;
  background:
    radial-gradient(circle at 100% 0, #ffe0b3 0, transparent 33%), #fffaf2;
  box-shadow: 0 16px 38px rgba(116, 67, 43, 0.08);
}

.plan-heading {
  display: flex;
  align-items: center;
  gap: 13px;
}

.plan-heading span,
.active-objective > span {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #9c5d49;
}

.plan-heading h2 {
  margin: 3px 0;
  font-size: clamp(1.45rem, 2.5vw, 2rem);
  line-height: 1.12;
  letter-spacing: -0.025em;
}

.plan-review > p {
  color: var(--ink-soft);
  font-size: 0.82rem;
}

.objectives {
  display: grid;
  gap: 10px;
  padding-left: 23px;
}

.objectives li {
  padding: 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
}

.objectives strong {
  font-size: 0.84rem;
}

.objectives p {
  margin: 5px 0 10px;
  font-size: 0.78rem;
  color: var(--ink-soft);
}

.plan-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.plan-actions button,
.progress-recommendation button {
  padding: 11px 16px;
  border-radius: 999px;
  background: #9c5d49;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
}

.plan-actions button.secondary {
  background: #f4e9e2;
  color: #744d3d;
}

.plan-actions button:disabled {
  opacity: 0.55;
}

.active-objective {
  display: grid;
  gap: 6px;
  margin-bottom: 18px;
  padding: 12px;
  border-radius: 15px;
  background: #ffe6c4;
}

.active-objective strong {
  font-size: 0.85rem;
}

.active-objective small {
  color: var(--ink-soft);
  font-size: 0.7rem;
}

.active-objective .source {
  display: inline-block;
  margin: 3px;
}

.progress-recommendation {
  margin-bottom: 18px;
  padding: 12px;
  border-radius: 15px;
  background: #eaf4ef;
}

.progress-recommendation strong {
  font-size: 0.78rem;
}

.progress-recommendation p {
  font-size: 0.72rem;
  color: var(--ink-soft);
}

.lesson-path {
  margin: 0 0 20px;
  padding: 13px;
  border-radius: 15px;
  background: #fffdf8;
}

.lesson-path strong {
  font-size: 0.76rem;
}

.lesson-path ol {
  margin: 10px 0;
  padding-left: 0;
  display: grid;
  list-style: none;
  counter-reset: stage;
}

.lesson-path li {
  position: relative;
  min-height: 34px;
  padding: 7px 0 7px 35px;
  color: #65676c;
  font-size: 0.7rem;
  counter-increment: stage;
}

.lesson-path li::before {
  position: absolute;
  left: 0;
  top: 3px;
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #eeeae5;
  color: #817b76;
  font-size: 0.64rem;
  font-weight: 850;
  content: counter(stage);
}

.lesson-path li:not(:last-child)::after {
  position: absolute;
  top: 29px;
  bottom: -3px;
  left: 12px;
  width: 1px;
  background: #ded8d2;
  content: "";
}

.lesson-path li.complete {
  color: #30675b;
  font-weight: 800;
}

.lesson-path li.complete::before {
  background: #d7ece5;
  color: #246858;
}

.lesson-path li.current {
  color: #9b5133;
  font-weight: 850;
}

.lesson-path li.current::before {
  background: #fbe2cf;
  color: #a34d2c;
}

.lesson-path p {
  margin: 8px 0 0;
  color: #7b4d3a;
  font-size: 0.72rem;
  font-weight: 800;
}

.turn-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.listen-button {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  color: #805342;
  font-size: 0.68rem;
  font-weight: 800;
}

.ready-panel {
  padding: 19px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid #f0dfd0;
  background: #fff8ef;
}

.ready-panel p {
  font-size: 0.78rem;
  color: var(--ink-soft);
}

.ready-panel button,
.send-recording {
  min-height: 46px;
  padding: 0 20px;
  border-radius: 999px;
  background: var(--air-orange);
  color: #fff;
  font-size: 0.77rem;
  font-weight: 850;
  transition:
    transform 0.18s ease,
    background 0.18s ease;
}

.ready-panel button:hover:not(:disabled),
.send-recording:hover:not(:disabled) {
  transform: translateY(-2px);
  background: #bb522c;
}

.ready-panel button:active:not(:disabled),
.send-recording:active:not(:disabled) {
  transform: translateY(1px);
}

.ready-panel button:disabled {
  opacity: 0.5;
}

.record-controls {
  padding: 18px 20px 22px;
  display: grid;
  gap: 12px;
  justify-items: center;
  border-top: 1px solid #ede6e2;
}

.record-context {
  display: grid;
  gap: 4px;
  text-align: center;
}

.record-context strong {
  font-size: 0.8rem;
}

.record-context span {
  color: var(--ink-soft);
  font-size: 0.7rem;
}

.record-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 13px;
}

.record-button {
  width: 82px;
  height: 82px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--air-orange);
  color: #fff;
  box-shadow: 0 0 0 7px #f5e9e3;
  transition:
    background 150ms ease,
    box-shadow 180ms cubic-bezier(0.165, 0.84, 0.44, 1);
}

.record-button.recording {
  background: #be3d3d;
  box-shadow: 0 0 0 7px #fae3e0;
}

.record-button:hover:not(:disabled) {
  box-shadow:
    0 0 0 7px #f5e9e3,
    0 12px 26px rgba(164, 76, 38, 0.22);
}

.record-button:disabled {
  opacity: 0.5;
}

.send-recording {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2e625a;
}

.rerecord {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #805342;
  font-size: 0.73rem;
  font-weight: 800;
}

.meter {
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.meter span {
  width: 5px;
  height: 25px;
  border-radius: 99px;
  background: #c4aaa0;
  transform-origin: center;
  transition:
    transform 120ms linear,
    background 150ms ease;
}

.meter.recording span {
  background: #bd5148;
}

@media (max-width: 510px) {
  .ready-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .ready-panel button {
    width: 100%;
  }

  .record-controls {
    padding-bottom: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .record-button,
  .meter span {
    transition: none;
  }

  .activity-dot {
    animation: none;
  }
}

.voice-usage {
  margin-bottom: 18px;
  padding: 13px;
  display: grid;
  gap: 5px;
  border-radius: 15px;
  background: #ffe6c5;
}

.voice-usage strong {
  color: var(--air-deep);
  font-size: 0.86rem;
  line-height: 1.3;
}

.usage-label {
  color: #9b512e !important;
  font-size: 0.61rem !important;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.voice-progress {
  height: 8px;
  overflow: hidden;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.85);
}

.voice-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--air-orange);
  transition: width 0.25s ease;
}

.voice-usage span,
.voice-usage small {
  font-size: 0.68rem;
  color: var(--ink-soft);
}

.voice-usage small {
  line-height: 1.4;
}

/* The voice room is the main session surface in both Flowst and standalone Flowst Air. */
.study-layout.voice-room {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  grid-template-areas: "guide stage";
  gap: 0;
  border: 1px solid #e8eef6;
  border-radius: 26px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 16px 44px rgba(70, 81, 104, 0.08);
}

.voice-room .mode-panel {
  grid-area: guide;
  border: 0;
  border-radius: 0;
  padding: 22px 18px;
  box-shadow: none;
  background: #fff;
}

.voice-stage {
  grid-area: stage;
  position: relative;
  isolation: isolate;
  min-width: 0;
  min-height: 670px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 24px;
  background:
    radial-gradient(ellipse at 70% 25%, #fce8cd, transparent 65%), #ead5bc;
  overflow: hidden;
}

.voice-room-heading {
  position: absolute;
  z-index: 2;
  top: 22px;
  left: 24px;
  right: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: #392d25;
}

.voice-room-heading span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Unbounded", sans-serif;
  font-size: 0.72rem;
}

.voice-room-heading small {
  font-size: 0.68rem;
}

.voice-stage .air-presence {
  position: absolute;
  z-index: -1;
  inset: 0;
  height: auto;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.voice-stage .air-presence img {
  inset: 45px 0 0;
  width: 100%;
  height: calc(100% - 45px);
  object-fit: contain;
  object-position: center bottom;
}

.voice-stage .air-presence::after {
  inset: 60% 0 0;
  background: linear-gradient(transparent, rgba(46, 31, 23, 0.35));
}

.voice-speech-bubble {
  position: absolute;
  top: 96px;
  right: 20px;
  width: min(235px, 39%);
  padding: 16px;
  border-radius: 18px 18px 18px 3px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 5px 22px rgba(74, 48, 24, 0.08);
}

.voice-speech-bubble span {
  color: #9d4920;
  font-size: 0.65rem;
  font-weight: 700;
}

.voice-speech-bubble p {
  color: #302e2d;
  margin: 6px 0 0;
  font-size: 0.82rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.voice-stage .conversation-activity {
  position: absolute;
  top: 270px;
  right: 20px;
  width: min(235px, 39%);
  padding: 15px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.9);
}

.voice-stage .activity-context {
  display: none;
}

.voice-stage .activity-state strong {
  color: #343946;
  font-size: 0.76rem;
}

.voice-stage .activity-state p {
  color: #53596a;
  font-size: 0.72rem;
  line-height: 1.5;
}

.voice-dock {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 24px;
  background: rgba(36, 29, 26, 0.87);
  backdrop-filter: blur(12px);
  color: #fff;
}

.voice-dock .record-controls {
  padding: 0;
  border: 0;
  gap: 10px;
  width: 100%;
}

.voice-dock .record-context strong {
  font-size: 0.85rem;
}

.voice-dock .record-context span {
  color: #ede0d6;
}

.voice-dock .record-button {
  width: 58px;
  height: 58px;
  box-shadow: none;
  background: #c95628;
}

.voice-dock .record-button.recording {
  background: #b83333;
}

.voice-dock .send-recording {
  background: #fff;
  color: #282625;
}

.voice-dock .rerecord {
  background: transparent;
  color: #fff;
}

.voice-dock .meter {
  height: 20px;
}

.voice-dock .meter span {
  height: 20px;
  background: #baaea5;
}

.voice-dock .meter.recording span {
  background: #ed8a3d;
}

.voice-dock .ready-panel {
  border: 0;
  background: transparent;
  padding: 0;
  text-align: center;
}

.voice-dock .ready-panel p {
  color: #ede0d6;
}

.room-playback {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.74rem;
}

.voice-stage button:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 4px;
}

.session-transcript {
  margin-top: 22px;
  border: 1px solid #e8eef6;
  border-radius: 18px;
  background: #fff;
  overflow: hidden;
}

.session-transcript summary {
  display: flex;
  gap: 12px;
  align-items: center;
  cursor: pointer;
  min-height: 64px;
  padding: 18px 22px;
  color: #343946;
  font-size: 0.85rem;
  font-weight: 700;
}

.session-transcript summary small {
  margin-left: auto;
  font-weight: 500;
  color: #53596a;
}

.session-transcript .conversation {
  border: 0;
  border-radius: 0;
}

.voice-room .lesson-path li {
  color: #53596a;
}

.voice-room .mode-panel h2 {
  font-family: "Unbounded", sans-serif;
  font-size: 0.8rem;
}

@media (max-width: 1000px) {
  .study-layout.voice-room {
    grid-template-columns: 200px minmax(0, 1fr);
  }

  .voice-stage {
    padding: 16px;
  }

  .voice-speech-bubble,
  .voice-stage .conversation-activity {
    right: 14px;
  }
}

@media (max-width: 767px) {
  .study-layout.voice-room {
    display: flex;
    flex-direction: column-reverse;
    border-radius: 20px;
  }

  .voice-stage {
    min-height: 660px;
    padding: 14px;
  }

  .voice-stage .air-presence img {
    inset: 75px 0 0;
    width: 100%;
    height: calc(100% - 75px);
    object-position: center bottom;
  }

  .voice-room-heading {
    top: 18px;
    left: 16px;
    right: 16px;
  }

  .voice-room-heading small {
    font-size: 0.6rem;
  }

  .voice-speech-bubble {
    top: 75px;
    width: 48%;
    right: 12px;
    padding: 12px;
  }

  .voice-speech-bubble p {
    font-size: 0.74rem;
    -webkit-line-clamp: 4;
  }

  .voice-stage .conversation-activity {
    top: 235px;
    right: 12px;
    width: 47%;
    padding: 12px;
  }

  .voice-dock {
    padding: 15px 10px;
  }

  .voice-room .mode-panel {
    padding: 22px;
  }

  .session-transcript summary {
    padding: 16px;
    flex-wrap: wrap;
    font-size: 0.75rem;
  }

  .session-transcript summary small {
    margin-left: 30px;
  }
}

.study-layout.voice-room {
  align-items: stretch;
}

.voice-room .mode-choice {
  min-height: 58px;
  padding: 10px;
  margin-bottom: 8px;
}

.voice-room .source-note {
  display: none;
}

.voice-room .lesson-path,
.voice-room .voice-usage {
  margin-bottom: 16px;
}

.voice-stage .air-presence img {
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 22%;
}

.voice-stage .meter {
  height: 27px;
  margin-top: 8px;
}

.voice-stage .meter.recording span {
  background: #b6531b;
}

.voice-dock {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
}

.voice-dock .record-controls {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
}

.voice-dock .record-context {
  text-align: left;
}

.voice-dock .record-actions {
  gap: 10px;
}

.voice-dock .error {
  grid-column: 1/-1;
  margin: 0;
}

@media (max-width: 1000px) {
  .voice-dock {
    grid-template-columns: 1fr;
  }

  .voice-dock .room-playback {
    justify-self: center;
  }
}

@media (max-width: 767px) {
  .voice-stage {
    width: 100%;
    min-height: 610px;
  }

  .voice-stage .air-presence img {
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
  }

  .voice-stage .conversation-activity {
    position: relative;
    top: auto;
    bottom: auto;
    left: auto;
    right: auto;
    width: 100%;
    padding: 12px;
    margin-bottom: 8px;
  }

  .voice-stage .activity-state p {
    display: none;
  }

  .voice-stage .meter {
    height: 18px;
    margin-top: 4px;
  }

  .voice-stage .meter span {
    height: 18px;
  }

  .voice-dock {
    padding: 12px;
    gap: 8px;
  }

  .voice-dock .record-context strong {
    font-size: 0.74rem;
  }

  .voice-dock .record-context span {
    font-size: 0.66rem;
  }

  .voice-dock .record-actions {
    gap: 6px;
  }

  .voice-dock .send-recording {
    padding: 0 10px;
  }

  .voice-dock .record-controls:has(.send-recording) {
    grid-template-columns: 1fr;
  }
}

.session-active {
  height: 100%;
  min-height: 0;
  min-width: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-active .session-recap {
  flex: none;
  max-height: 25%;
  overflow: auto;
  padding: 16px;
  margin: 0;
}
</style>

<style scoped>
.misu-review-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.study-brief {
  margin: 14px 0;
  padding: 16px;
  background: #f7faff;
  border: 1px solid #dbdee5;
  border-radius: 14px;
  overflow-wrap: anywhere;
}

.study-brief strong {
  color: #0d0f14;
  font-size: 0.95rem;
}

.study-brief p {
  color: #464a53;
  font-size: 0.85rem;
  line-height: 1.6;
  margin: 6px 0;
}

.study-brief small {
  color: #464a53;
  font-size: 0.78rem;
  line-height: 1.5;
}

.objective-time {
  display: block;
  margin: 4px 0;
  color: #464a53;
}

.session-objectives {
  padding-left: 22px;
  font-size: 0.85rem;
  line-height: 1.6;
}

.session-objectives li {
  margin-bottom: 10px;
}

.session-objectives li[aria-current="step"] {
  color: #205c99;
}
</style>
