import { requireIdentity } from "../../utils/auth";
import { getAirAccess } from "../../services/airAccess";

export default defineEventHandler(async (event) => {
  if (!['air', 'amira'].includes(useRuntimeConfig(event).public.appSurface))
    throw createError({
      statusCode: 404,
      statusMessage: "Flowst Air access is not available on this surface.",
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
  return getAirAccess(
    identity.userId,
    event,
    conversationId as string | undefined,
  );
});
