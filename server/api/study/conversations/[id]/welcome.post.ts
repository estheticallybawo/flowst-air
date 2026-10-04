import { createHash } from 'node:crypto'
import { contextDescription } from "../../../../../shared/airsOrchestration";
import { requireIdentity } from "../../../../utils/auth";
import {
  appendStudyTurn,
  getStudyConversation,
} from "../../../../services/studyRepository";
import type { StudyTurn } from "../../../../../shared/study";
import { compileMisuStudyPacket } from "../../../../services/studyMisu";

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
  compileMisuStudyPacket(conversation);
  const existing = conversation.turns.find((turn) => turn.kind === "WELCOME");
  if (existing) return { turn: existing };
  const objective = conversation.plan.objectives.find(
    (item) => item.id === conversation.plan.activeObjectiveId,
  )!;
  const context = conversation.plan.contextSnapshot;
  const brief = context ? (context.summaryStatus==='CONFIRMED' ? context.summary || contextDescription(context) : contextDescription(context)).replace(/\s+/g,' ').slice(0,180) : '';
  const hash=createHash('sha256').update(id+':welcome:'+conversation.plan.version).digest('hex');
  const welcomeId=hash.slice(0,8)+'-'+hash.slice(8,12)+'-5'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
  const turn: StudyTurn = {
    id: welcomeId,
    role: "AMIRA",
    mode: "DISCUSSION",
    kind: "WELCOME",
    objectiveId: objective.id,
    sources: [],
    createdAt: conversation.plan.approvedAt || new Date().toISOString(),
    text: 'Hi, I’m Amina. '+(brief ? 'Misu shared your context: “'+brief+'”. ' : '')+'We’ll start with '+objective.title+'. I’ll help you practise the ideas using your approved plan. Let me know when you’re ready.',
  };
  await appendStudyTurn(identity.userId, id, turn, event);
  return { turn };
});
