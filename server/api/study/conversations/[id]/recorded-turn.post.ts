import { createHash } from "node:crypto";
import { z } from "zod";
import { requireIdentity } from "../../../../utils/auth";
import { transcribeStudyPcm } from "../../../../services/studyAwsSpeech";
import {
  failAminaTurn,
  finishAminaTurn,
  prepareAminaTurn,
  streamAminaText,
} from "../../../../services/studyAmina";
import {
  claimRecordedStudyTurn,
  failRecordedStudyTurn,
  getCompletedRecordedStudyTurn,
  getStudyConversation,
  saveRecordedStudyTranscript,
} from "../../../../services/studyRepository";

const MAX_PCM_BYTES = 3_840_000; // 120 seconds of 16 kHz, signed 16-bit mono PCM

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  const conversation = await getStudyConversation(identity.userId, id, event);
  if (
    conversation.plan.status !== "APPROVED" ||
    !conversation.turns.some((turn) => turn.kind === "INTRO")
  )
    throw createError({
      statusCode: 409,
      statusMessage: "Press “I’m ready” before recording a response.",
    });
  const length = Number(getHeader(event, "content-length") || 0);
  if (length > MAX_PCM_BYTES + 100_000)
    throw createError({
      statusCode: 413,
      statusMessage: "Keep recordings under two minutes.",
    });
  const parts = await readMultipartFormData(event);
  const audio = parts?.find((part) => part.name === "audio");
  const recordingId = parts
    ?.find((part) => part.name === "recordingId" && !part.filename)
    ?.data.toString("utf8")
    .trim();
  if (!z.string().uuid().safeParse(recordingId).success)
    throw createError({
      statusCode: 400,
      statusMessage:
        "This recording needs a valid take ID. Record again and retry.",
    });
  if (
    !audio?.data?.length ||
    audio.data.length > MAX_PCM_BYTES ||
    audio.data.length % 2 ||
    audio.type !== "application/octet-stream"
  )
    throw createError({
      statusCode: 400,
      statusMessage:
        "We could not read that recording. Please record again and keep it under two minutes.",
    });
  const audioHash = createHash("sha256").update(audio.data).digest("hex");
  const reservation = await claimRecordedStudyTurn(
    identity.userId,
    id,
    recordingId!,
    audioHash,
    event,
  );
  if (reservation.status === "COMPLETE") {
    setHeader(event, "Cache-Control", "private, no-store");
    return { userTurn: reservation.userTurn, agentTurn: reservation.agentTurn };
  }
  if (reservation.status === "PROCESSING") {
    setHeader(event, "Retry-After", 2);
    throw createError({
      statusCode: 409,
      statusMessage:
        "This recording is still processing. Wait a moment and retry the same take.",
    });
  }
  const claim = reservation.claim;
  let prepared: Awaited<ReturnType<typeof prepareAminaTurn>> | undefined;
  try {
    const text =
      claim.transcript ||
      (await transcribeStudyPcm(
        identity.userId,
        conversation,
        audio.data,
        event,
      ));
    if (!text)
      throw createError({
        statusCode: 422,
        statusMessage:
          "No speech was detected. Try again closer to the microphone.",
      });
    if (text.length > 4000)
      throw createError({
        statusCode: 413,
        statusMessage:
          "That answer was too long. Please record a shorter turn.",
      });
    if (!claim.transcript)
      await saveRecordedStudyTranscript(
        identity.userId,
        id,
        claim,
        text,
        event,
      );
    prepared = await prepareAminaTurn(identity.userId, id, text, event);
    let reply = "";
    for await (const chunk of streamAminaText(
      prepared.system,
      prepared.conversation.turns,
      text,
      event,
      prepared.sourceContext,
    ))
      reply += chunk;
    const agentTurn = await finishAminaTurn(
      identity.userId,
      id,
      prepared,
      reply,
      event,
      claim,
    );
    setHeader(event, "Cache-Control", "private, no-store");
    return { userTurn: prepared.userTurn, agentTurn };
  } catch (error) {
    // The model turn and idempotency marker commit together. Recover that
    // saved response even if a later operation or network response failed.
    const completed = await getCompletedRecordedStudyTurn(
      identity.userId,
      id,
      recordingId!,
      audioHash,
      event,
    ).catch(() => undefined);
    if (completed) {
      setHeader(event, "Cache-Control", "private, no-store");
      return completed;
    }
    if (prepared)
      await failAminaTurn(identity.userId, id, prepared, error, event);
    await failRecordedStudyTurn(identity.userId, id, claim, event).catch(
      (storageError) =>
        console.error("Could not release failed recorded turn", storageError),
    );
    throw error;
  }
});
