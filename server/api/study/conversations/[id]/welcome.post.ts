import { randomUUID } from "node:crypto";
import { requireIdentity } from "../../../../utils/auth";
import {
  appendStudyTurn,
  getStudyConversation,
} from "../../../../services/studyRepository";
import type { StudyTurn } from "../../../../../shared/study";
import { compileMiroStudyPacket } from "../../../../services/studyMiro";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  const conversation = await getStudyConversation(identity.userId, id, event);
  if (
    conversation.plan.status !== "APPROVED" ||
    !conversation.plan.activeObjectiveId
  )
    throw createError({
      statusCode: 409,
      statusMessage: "Approve Misu’s plan before meeting Amina.",
    });
  compileMiroStudyPacket(conversation);
  const existing = conversation.turns.find((turn) => turn.kind === "WELCOME");
  if (existing) return { turn: existing };
  const objective = conversation.plan.objectives.find(
    (item) => item.id === conversation.plan.activeObjectiveId,
  )!;
  const turn: StudyTurn = {
    id: randomUUID(),
    role: "AMIRA",
    mode: "DISCUSSION",
    kind: "WELCOME",
    objectiveId: objective.id,
    sources: [],
    createdAt: new Date().toISOString(),
    text: `Hi, I’m Amina. Welcome to your study session on ${conversation.document.title || conversation.document.name}. Misu has set our first objective: ${objective.title}. We’ll start with a short introduction, talk through the ideas, try a realistic scenario, and practice explaining them clearly to someone else. I’ll listen to your reasoning and help you sharpen it as we go. Let me know when you’re ready.`,
  };
  await appendStudyTurn(identity.userId, id, turn, event);
  return { turn };
});
