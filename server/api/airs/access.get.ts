import { requireIdentity } from "../../utils/auth";
import { getAirsAccess } from "../../services/airsAccess";

export default defineEventHandler(async (event) => {
  if (!['airs', 'air', 'amira'].includes(useRuntimeConfig(event).public.appSurface))
    throw createError({
      statusCode: 404,
      statusMessage: "Flowst Airs access is not available on this surface.",
    });
  const identity = await requireIdentity(event);
  const conversationId = getQuery(event).conversationId;
  if (
    conversationId !== undefined &&
    (typeof conversationId !== "string" ||
      !/^[\w-]{1,100}$/.test(conversationId))
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Choose a valid study conversation.",
    });
  setHeader(event, "Cache-Control", "private, no-store");
  return getAirsAccess(
    identity.userId,
    event,
    conversationId as string | undefined,
  );
});
