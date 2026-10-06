import { z } from "zod";
import { requireIdentity } from "../../../../../utils/auth";
import {
  getStudyConversation,
  getStudyPedagogyHistory,
  saveStudyPlan,
  assertStudyConversationActive,
  studyLiveLease,
} from "../../../../../services/studyRepository";
import {
  hasStudyObjectiveEvidence,
  studyObjectivesHaveEvidence,
} from "../../../../../../shared/studyCompletion";

const schema = z.object({ objectiveId: z.string().min(1) });

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  const { objectiveId } = schema.parse(await readBody(event));
  const conversation = await getStudyConversation(identity.userId, id, event);
  assertStudyConversationActive(conversation);
  if (conversation.objectiveFlow) return conversation;
  if (await studyLiveLease(id, event)) throw createError({ statusCode: 409, statusMessage: "End the live call before continuing to another objective." });
  const recommendation = conversation.plan.recommendation;
  if (
    conversation.plan.status !== "APPROVED" ||
    conversation.mode !== "DISCUSSION" ||
    conversation.plan.courseCompletedAt ||
    !recommendation ||
    recommendation.objectiveId !== objectiveId ||
    recommendation.basedOnAttemptCount !== conversation.practice.attempts.length
  )
    throw createError({
      statusCode: 409,
      statusMessage: "Review Misu’s latest recommendation before continuing.",
    });
  if (recommendation.action === "ADVANCE") {
    // Evidence and the learner's checkpoint choice govern progression. The timer
    // offers a break; it must not force more repetitions of a covered objective.
    const current = conversation.plan.objectives.findIndex(
      (item) => item.id === conversation.plan.activeObjectiveId,
    );
    if (conversation.plan.objectives[current + 1]?.id !== objectiveId)
      throw createError({
        statusCode: 409,
        statusMessage: "Misu has not recommended that next objective.",
      });
    if (
      !hasStudyObjectiveEvidence(
        conversation,
        conversation.plan.activeObjectiveId!,
        await getStudyPedagogyHistory(identity.userId, id, event),
      )
    )
      throw createError({
        statusCode: 409,
        statusMessage:
          "Save a source-backed explanation on this objective before continuing.",
      });
    await saveStudyPlan(
      identity.userId,
      id,
      {
        ...conversation.plan,
        activeObjectiveId: objectiveId,
        recommendation: undefined,
        recommendationError: undefined,
      },
      conversation.revision,
      event,
    );
  } else if (recommendation.action === "COMPLETE") {
    const last = conversation.plan.objectives.at(-1);
    if (
      !last ||
      last.id !== objectiveId ||
      conversation.plan.activeObjectiveId !== objectiveId
    )
      throw createError({
        statusCode: 409,
        statusMessage:
          "Finish the final objective before confirming the course.",
      });
    if (
      !studyObjectivesHaveEvidence(
        conversation,
        await getStudyPedagogyHistory(identity.userId, id, event),
      )
    )
      throw createError({
        statusCode: 409,
        statusMessage:
          "Save a source-backed explanation for every objective before finishing this document.",
      });
    await saveStudyPlan(
      identity.userId,
      id,
      {
        ...conversation.plan,
        courseCompletedAt: new Date().toISOString(),
        courseCompletedBy: identity.userId,
        recommendation: undefined,
        recommendationError: undefined,
      },
      conversation.revision,
      event,
    );
  } else
    throw createError({
      statusCode: 409,
      statusMessage: "Misu recommends another try on this objective.",
    });
  return getStudyConversation(identity.userId, id, event);
});
