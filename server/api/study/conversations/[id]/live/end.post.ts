import { requireIdentity } from "../../../../../utils/auth";
import { verifyStudyVoiceToken } from "../../../../../services/studyVoice";
import { releaseStudyLiveLease } from "../../../../../services/studyRepository";
export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const body = await readBody(event);
  const token = verifyStudyVoiceToken(String(body?.studyToken || ""));
  if (
    token.ownerId !== identity.userId ||
    token.conversationId !== getRouterParam(event, "id")
  )
    throw createError({
      statusCode: 403,
      statusMessage: "This call belongs to another study session.",
    });
  await releaseStudyLiveLease(token.conversationId, token.leaseId);
  return { ended: true };
});
