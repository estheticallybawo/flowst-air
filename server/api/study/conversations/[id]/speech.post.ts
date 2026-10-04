import { z } from "zod";
import { requireIdentity } from "../../../../utils/auth";
import { synthesizeStudySpeech } from "../../../../services/studyAwsSpeech";
import { getStudyConversation } from "../../../../services/studyRepository";

const schema = z.object({ turnId: z.string().uuid(), withTimestamps:z.boolean().optional() }).strict();

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  const { turnId,withTimestamps } = schema.parse(await readBody(event));
  const conversation = await getStudyConversation(identity.userId, id, event);
  const turn = conversation.turns.find(
    (item) => item.id === turnId && item.role === "AMIRA",
  );
  if (!turn)
    throw createError({
      statusCode: 404,
      statusMessage: "Amina’s response was not found.",
    });
  if(withTimestamps){
    setHeader(event,'Cache-Control','private, no-store')
    if(useRuntimeConfig(event).studyVoiceProvider!=='aws')return (await import('../../../../services/studyElevenSpeech')).elevenSynthesizeTimedStudySpeech(identity.userId,conversation,turn.text,event)
    const audio=await synthesizeStudySpeech(identity.userId,conversation,turn.text,event)
    return {audioBase64:audio.toString('base64'),mimeType:'audio/mpeg',spokenText:turn.text.slice(0,3000),alignment:null}
  }
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
