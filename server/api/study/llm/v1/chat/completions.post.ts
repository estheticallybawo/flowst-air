import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { verifyStudyVoiceToken } from "../../../../../services/studyVoice";
import { assertAirStudyAccess } from "../../../../../services/airAccess";
import {
  claimRecordedStudyTurn,
  failRecordedStudyTurn,
  getStudyConversation,
  studyLiveLease,
  reserveStudyLiveOutput,
} from "../../../../../services/studyRepository";
import {
  prepareAminaTurn,
  streamAminaText,
  finishAminaTurn,
  failAminaTurn,
} from "../../../../../services/studyAmina";

const schema = z.object({
  messages: z
    .array(
      z.object({ role: z.string(), content: z.string().max(16000).nullable() }),
    )
    .max(80),
  elevenlabs_extra_body: z.object({ studyToken: z.string().max(4000) }),
});
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const actual = getHeader(event, "authorization") || "";
  const expected = `Bearer ${config.elevenLabsStudyLlmSecret}`;
  if (
    config.studyTextProvider !== "groq" ||
    String(config.elevenLabsStudyLlmSecret).length < 32 ||
    Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    throw createError({
      statusCode: 401,
      statusMessage: "Voice model authentication required.",
    });
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success)
    throw createError({
      statusCode: 400,
      statusMessage: "A valid voice model request is required.",
    });
  const body = parsed.data;
  const token = verifyStudyVoiceToken(body.elevenlabs_extra_body.studyToken);
  const lease = await studyLiveLease(token.conversationId, event);
  if (
    !lease ||
    lease.leaseId !== token.leaseId ||
    lease.ownerId !== token.ownerId
  )
    throw createError({
      statusCode: 401,
      statusMessage: "This call has ended.",
    });
  await assertAirStudyAccess(token.ownerId, "PRACTISE", event, token.conversationId);
  const conversation = await getStudyConversation(
    token.ownerId,
    token.conversationId,
    event,
  );
  if (conversation.plan.version !== token.planVersion)
    throw createError({
      statusCode: 409,
      statusMessage: "The study plan changed. Start a new call.",
    });
  const input = body.messages
    .filter((message) => message.role === "user")
    .at(-1)
    ?.content?.trim();
  if (!input || input.length > 4000)
    throw createError({
      statusCode: 400,
      statusMessage: "A finalized learner response is required.",
    });
  // Ignore supplied system prompts/history: approved objectives and sources are resolved on the server.
  const hash = createHash("sha256")
    .update(token.leaseId + JSON.stringify(body.messages))
    .digest("hex");
  const result = await claimRecordedStudyTurn(
    token.ownerId,
    token.conversationId,
    "live-" + hash,
    hash,
    event,
  );
  if (result.status === "PROCESSING")
    throw createError({
      statusCode: 409,
      statusMessage: "This voice reply is already processing.",
    });
  let reply = result.status === "COMPLETE" ? result.agentTurn.text : "";
  if (result.status === "CLAIMED") {
    const prepared = await prepareAminaTurn(
      token.ownerId,
      token.conversationId,
      input,
      event,
      true,
    );
    try {
      for await (const text of streamAminaText(
        prepared.system,
        prepared.conversation.turns,
        input,
        event,
        prepared.sourceContext,
      ))
        reply += text;
      await reserveStudyLiveOutput(
        token.ownerId,
        token.conversationId,
        token.leaseId,
        reply.length,
        event,
      );
      // Save generated replies without assuming the learner heard the entire response.
      // Review the durable attempt, just as recorded practice does. A recommendation
      // can end the repetition loop; the learner still controls the checkpoint.
      await finishAminaTurn(
        token.ownerId,
        token.conversationId,
        prepared,
        reply,
        event,
        result.claim,
        true,
        true,
      );
    } catch (cause) {
      await failAminaTurn(
        token.ownerId,
        token.conversationId,
        prepared,
        cause,
        event,
      );
      await failRecordedStudyTurn(
        token.ownerId,
        token.conversationId,
        result.claim,
        event,
      );
      throw cause;
    }
  } else
    await reserveStudyLiveOutput(
      token.ownerId,
      token.conversationId,
      token.leaseId,
      reply.length,
      event,
    );
  setHeader(event, "Content-Type", "text/event-stream");
  setHeader(event, "Cache-Control", "no-store");
  const chunk = (delta: object, finish_reason: string | null = null) =>
    `data: ${JSON.stringify({ id: "chatcmpl-" + hash, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: config.groqModel, choices: [{ index: 0, delta, finish_reason }] })}\n\n`;
  return (
    chunk({ role: "assistant", content: reply }) +
    chunk({}, "stop") +
    "data: [DONE]\n\n"
  );
});
