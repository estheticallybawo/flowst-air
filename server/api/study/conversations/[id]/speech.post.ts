import { z } from "zod";
import { requireIdentity } from "../../../../utils/auth";
import { synthesizeStudySpeech } from "../../../../services/studyAwsSpeech";
import { getStudyConversation } from "../../../../services/studyRepository";

const schema = z.object({ turnId: z.string().uuid() }).strict();

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  const { turnId } = schema.parse(await readBody(event));
  const conversation = await getStudyConversation(identity.userId, id, event);
  const turn = conversation.turns.find(
    (item) => item.id === turnId && item.role === "AMIRA",
  );
  if (!turn)
    throw createError({
      statusCode: 404,
      statusMessage: "Amina’s response was not found.",
    });
  const audio = await synthesizeStudySpeech(
    identity.userId,
    conversation,
    turn.text,
    event,
  );
  setHeader(event, "Content-Type", "audio/mpeg");
  setHeader(event, "Cache-Control", "private, no-store");
  return audio;
});
