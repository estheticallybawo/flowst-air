import { microphoneError, safeProductMessage } from "~/shared/userErrors";
import { STUDY_LIVE_START_MESSAGE } from "~/shared/studyLive";
import { learnerStudyError } from "../shared/studyPresentation";

export function useAminaLiveCall(
  id: Ref<string>,
  onSaved: () => Promise<void>,
) {
  const auth = useAuth();
  const status = ref<
    "IDLE" | "CONNECTING" | "LISTENING" | "SPEAKING" | "ERROR"
  >("IDLE");
  const availability = ref<{
    enabled: boolean;
    socketUrl: string;
    message: string;
    provider?: string;
  } | null>(null);
  const availabilityLoading = ref(false);
  let availabilityRequest = 0;
  const error = ref("");
  const nextAction = ref("");
  const errorCode = ref("");
  const level = ref(0);
  const muted = ref(false);
  const caption = ref("");
  const captionsVisible = ref(true);
  const savedCaption = ref(false);
  const elapsedSeconds = ref(0);
  const hasConnected = ref(false);
  let connectedAt = 0;
  let elapsedTimer: ReturnType<typeof setInterval> | undefined;
  function markConnected() {
    hasConnected.value = true;
    if (!connectedAt) {
      connectedAt = Date.now();
      elapsedTimer = setInterval(() => {
        elapsedSeconds.value = Math.floor((Date.now() - connectedAt) / 1000);
      }, 1000);
    }
  }
  const running = computed(() =>
    ["CONNECTING", "LISTENING", "SPEAKING"].includes(status.value),
  );
  let socket: WebSocket | undefined;
  let mic: MediaStream | undefined;
  let context: AudioContext | undefined;
  let capture: AudioWorkletNode | undefined;
  let agent:
    | Awaited<
        ReturnType<
          typeof import("@elevenlabs/client").Conversation.startSession
        >
      >
    | undefined;
  let studyToken = "";
  let meter: ReturnType<typeof setInterval> | undefined;
  let syncing = false;
  const sources = new Set<AudioBufferSourceNode>();
  let cursor = 0;
  let epoch = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  async function checkAvailability() {
    const request = ++availabilityRequest;
    availabilityLoading.value = true;
    availability.value = null;
    error.value = "";
    try {
      const result = await auth.authorizedFetch<{
        enabled: boolean;
        socketUrl: string;
        message: string;
        provider?: string;
      }>("/api/study/conversations/" + id.value + "/live");
      if (request === availabilityRequest) availability.value = {
        ...result,
        message: result.message ? safeProductMessage(result.message, "Live calls are unavailable right now. Please try again.") : "",
      };
    } catch (cause) {
      if (request === availabilityRequest)
        error.value = learnerStudyError(
          cause,
          "We could not check live call availability. Try again.",
        );
    } finally {
      if (request === availabilityRequest) availabilityLoading.value = false;
    }
  }
  function clearPlayback() {
    for (const source of sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    sources.clear();
    cursor = context?.currentTime || 0;
  }
  function stop() {
    epoch++;
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = undefined;
    if (meter) clearInterval(meter);
    meter = undefined;
    if (agent) {
      agent.setMicMuted(true);
      agent.setVolume({ volume: 0 });
      void agent.endSession();
      agent = undefined;
    }
    if (studyToken) {
      const token = studyToken;
      studyToken = "";
      void auth
        .authorizedFetch("/api/study/conversations/" + id.value + "/live/end", {
          method: "POST",
          body: { studyToken: token },
        })
        .catch(() => {
          error.value =
            "The call stopped on this device. Its server reservation will expire shortly.";
        });
      void onSaved().catch(() => {});
    }
    if (timeout) clearTimeout(timeout);
    timeout = undefined;
    capture?.disconnect();
    capture = undefined;
    mic?.getTracks().forEach((track) => track.stop());
    mic = undefined;
    clearPlayback();
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ type: "end" }));
    socket?.close();
    socket = undefined;
    void context?.close();
    context = undefined;
    level.value = 0;
    muted.value = false;
    if (status.value !== "ERROR") status.value = "IDLE";
  }
  function fail(message: string) {
    error.value = safeProductMessage(message, "The call could not continue. Check your connection and try again.");
    status.value = "ERROR";
    stop();
  }
  function playAudio(base64: string, rate: number) {
    if (!context || !running.value) return;
    if (typeof base64 !== "string" || base64.length > 256000 || rate !== 24000)
      throw new Error("Invalid voice audio.");
    const raw = atob(base64);
    if (raw.length % 2) throw new Error("Invalid voice audio.");
    if (cursor - context.currentTime > 25)
      throw new Error(
        "Audio playback is falling behind. Reconnect to continue.",
      );
    const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    const buffer = context.createBuffer(1, bytes.length / 2, rate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++)
      samples[i] = view.getInt16(i * 2, true) / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    sources.add(source);
    cursor = Math.max(context.currentTime + 0.03, cursor);
    source.start(cursor);
    cursor += buffer.duration;
    status.value = "SPEAKING";
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      if (!sources.size && status.value === "SPEAKING")
        status.value = "LISTENING";
    };
  }
  async function start() {
    if (running.value) return;
    stop();
    const request = ++epoch;
    error.value = "";
    caption.value = "";
    savedCaption.value = false;
    nextAction.value = "";
    errorCode.value = "";
    status.value = "CONNECTING";
    elapsedSeconds.value = 0;
    hasConnected.value = false;
    connectedAt = 0;
    try {
      await auth.ensureSession();
      if (request !== epoch) return;
      await checkAvailability();
      if (request !== epoch) return;
      if (!availability.value?.enabled)
        throw new Error(
          availability.value?.message ||
            error.value ||
            "Live calls are unavailable.",
        );
      if (availability.value.provider === "elevenlabs") {
        const { Conversation } = await import("@elevenlabs/client");
        if (request !== epoch) return;
        // Check permission before reserving a call. Own and release this preliminary capture.
        const permissionStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (request !== epoch) {
          permissionStream.getTracks().forEach((track) => track.stop());
          return;
        }
        mic = permissionStream;
        const connection = await auth.authorizedFetch<{
          conversationToken: string;
          studyToken: string;
          maxSeconds: number;
        }>("/api/study/conversations/" + id.value + "/live/start", {
          method: "POST",
        });
        if (request !== epoch) {
          void auth.authorizedFetch(
            "/api/study/conversations/" + id.value + "/live/end",
            { method: "POST", body: { studyToken: connection.studyToken } },
          );
          return;
        }
        studyToken = connection.studyToken;
        permissionStream.getTracks().forEach((track) => track.stop());
        mic = undefined;
        timeout = setTimeout(() => {
          if (request === epoch)
            fail("The voice call timed out. Please try again.");
        }, 20_000);
        const session = await Conversation.startSession({
          conversationToken: connection.conversationToken,
          connectionType: "webrtc",
          customLlmExtraBody: { studyToken },
          onConnect: () => {
            if (request === epoch) {
              markConnected();
              status.value = "LISTENING";
            }
          },
          onModeChange: ({ mode }) => {
            if (request === epoch)
              status.value = mode === "speaking" ? "SPEAKING" : "LISTENING";
          },
          onMessage: ({ message }) => {
            if (request === epoch && message !== STUDY_LIVE_START_MESSAGE) {
              caption.value = message;
              savedCaption.value = false;
            }
          },
          onError: () => {
            if (request === epoch)
              fail(
                "The voice call failed. Check saved turns before reconnecting.",
              );
          },
          onDisconnect: () => {
            if (request === epoch) stop();
          },
        });
        if (request !== epoch) {
          session.setMicMuted(true);
          await session.endSession();
          return;
        }
        agent = session;
        if (timeout) clearTimeout(timeout);
        // The learner initiated this action. The private callback generates and saves
        // a new, source-backed opening; no prerecorded welcome is played here.
        session.sendUserMessage(STUDY_LIVE_START_MESSAGE);
        timeout = setTimeout(() => {
          if (request === epoch) stop();
        }, connection.maxSeconds * 1000);
        let ticks = 0;
        meter = setInterval(() => {
          if (request !== epoch || !agent) return;
          level.value = muted.value ? 0 : Math.min(1, agent.getInputVolume());
          if (++ticks % 30 === 0 && !syncing) {
            syncing = true;
            void auth
              .authorizedFetch<{ turns: { text: string }[] }>(
                "/api/study/conversations/" + id.value,
              )
              .then(async (record) => {
                if (
                  request === epoch &&
                  record.turns.some((turn) => turn.text === caption.value)
                )
                  savedCaption.value = true;
                await onSaved();
              })
              .catch(() => {
                error.value =
                  "Saved turns could not refresh. Reopen this document after the call.";
              })
              .finally(() => {
                syncing = false;
              });
          }
        }, 100);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (request !== epoch) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mic = stream;
      context = new AudioContext();
      await context.resume();
      await context.audioWorklet.addModule("/airs-voice-capture.js");
      if (request !== epoch) return;
      const source = context.createMediaStreamSource(stream);
      capture = new AudioWorkletNode(context, "air-capture");
      const silent = context.createGain();
      silent.gain.value = 0;
      source.connect(capture);
      capture.connect(silent);
      silent.connect(context.destination);
      const url = new URL(availability.value.socketUrl, window.location.origin);
      url.protocol =
        url.protocol === "https:"
          ? "wss:"
          : url.protocol === "http:"
            ? "ws:"
            : url.protocol;
      if (
        !["ws:", "wss:"].includes(url.protocol) ||
        (location.protocol === "https:" && url.protocol !== "wss:")
      )
        throw new Error("A secure live voice connection is required.");
      let captureReady = false;
      const connection = new WebSocket(url);
      socket = connection;
      connection.binaryType = "arraybuffer";
      timeout = setTimeout(() => {
        if (request === epoch)
          fail("The live voice connection timed out. Try connecting again.");
      }, 20_000);
      capture.port.onmessage = (event) => {
        if (
          request !== epoch ||
          connection.readyState !== WebSocket.OPEN ||
          !captureReady
        )
          return;
        if (connection.bufferedAmount > 64000) {
          fail("Your connection is too slow for live voice. Try again.");
          return;
        }
        level.value = muted.value
          ? 0
          : Math.min(1, Number(event.data.level || 0) * 8);
        connection.send(event.data.audio);
      };
      connection.onopen = () => {
        if (request === epoch)
          connection.send(
            JSON.stringify({
              type: "start",
              token: auth.accessToken.value,
              conversationId: id.value,
            }),
          );
      };
      connection.onmessage = (event) => {
        if (request !== epoch) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === "capture-ready") captureReady = true;
          else if (message.type === "ready") {
            markConnected();
            captureReady = true;
            if (timeout) clearTimeout(timeout);
            status.value = "LISTENING";
          } else if (message.type === "audio")
            playAudio(message.audio, message.sampleRate);
          else if (message.type === "interrupted") {
            clearPlayback();
            caption.value = "";
            savedCaption.value = false;
            status.value = "LISTENING";
          } else if (message.type === "caption") {
            caption.value = message.text;
            savedCaption.value = false;
          } else if (message.type === "saved") {
            caption.value = message.text;
            savedCaption.value = true;
            void onSaved().catch(() => {
              error.value =
                "The turn was saved, but the transcript could not refresh. Reopen this document to view it.";
            });
          } else if (message.type === "error") {
            errorCode.value = message.code || "";
            nextAction.value =
              typeof message.nextAction === "string" &&
              /^(?:\/air(?:\/|$)|\/auth\/sign-in(?:\?|$))/.test(
                message.nextAction,
              )
                ? message.nextAction
                : "";
            fail(message.message);
          } else if (message.type === "ended") stop();
        } catch {
          fail(
            "The live voice connection returned an invalid response. Try again.",
          );
        }
      };
      connection.onerror = () => {
        if (request === epoch)
          fail(
            "Live voice could not connect. Check your connection and try again.",
          );
      };
      connection.onclose = () => {
        if (request === epoch && running.value)
          fail("The call disconnected. Check saved turns before reconnecting.");
      };
    } catch (cause) {
      if (request === epoch)
        fail(
          learnerStudyError(
            cause,
            ["NotAllowedError", "SecurityError", "NotFoundError", "OverconstrainedError", "NotReadableError"].includes((cause as Error)?.name)
              ? microphoneError(cause)
              : error.value || (!availability.value?.enabled && availability.value?.message) || "We couldn’t start the call. Check your connection and try again.",
          ),
        );
    }
  }
  function toggleMute() {
    muted.value = !muted.value;
    agent?.setMicMuted(muted.value);
    mic?.getAudioTracks().forEach((track) => {
      track.enabled = !muted.value;
    });
  }
  onBeforeUnmount(stop);
  return {
    hasConnected,
    elapsedSeconds,
    status,
    availability,
    availabilityLoading,
    error,
    nextAction,
    errorCode,
    level,
    muted,
    caption,
    captionsVisible,
    savedCaption,
    running,
    checkAvailability,
    start,
    stop,
    toggleMute,
  };
}
