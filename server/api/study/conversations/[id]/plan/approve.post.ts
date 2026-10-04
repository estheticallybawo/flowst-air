import { z } from "zod";
import { requireIdentity } from "../../../../../utils/auth";
import {
  getStudyConversation,
  saveStudyPlan,
} from "../../../../../services/studyRepository";
import { DEFAULT_STUDY_FUNCTION_REFS } from "../../../../../domain/neuromap/studyFunctions";
import { standaloneStudyObjectiveCapacity } from "../../../../../services/studyMiro";

const schema = z.object({ version: z.number().int().positive() });

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  const { version } = schema.parse(await readBody(event));
  const conversation = await getStudyConversation(identity.userId, id, event);
  if (
    conversation.plan.status !== "DRAFT" ||
    conversation.plan.version !== version ||
    !conversation.plan.objectives.length
  )
    throw createError({
      statusCode: 409,
      statusMessage: "Review the latest Misu plan before approving it.",
    });
  const capacity = standaloneStudyObjectiveCapacity(conversation, event);
  if (capacity !== undefined && conversation.plan.objectives.length > capacity)
    throw createError({ statusCode: 409,
      statusMessage: "This plan has too many objectives for the remaining voice allowance. Regenerate a smaller plan before starting." });
  if (
    conversation.plan.functionRefs?.length !==
      DEFAULT_STUDY_FUNCTION_REFS.length ||
    conversation.plan.functionRefs.some((ref, index) => {
      const expected = DEFAULT_STUDY_FUNCTION_REFS[index]!;
      return (
        ref.id !== expected.id ||
        ref.version !== expected.version ||
        ref.kind !== expected.kind
      );
    })
  )
    throw createError({
      statusCode: 409,
      statusMessage:
        "Regenerate this plan to review the current NeuroMap functions before approval.",
    });
  return saveStudyPlan(
    identity.userId,
    id,
    {
      ...conversation.plan,
      status: "APPROVED",
      activeObjectiveId: conversation.plan.objectives[0]!.id,
      approvedBy: identity.userId,
      approvedAt: new Date().toISOString(),
    },
    conversation.revision,
    event,
  );
});
