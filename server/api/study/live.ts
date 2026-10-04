import { AirsLiveError, airsLiveFailure } from "../../utils/airsLiveError";
import { defineWebSocketHandler } from "h3";
import { authenticateAccessToken } from "../../utils/auth";
import { AminaSonicCall } from "../../services/aminaRealtime";
interface CallState {
  call?: AminaSonicCall;
  starting: boolean;
  queued: number;
  serial: Promise<void>;
  timer: ReturnType<typeof setTimeout>;
}
const calls = new Map<string, CallState>();
export default defineWebSocketHandler({
  upgrade(request) {
    if (
      useRuntimeConfig().studyVoiceProvider !== "aws" ||
      !useRuntimeConfig().aminaRealtimeEnabled
    )
      return new Response("Live calls are unavailable.", { status: 503 });
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host)
      return new Response("Origin denied.", { status: 403 });
  },
  open(peer) {
    calls.set(peer.id, {
      starting: false,
      queued: 0,
      serial: Promise.resolve(),
      timer: setTimeout(
        () => peer.close(4401, "Authentication required"),
        10_000,
      ),
    });
  },
  async message(peer, message) {
    const state = calls.get(peer.id);
    if (!state) return;
    const fail = async (cause: unknown) => {
      peer.send(
        JSON.stringify(
          airsLiveFailure(
            cause,
            "The live connection could not start. Try again or use recording.",
          ),
        ),
      );
      await state.call?.stop();
      peer.close(1011, "Call ended");
    };
    if (!state.call) {
      if (state.starting) return;
      state.starting = true;
      try {
        if (message.text().length > 12000)
          throw new Error("Invalid call request.");
        const start = message.json<{
          type: string;
          token: string;
          conversationId: string;
        }>();
        if (
          start.type !== "start" ||
          typeof start.conversationId !== "string" ||
          !/^[a-zA-Z0-9_-]{1,100}$/.test(start.conversationId) ||
          typeof start.token !== "string"
        )
          throw new Error("Invalid call request.");
        const identity = await authenticateAccessToken(start.token);
        if (!identity)
          throw new AirsLiveError(
            "Sign in to start a call.",
            "AMIRA_SESSION_EXPIRED",
            "/auth/sign-in",
          );
        clearTimeout(state.timer);
        if (calls.get(peer.id) !== state) return;
        state.call = new AminaSonicCall(
          identity.userId,
          start.conversationId,
          start.token,
          (data) => peer.send(JSON.stringify(data)),
        );
        await state.call.start();
      } catch (cause) {
        await fail(cause);
      }
      return;
    }
    if (message.text() === '{"type":"end"}') {
      await state.call.stop();
      peer.close(1000, "Call ended");
      return;
    }
    const bytes = message.uint8Array();
    state.queued += bytes.length;
    if (state.queued > 64000) {
      await fail(
        new Error("The voice connection is too slow. Reconnect to continue."),
      );
      return;
    }
    state.serial = state.serial
      .then(async () => {
        try {
          await state.call?.audio(bytes);
        } finally {
          state.queued -= bytes.length;
        }
      })
      .catch(fail);
  },
  async close(peer) {
    const state = calls.get(peer.id);
    calls.delete(peer.id);
    if (state) {
      clearTimeout(state.timer);
      await state.call?.stop();
    }
  },
  async error(peer) {
    const state = calls.get(peer.id);
    if (state) await state.call?.stop();
  },
});
