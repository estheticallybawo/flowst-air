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
import { studySpeechOutcome } from "~/shared/studySpeechOutcome";
import {
  spokenCaption,
  validSpeechAlignment,
  type TimedStudySpeech,
} from "~/shared/studySpeech";
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
  if (paced.value) void pacing.change("PAUSE");
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
const voiceInputUsed = computed(() => study.value?.voiceUsage?.transcribeSeconds || 0);
const voiceOutputUsed = computed(() => study.value?.voiceUsage?.pollyCharacters || 0);
const pacing = useStudyPacing(id);
const paced = computed(() => Boolean(study.value?.plan.pacing));
const pacingBlocked = computed(
  () => paced.value && pacing.current.value?.phase !== "PRACTICE",
);
const deferredReplyId = ref(""),
  captionTurnId = ref(""),
  spokenText = ref("");
const speechPackets = new Map<string, TimedStudySpeech>();
async function skipBreak() {
  if (await pacing.change("SKIP_BREAK")) {
    if (journey.value.checkpointReady) sessionPane.value = "checkpoint";
    else await resumePractice();
  }
}
async function pausePractice() {
  live.stop();
  stopMicrophone();
  await pacing.change("PAUSE");
}
async function resumePractice() {
  if (!paced.value || (await pacing.change("RESUME"))) {
    if (recordedPracticeMode.value && !introductionTurn.value)
      await beginLesson();
  }
}

const initialLoading = ref(true);
const handoffTransition = useAgentHandoff(),
  kaiTransition = useAgentHandoff();
const celebration = ref("");
const journey = computed(
  () =>
    study.value?.journey || {
      completedObjectiveIds: [],
      totalObjectives: study.value?.plan.objectives.length || 0,
      checkpointReady: false,
      kaiReady: false,
    },
);
const journeyStage = computed(() =>
  "review" === sessionPane.value
    ? "KAI"
    : conversationStarted.value || handoffReady.value
      ? "AMINA"
      : "MISU",
);
const speechFailureMessage = ref(""),
  speechRetryable = ref(true);
async function continueCheckpoint() {
  celebration.value = "";
  if (journey.value.kaiReady) {
    stopCurrentPlayback();
    if (paced.value) await pacing.change("PAUSE").catch(() => false);
    await kaiTransition.prepare();
    if (!disposed) sessionPane.value = "review";
  } else {
    sessionPane.value = "";
    if (paced.value && !(await pacing.change("START"))) return;
    await beginLesson();
  }
}

// Recorded exercises are separate from the live room, preserving saved practice compatibility.
const recordedPracticeMode = computed(() => route.query.practice !== "live");
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
  if (pacingBlocked.value) return;
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
const sourceInfoOpen = ref(false);
const adjustedPreferences = ref({ ...DEFAULT_STUDY_PREFERENCES });
const planPhaseLabels: Record<string, string> = {
  READING_SOURCE: "I’m reading the included material.",
  PREPARING_GOALS: "I’m preparing your practice goals.",
  CHECKING_REFERENCES: "I’m checking the plan’s source references.",
  PLAN_READY: "Your draft is ready to review.",
};
const voiceTurnPhase = ref("");
let voiceProgressPoll: ReturnType<typeof setTimeout> | undefined;
function pollVoiceProgress(takeId: string) {
  clearTimeout(voiceProgressPoll);
  voiceProgressPoll = setTimeout(async () => {
    if (
      disposed ||
      recorderStatus.value !== "SENDING" ||
      recordingId !== takeId
    )
      return;
    try {
      const result = await auth.authorizedFetch<{
        progress: { recordingId: string; phase: string } | null;
      }>(
        `/api/study/conversations/${id.value}/recorded-turn?recordingId=${takeId}`,
      );
      if (
        !disposed &&
        recordingId === takeId &&
        result.progress?.recordingId === takeId
      )
        voiceTurnPhase.value = result.progress.phase;
    } catch {
      /* Keep the generic pending state if status metadata is unavailable. */
    }
    if (
      !disposed &&
      recorderStatus.value === "SENDING" &&
      recordingId === takeId
    )
      pollVoiceProgress(takeId);
  }, 1000);
}
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
watch(
  () => [
    pacing.current.value?.phase,
    recorderStatus.value,
    busy.value,
    playingTurnId.value,
    preparingSpeechTurnId.value,
    deferredReplyId.value,
    microphoneRequesting.value,
    live.running.value,
  ],
  async () => {
    if (
      pacing.current.value?.phase === "BREAK_DUE" &&
      recorderStatus.value === "IDLE" &&
      !busy.value &&
      !playingTurnId.value &&
      !preparingSpeechTurnId.value &&
      !deferredReplyId.value &&
      !microphoneRequesting.value &&
      !pacing.busy.value
    ) {
      if (live.running.value) live.stop();
      stopMicrophone();
      await pacing.change("BREAK");
    }
  },
);
const activeObjective = computed(() =>
  study.value?.plan.objectives.find(
    (objective) => objective.id === study.value?.plan.activeObjectiveId,
  ),
);
const sessionPane = ref<
  "plan" | "context" | "checkpoint" | "review" | "options" | ""
>("");
const conversationVisible = ref(false);

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
    (turn) =>
      turn.kind === "INTRO" &&
      turn.role === "AMIRA" &&
      (turn.objectiveId === study.value?.plan.activeObjectiveId ||
        (!turn.objectiveId && objectiveIndex.value === 0)),
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
      label: "Audio unavailable",
      detail: speechFailureMessage.value,
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
      label:
        voiceTurnPhase.value === "TRANSCRIBING"
          ? "Turning your recording into text"
          : voiceTurnPhase.value === "CHOOSING_ACTIVITY"
            ? "Amina is choosing a practice activity"
            : voiceTurnPhase.value === "DRAFTING_REPLY"
              ? "Amina is preparing your reply"
              : "Processing your answer",
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
      label: captionTurnId.value
        ? "Buffering Amina’s audio"
        : "Preparing Amina’s voice",
      detail:
        "Audio is being prepared. You can open the full saved reply while you wait.",
    };
  if (busy.value && !playingTurnId.value)
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
  if (
    paced.value &&
    ["BREAK", "PAUSED"].includes(pacing.current.value?.phase || "")
  )
    return {
      phase: "ready",
      label:
        pacing.current.value?.phase === "BREAK"
          ? "Take a break"
          : "Practice is paused",
      detail:
        "Microphone off. Resume when you are ready and the timer allows it.",
    };
  if (!readyToPractice.value)
    return {
      phase: "ready",
      label: "Ready for your introduction",
      detail: "Tap I’m ready when you want to begin.",
    };
  return {
    phase: "ready",
    label: "Amina is waiting for your turn",
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
      ? `${study.value.document.title || study.value.document.name} · Flowst Airs`
      : "Study session · Flowst Airs",
  ),
});

async function load() {
  const loaded = await auth.authorizedFetch<StudyConversation>(
    `/api/study/conversations/${id.value}`,
  );
  if (disposed || (study.value && loaded.revision < study.value.revision)) return;
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
  if (voiceProgressPoll) clearTimeout(voiceProgressPoll);
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
    if (automaticWelcome) deferredReplyId.value = welcomeId || "";
    if (!welcomeTurn.value) throw new Error("Welcome unavailable");
    handoffBusy.value = false;
    if (automaticWelcome) await handoffTransition.prepare();
    if (disposed || mediaStopped) return;
    handoffReady.value = true;
    await nextTick();
    document
      .querySelector<HTMLElement>(".prepared-handoff")
      ?.focus({ preventScroll: true });
    if (!handoffReady.value) throw new Error("Welcome unavailable");
    handoffBusy.value = false;
    if (automaticWelcome && welcomeId && !document.hidden)
      await playSpeech(welcomeId, true);
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
  if (paced.value && !(await pacing.change("START"))) return;
  conversationStarted.value = true;
  if (recordedPracticeMode.value) await beginLesson();
  else await startLiveCall();
}

async function confirmNext() {
  const objectiveId = study.value?.plan.recommendation?.objectiveId;
  if (!objectiveId || planBusy.value || live.running.value) return;
  const completedTitle = activeObjective.value?.title || "Your objective";
  planBusy.value = true;
  try {
    study.value = await auth.authorizedFetch<StudyConversation>(
      `/api/study/conversations/${id.value}/plan/confirm`,
      { method: "POST", body: { objectiveId } },
    );
    const confirmedTitle = completedTitle;
    await load();
    if (journey.value.completedObjectiveIds.length) {
      celebration.value = confirmedTitle;
      sessionPane.value = "";
    }
    if (paced.value) await pacing.refresh();
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
      if (paced.value) {
        await pacing.refresh();
        if (pacing.current.value?.phase === "PRACTICE")
          await pacing.change("PAUSE");
      }
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
    voiceFailureTurnId.value ||
    pacingBlocked.value
  )
    return;
  busy.value = true;
  error.value = "";
  try {
    const response = await auth.authorizedFetch<{ agentTurn?: StudyTurn }>(
      `/api/study/conversations/${id.value}/control`,
      { method: "POST", body: { action } },
    );
    deferredReplyId.value = response.agentTurn?.id || "";
    if (
      response.agentTurn &&
      study.value &&
      !study.value.turns.some((turn) => turn.id === response.agentTurn!.id)
    )
      study.value.turns.push(response.agentTurn);
    const playbackWork = response.agentTurn?.id
      ? playSpeech(response.agentTurn.id, true)
      : Promise.resolve();
    await load();
    await playbackWork;
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
  if (!canStudy.value || disposed || live.running.value || pacingBlocked.value)
    return;
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
    recordingId = crypto.randomUUID();
    if (paced.value && !(await pacing.change("RECORD", recordingId))) {
      stopMicrophone();
      return;
    }
    if (disposed || mediaStopped || request !== microphoneRequest) {
      stopMicrophone();
      return;
    }
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
      recordingId = recordedAudio.size
        ? recordingId || crypto.randomUUID()
        : undefined;
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
  voiceTurnPhase.value = "";
  pollVoiceProgress((recordingId ||= crypto.randomUUID()));
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
    clearTimeout(voiceProgressPoll);
    error.value = learnerStudyError(
      cause,
      requestStarted
        ? "We could not confirm whether your recording was saved. Your take is still here; check the transcript or retry sending this same take."
        : "We could not prepare that recording. It is still here; retry or record again.",
    );
    if (requestStarted) void load().catch(() => undefined);
    return;
  }
  // The POST acknowledged the saved turn. Refreshing the view or playing audio
  // may still fail, but neither can make this take unsent or available to resend.
  if (disposed || generation !== microphoneRequest) return;
  recordedAudio = undefined;
  recordingId = undefined;
  recorderStatus.value = "IDLE";
  clearTimeout(voiceProgressPoll);
  deferredReplyId.value = response.agentTurn?.id || "";
  const playbackWork = response.agentTurn?.id
    ? playSpeech(response.agentTurn.id, true)
    : Promise.resolve();
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
  await playbackWork;
}

function stopCurrentPlayback() {
  playbackRequest++;
  playback?.pause();
  playingTurnId.value = "";
  preparingSpeechTurnId.value = "";
  deferredReplyId.value = "";
  captionTurnId.value = "";
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

async function playSpeech(turnId: string, automatic = false, retry = false) {
  if (disposed || live.running.value || (automatic && mediaStopped)) return;
  if (!automatic) mediaStopped = false;
  if (!automatic && playingTurnId.value === turnId && playback) {
    stopCurrentPlayback();
    return;
  }
  const request = ++playbackRequest;
  playback?.pause();
  playingTurnId.value = "";
  deferredReplyId.value = turnId;
  captionTurnId.value = "";
  spokenText.value = "";
  preparingSpeechTurnId.value = turnId;
  audioPromptTurnId.value = "";
  let url = speechUrls.get(turnId);
  if (!url && !canStudy.value) {
    deferredReplyId.value = "";
    preparingSpeechTurnId.value = "";
    return;
  }
  try {
    if (!url) {
      const packet = await auth.authorizedFetch<TimedStudySpeech>(
        `/api/study/conversations/${id.value}/speech`,
        { method: "POST", body: { turnId, withTimestamps: true, retry } },
      );
      if (request !== playbackRequest || disposed) return;
      const data = Uint8Array.from(atob(packet.audioBase64), (character) =>
        character.charCodeAt(0),
      );
      url = URL.createObjectURL(new Blob([data], { type: packet.mimeType }));
      packet.alignment = validSpeechAlignment(packet.alignment);
      packet.audioBase64 = "";
      speechPackets.set(turnId, packet);
      speechUrls.set(turnId, url);
      void load().catch(() => undefined);
    }
    if (request !== playbackRequest) return;
    const audio = (playback ||= new Audio());
    audio.src = url;
    const caption = () => {
      if (request !== playbackRequest) return;
      const packet = speechPackets.get(turnId);
      captionTurnId.value = turnId;
      spokenText.value = spokenCaption(
        packet?.alignment || null,
        packet?.spokenText ||
          study.value?.turns.find((turn) => turn.id === turnId)?.text ||
          "",
        audio.currentTime,
      );
    };
    audio.onplaying = () => {
      if (request !== playbackRequest) return;
      playingTurnId.value = turnId;
      preparingSpeechTurnId.value = "";
      caption();
    };
    audio.ontimeupdate = caption;
    audio.onwaiting = () => {
      if (request !== playbackRequest) return;
      playingTurnId.value = "";
      preparingSpeechTurnId.value = turnId;
    };
    audio.onpause = () => {
      if (request !== playbackRequest) return;
      playingTurnId.value = "";
    };
    audio.onerror = () => {
      if (request !== playbackRequest) return;
      speechFailureMessage.value =
        "This browser could not play the saved audio. Read the response in Conversation or try playback again.";
      speechRetryable.value = true;
      voiceFailureTurnId.value = turnId;
      playingTurnId.value = "";
      preparingSpeechTurnId.value = "";
      deferredReplyId.value = "";
      captionTurnId.value = "";
    };
    audio.onended = () => {
      if (request !== playbackRequest) return;
      playingTurnId.value = "";
      preparingSpeechTurnId.value = "";
      deferredReplyId.value = "";
      captionTurnId.value = "";
      spokenText.value = "";
    };
    await audio.play();
    if (request === playbackRequest) {
      playbackPrimed = true;
      preparingSpeechTurnId.value = "";
      if (!audio.paused) playingTurnId.value = turnId;
      if (voiceFailureTurnId.value === turnId) voiceFailureTurnId.value = "";
    }
  } catch (cause: any) {
    if (request !== playbackRequest) return;
    preparingSpeechTurnId.value = "";
    playingTurnId.value = "";
    deferredReplyId.value = "";
    captionTurnId.value = "";
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
    const outcome = studySpeechOutcome(cause);
    speechFailureMessage.value = outcome.message;
    speechRetryable.value = outcome.retryable;
    error.value = "";
    // A dispatched request may reserve allowance even when no audio arrives.
    void load().catch(() => undefined);
  }
}

async function retryVoice() {
  const turnId = voiceFailureTurnId.value;
  if (!turnId || preparingSpeechTurnId.value || !speechRetryable.value) return;
  error.value = "";
  if (audioPromptTurnId.value === turnId) {
    await playSpeech(turnId);
    return;
  }
  primePlayback();
  await playSpeech(turnId, true, true);
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
  <AirStudyShell :session="sessionActive" workspace>
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
    <AgentActivity
      v-if="initialLoading"
      agent="MISU"
      :busy="true"
      state="working"
      label="Loading your saved learning workspace."
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
    <div
      v-else
      class="study-page app-workspace"
      :class="{
        'session-active': sessionActive,
        'archived-workspace': study.abandonedAt,
      }"
    >
      <nav v-if="!sessionActive" class="setup-room-nav">
        <NuxtLink to="/airs/library">Saved sessions</NuxtLink
        ><span>{{ study.document.title || study.document.name }}</span
        ><button
          v-if="study.document.provenance"
          @click="sourceInfoOpen = true"
        >
          Source details</button
        ><button @click="leaveSession">Leave session</button>
      </nav>
      <AirFocusDialog
        v-if="study.document.provenance"
        id="reviewed-source-info"
        :open="sourceInfoOpen"
        title="Source you reviewed"
        @close="sourceInfoOpen = false"
      >
        <AirSourceProvenance :provenance="study.document.provenance" />
      </AirFocusDialog>
      <div v-if="sessionActive" class="session-toolbar">
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
      </div>
      <AirsJourneyRail
        :stage="journeyStage"
        :setup-progress="study.plan.status === 'APPROVED' ? 100 : 75"
        :completed="journey.completedObjectiveIds.length"
        :total="journey.totalObjectives"
        :review-ready="journey.kaiReady"
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
          :pending-text-id="deferredReplyId"
          :caption-id="captionTurnId"
          :caption-text="spokenText"
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
        <div class="plan-review-body">
          <MisuPlanGuide
            :plan="study.plan"
            :preferences="preferences"
            :preparing="planPreparing"
            :saving-approval="planBusy && !planPreparing"
          />
          <p v-if="study.plan.status === 'FAILED'">
            {{
              learnerStudyError(
                { data: { statusMessage: study.plan.error } },
                "Your plan could not be prepared. Try again below.",
              )
            }}
          </p>
          <AirsPlanOverview
            v-if="study.plan.status === 'DRAFT'"
            :plan="study.plan"
            :preferences="preferences"
          />
          <p v-if="error" class="error" role="alert">
            <CircleAlert :size="16" /> {{ error }}
          </p>
          <p
            v-if="study.plan.status === 'DRAFT' && !recordedPracticeMode"
            class="plan-call-note"
          >
            Approving prepares your session with Amina. Your microphone stays
            off until you choose Start conversation. Each pilot call reserves 60
            seconds, including unused time.
            <NuxtLink to="/airs/about">Microphone &amp; privacy</NuxtLink>
          </p>
        </div>
        <AirFocusDialog
          id="adjust-session-plan"
          :open="adjustingPlan"
          title="Adjust your plan"
          @close="adjustingPlan = false"
          ><section
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
              >Practice time per topic<input
                v-model.number="adjustedPreferences.pacing!.practiceMinutes"
                type="number"
                min="5"
                max="15"
            /></label>
            <label
              >Break length<select
                v-model.number="adjustedPreferences.pacing!.breakMinutes"
              >
                <option :value="3">3 minutes</option>
                <option :value="5">5 minutes</option>
              </select></label
            >
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
          </section></AirFocusDialog
        >
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
                : ((adjustedPreferences = {
                    ...preferences,
                    pacing: {
                      ...(preferences.pacing || {
                        mode: 'TOPIC_BLOCKS',
                        practiceMinutes: 5,
                        breakMinutes: 3,
                      }),
                    },
                  }),
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
              : handoffTransition.active.value
                ? 'Your context, source and approved plan are ready for Amina. Take a moment before we continue.'
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
                : handoffTransition.active.value
                  ? 'Your welcome is saved. Take a moment before meeting Amina.'
                  : 'Preparing your first practice. Microphone off.'
          "
        />
        <div v-if="handoffTransition.active.value" class="handoff-actions">
          <p role="status">
            Amina is next · {{ handoffTransition.remaining.value }} seconds
          </p>
          <button @click="handoffTransition.continueNow">Continue now</button>
        </div>
        <p v-if="handoffError" role="alert">{{ handoffError }}</p>
        <button
          v-if="handoffError"
          :disabled="handoffBusy"
          @click="prepareHandoff(true)"
        >
          Retry preparation
        </button>
        <template v-if="handoffReady"
          ><div class="welcome-reader">
            <h2>Hi, I’m Amina.</h2>
            <p v-if="captionTurnId === welcomeTurn?.id">
              {{ spokenText || "Playback starting…" }}
            </p>
            <template v-else-if="deferredReplyId === welcomeTurn?.id"
              ><p role="status">Preparing your spoken welcome…</p>
              <details>
                <summary>Read welcome now</summary>
                <p>{{ welcomeTurn?.text }}</p>
              </details></template
            >
            <p v-else>{{ welcomeTurn?.text }}</p>
            <p v-if="voiceFailureTurnId || audioPromptTurnId">
              Spoken playback is unavailable. You can read the welcome and start
              when ready.
            </p>
          </div>
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
          :study-minutes="
            study.plan.pacing?.practiceMinutes || preferences.timeBudgetMinutes
          "
          :pacing-label="
            study.plan.pacing
              ? `${study.plan.pacing.practiceMinutes} minutes per topic · ${study.plan.pacing.breakMinutes}-minute breaks`
              : undefined
          "
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
          :caption="recordedPracticeMode ? spokenText : live.caption.value"
          :caption-saved="recordedPracticeMode || live.savedCaption.value"
          :captions-visible="recordedPracticeMode || live.captionsVisible.value"
          :live-running="live.running.value"
          :plan-open="sessionPane === 'plan'"
          :conversation-open="conversationVisible"
          @close-plan="sessionPane = ''"
          @close-conversation="conversationVisible = false"
        >
          <template #plan>
            <AirsPlanOverview :plan="study.plan" :preferences="preferences" />
            <details>
              <summary>What this plan is based on</summary>
              <MisuPlanGuide :plan="study.plan" :preferences="preferences" />
            </details>
          </template>
          <template #controls>
            <section
              v-if="paced"
              class="practice-pacing"
              aria-label="Practice and break timer"
            >
              <strong>{{
                pacing.current.value?.phase === "BREAK"
                  ? "Recovery break"
                  : pacing.current.value?.phase === "BREAK_DUE"
                    ? "Finish this turn"
                    : pacing.current.value?.phase === "PAUSED"
                      ? "Paused"
                      : "Practice"
              }}</strong>
              <span class="pacing-clock" aria-label="Time remaining">{{
                pacing.clock.value
              }}</span>
              <button
                v-if="
                  pacing.current.value?.phase === 'BREAK' &&
                  pacing.remaining.value > 0
                "
                :disabled="pacing.busy.value"
                @click="skipBreak"
              >
                Skip break &amp; continue
              </button>
              <button
                v-if="
                  pacing.current.value?.phase === 'PAUSED' ||
                  (pacing.current.value?.phase === 'BREAK' &&
                    pacing.remaining.value === 0)
                "
                :disabled="pacing.busy.value"
                @click="resumePractice"
              >
                Resume practice
              </button>
              <button
                v-if="
                  pacing.current.value?.phase === 'PRACTICE' &&
                  recorderStatus === 'IDLE' &&
                  !busy &&
                  !playingTurnId &&
                  !preparingSpeechTurnId
                "
                :disabled="pacing.busy.value"
                @click="pausePractice"
              >
                Pause
              </button>
              <p v-if="pacing.error.value" role="alert">
                {{ pacing.error.value }}
              </p>
              <button
                v-if="
                  pacing.current.value?.phase === 'BREAK_DUE' &&
                  pacing.error.value &&
                  recorderStatus === 'IDLE' &&
                  !busy &&
                  !playingTurnId &&
                  !preparingSpeechTurnId
                "
                :disabled="pacing.busy.value"
                @click="pacing.change('BREAK')"
              >
                Retry break
              </button>
            </section>
            <div class="practice-tools">
              <button
                v-if="
                  !study.plan.courseCompletedAt &&
                  (journey.checkpointReady ||
                    study.plan.recommendationError ||
                    canReviewProgress)
                "
                @click="sessionPane = 'checkpoint'"
              >
                {{
                  journey.checkpointReady
                    ? "Review checkpoint"
                    : "Review progress"
                }}
              </button>
              <button v-if="journey.kaiReady" @click="sessionPane = 'review'">
                Kai’s review
              </button>
              <button @click="sessionPane = 'options'">Practice options</button>
            </div>
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
                  >Each pilot live call lasts up to 60 seconds. You can start
                  another call; earlier voice usage does not block it.
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
                  {{
                    speechFailureMessage ||
                    "Your saved reply is available in Conversation."
                  }}
                </p>
                <button
                  v-if="speechRetryable"
                  type="button"
                  :disabled="
                    !!preparingSpeechTurnId || !canStudy || !speechRetryable
                  "
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
                <button @click="conversationVisible = true">
                  Read saved reply
                </button>
              </div>
              <div
                v-if="recordedPracticeMode && !live.running.value"
                class="recorded-practice"
              >
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
                  <div
                    v-if="recorderStatus !== 'IDLE' || voiceFailureTurnId"
                    class="record-context"
                  >
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
                    <span v-if="voiceFailureTurnId">{{
                      speechRetryable
                        ? "Retry Amina’s voice above to continue."
                        : "Read your saved reply in Conversation. Voice practice is paused."
                    }}</span>
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
                        !!voiceFailureTurnId ||
                        (pacingBlocked && recorderStatus !== 'RECORDING') ||
                        !!preparingSpeechTurnId
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
              </div>
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
              :pending-text-id="deferredReplyId"
              :caption-id="captionTurnId"
              :caption-text="spokenText"
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
      <AirFocusDialog
        :open="sessionPane === 'checkpoint'"
        title="Your objective checkpoint"
        @close="sessionPane = ''"
      >
        <AgentActivity
          agent="MISU"
          :busy="planReviewing"
          state="working"
          :label="
            planReviewing
              ? 'Reviewing your saved attempt.'
              : 'Let’s review your progress.'
          "
        />
        <h3>{{ activeObjective?.title }}</h3>
        <p v-if="study.plan.recommendation">
          {{ study.plan.recommendation.reason }}
        </p>
        <p v-else>
          Your saved explanation can help us decide what to practise next.
        </p>
        <details v-if="hasCurrentEvidence">
          <summary>Saved evidence</summary>
          <article
            v-for="attempt in study.practice.attempts
              .filter((a) => a.objectiveId === study?.plan.activeObjectiveId)
              .slice(-3)"
            :key="attempt.evidenceId || attempt.answer"
          >
            <p>{{ attempt.answer }}</p>
            <AirCitation
              v-for="source in attempt.sources"
              :key="source.id"
              :source="source"
            />
          </article>
        </details>
        <p v-if="error" role="alert">{{ error }}</p>
        <div class="dialog-actions">
          <button
            v-if="journey.checkpointReady"
            :disabled="planBusy || live.running.value"
            @click="confirmNext"
          >
            {{
              study.plan.recommendation?.action === "COMPLETE"
                ? "Confirm objectives complete"
                : "Confirm checkpoint & continue"
            }}</button
          ><button
            v-else
            :disabled="!canReviewProgress || planBusy || live.running.value"
            @click="retryRecommendation"
          >
            {{ planBusy ? "Reviewing…" : "Review saved explanation" }}</button
          ><button @click="sessionPane = ''">Keep practising</button>
        </div>
        <p
          v-if="
            journey.checkpointReady &&
            paced &&
            study.plan.recommendation?.action === 'ADVANCE' &&
            (pacing.current.value?.phase !== 'BREAK' ||
              pacing.remaining.value > 0)
          "
        >
          Finish this practice block, then take or skip the recovery break.
        </p>
      </AirFocusDialog>
      <AirFocusDialog
        :open="Boolean(celebration)"
        title="Checkpoint saved"
        @close="celebration = ''"
      >
        <div class="checkpoint-celebration" role="status">
          <span aria-hidden="true">✓</span>
          <h3>You followed through on this objective.</h3>
          <p>{{ celebration }}</p>
        </div>
        <p>
          Your explanation and confirmed checkpoint are saved.
          {{
            journey.kaiReady
              ? "All planned objectives have evidence. Kai’s feedback is next."
              : "You’re ready for the next objective."
          }}
        </p>
        <div class="dialog-actions">
          <button @click="continueCheckpoint">
            {{
              journey.kaiReady ? "Prepare Kai’s review" : "Continue when ready"
            }}</button
          ><button @click="celebration = ''">Stay here</button>
        </div>
      </AirFocusDialog>
      <AirFocusDialog
        :open="kaiTransition.active.value"
        title="Kai is next"
        @close="kaiTransition.continueNow"
      >
        <AgentActivity
          agent="AMIRA"
          :busy="false"
          label="Your objective checkpoints are saved."
        /><AgentActivity
          agent="KAI"
          :busy="false"
          label="I’ll review the evidence against your approved goals."
        />
        <p role="status">
          Take a moment before your feedback ·
          {{ kaiTransition.remaining.value }} seconds
        </p>
        <div class="dialog-actions">
          <button @click="kaiTransition.continueNow">Continue now</button>
        </div>
      </AirFocusDialog>
      <AirFocusDialog
        :open="sessionPane === 'review'"
        title="Kai’s practice review"
        @close="sessionPane = ''"
      >
        <AirsKaiReview
          :conversation-id="id"
          :can-review="journey.kaiReady && !live.running.value"
        />
      </AirFocusDialog>
      <AirFocusDialog
        :open="sessionPane === 'options'"
        title="Practice options"
        @close="sessionPane = ''"
      >
        <details>
          <summary>Practice modes</summary>
          <p>{{ lessonStep }}</p>
          <div class="dialog-actions">
            <button
              v-for="mode in modes"
              :key="mode.id"
              :disabled="
                !canStudy ||
                !modeAvailable(mode.id) ||
                busy ||
                !!voiceFailureTurnId ||
                recorderStatus !== 'IDLE' ||
                live.running.value
              "
              :title="modeLockReason(mode.id)"
              @click="chooseMode(mode.id)"
            >
              {{ mode.label }}
            </button>
          </div>
        </details>
        <details open>
          <summary>Timing and voice practice</summary>
          <p v-if="paced">
            {{ study.plan.pacing?.practiceMinutes }} minutes per topic, with
            optional {{ study.plan.pacing?.breakMinutes }}-minute recovery
            breaks. Pause or skip a break whenever you need. Time does not
            complete an objective.
          </p>
          <section aria-label="Voice practice">
            <p>No cumulative voice limit applies to this study.</p>
            <p>
              Your speech input used: {{ voiceInputUsed }} seconds.
            </p>
            <p>
              Amina’s generated speech used: {{ voiceOutputUsed.toLocaleString() }}
              characters.
            </p>
            <p>
              The practice timer sets each topic block. Recordings can be up to
              two minutes per take. Speech characters measure text prepared
              for audio, not playback time.
            </p>
            <p>
              Saved audio can be replayed after a reload without another
              synthesis request. Video-source transcription has a separate budget.
            </p>
          </section>
        </details>
        <details v-if="study.document.provenance">
          <summary>Included source</summary>
          <AirSourceProvenance :provenance="study.document.provenance" />
        </details>
        <div class="dialog-actions">
          <button @click="remove"><Trash2 :size="16" /> Delete chat</button
          ><button @click="leaveSession">Leave session</button>
        </div>
      </AirFocusDialog>
    </div>
  </AirStudyShell>
</template>

<style scoped>
.session-active :deep(.journey-rail) {
  flex: none;
  margin: 0 auto;
  padding: 2px 0;
}
.practice-tools {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 12px;
}
.practice-tools button {
  border: 0;
  background: transparent;
  color: #456453;
  min-height: 44px;
  padding: 8px 12px;
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}
.checkpoint-celebration {
  text-align: center;
  padding: 12px 0;
}
.checkpoint-celebration > span {
  display: inline-grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #e0f0e5;
  color: #2b714c;
  font-size: 2rem;
  animation: checkpoint-arrive 0.3s ease-out;
}
@keyframes checkpoint-arrive {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .checkpoint-celebration > span {
    animation: none;
  }
}

.practice-pacing {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px 12px;
  align-items: center;
  padding: 4px 0 8px;
  border-bottom: 1px solid #d6e3dc;
  margin-bottom: 8px;
  text-align: left;
}
.practice-pacing strong {
  font-size: 0.85rem;
  line-height: 1.4;
}
.practice-pacing p,
.pacing-explanation {
  grid-column: 1/-1;
  max-width: 60ch;
}
.pacing-clock {
  font-variant-numeric: tabular-nums;
  font-size: 1rem;
}
.practice-pacing button {
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid #d6e3dc;
  border-radius: 999px;
  background: transparent;
  font-size: 0.8rem;
  cursor: pointer;
}
.practice-pacing button:focus-visible,
.pacing-explanation summary:focus-visible {
  outline: 3px solid #315d82;
  outline-offset: 3px;
}
.pacing-explanation summary {
  width: fit-content;
  font-size: 0.75rem;
  color: #464a53;
  cursor: pointer;
}
.pacing-explanation p {
  font-size: 0.8rem;
  line-height: 1.5;
  margin: 8px 0;
}
.practice-pacing button:hover {
  background: #eef3fb;
}

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
.app-workspace {
  height: 100%;
  min-height: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 1120px;
  margin: 0 auto;
}
.app-workspace.archived-workspace {
  overflow-y: auto;
}
.app-workspace :deep(.journey-rail) {
  flex: none;
  margin: 0 auto;
  padding: 0;
}
.app-workspace .setup-room-nav {
  margin: 0;
  flex-wrap: nowrap;
  gap: 12px;
  flex: none;
}
.setup-room-nav span {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  flex: 1;
}
.session-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: none;
  min-width: 0;
}
.session-toolbar :deep(.session-context) {
  flex: 1;
  min-width: 0;
  padding: 0;
  gap: 16px;
}
.app-workspace .plan-review {
  width: 100%;
  max-width: 920px;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-self: center;
  padding: clamp(16px, 2vw, 24px);
  border: 1px solid #d8e3dc;
  border-radius: 18px;
  background: #fff;
  box-shadow: none;
}
.plan-review-body {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 3px;
}
.app-workspace .plan-actions {
  flex: none;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e4ebe6;
}
.app-workspace .plan-review :deep(.agent-activity) {
  margin-bottom: 12px;
}
.app-workspace .prepared-handoff {
  width: 100%;
  max-width: 920px;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  padding: clamp(16px, 2vw, 24px);
  border-radius: 18px;
  overflow-y: auto;
}
.prepared-handoff :deep(.agent-activity) {
  margin-bottom: 12px;
  flex: none;
}
.welcome-reader {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 3px;
}
.welcome-reader h2 {
  font-size: 1.3rem;
  margin: 4px 0 12px;
}
.prepared-handoff .handoff-actions {
  flex: none;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e4ebe6;
}
@media (max-width: 767px) {
  .app-workspace .setup-room-nav {
    gap: 8px;
    font-size: 0.75rem;
  }
  .setup-room-nav > span {
    display: none;
  }
  .session-toolbar :deep(.session-context) {
    gap: 8px;
  }
  .app-workspace {
    gap: 4px;
  }
  .practice-tools {
    margin-bottom: 4px;
  }
}
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
