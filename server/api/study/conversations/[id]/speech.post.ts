import { z } from "zod";
import { requireIdentity } from "../../../../utils/auth";
import { getOrPrepareStudySpeech } from "../../../../services/studySpeechCache";

const schema = z
  .object({
    turnId: z.string().uuid(),
    withTimestamps: z.boolean().optional(),
    retry: z.boolean().optional(),
  })
  .strict();

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  const { turnId, withTimestamps, retry } = schema.parse(await readBody(event));
  const packet = await getOrPrepareStudySpeech(
    identity.userId,
    id,
    turnId,
    retry,
    event,
  );
  setHeader(event, "Cache-Control", "private, no-store");
  if (withTimestamps) return packet;
  const audio = Buffer.from(packet.audioBase64, "base64");
  setHeader(event, "Content-Type", "audio/mpeg");
  setHeader(event, "Cache-Control", "private, no-store");
  return audio;
});
