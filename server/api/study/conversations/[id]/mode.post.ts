import { z } from "zod";
import { requireIdentity } from "../../../../utils/auth";
import {
  getStudyConversation,
  updateStudyMode,
} from "../../../../services/studyRepository";

const schema = z.object({
  mode: z.enum(["DISCUSSION", "ORAL_EXAM", "SCENARIO"]),
});

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  const { mode } = schema.parse(await readBody(event));
  const conversation = await getStudyConversation(identity.userId, id, event);
  if (conversation.objectiveFlow?.pendingOperationId || conversation.objectiveFlow?.interruptOperationId) throw createError({statusCode:409,statusMessage:'Your input is saved and still needs a response. Retry it or end this session before changing practice mode.'});
  if (conversation.plan.status !== "APPROVED")
    throw createError({
      statusCode: 409,
      statusMessage: "Approve Misu's study plan before changing practice mode.",
    });
  await updateStudyMode(
    identity.userId,
    id,
    mode,
    {
      questionNumber: 0,
      totalQuestions: 5,
      awaitingAnswer: false,
      attempts: conversation.practice.attempts,
    },
    event,
  );
  return getStudyConversation(identity.userId, id, event);
});
