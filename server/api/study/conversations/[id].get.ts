import { readAirsArtifact } from "../../../services/airsContext";
import type { AirsOperation } from "../../../../shared/airsOrchestration";
import { requireIdentity } from "../../../utils/auth";
import {
  getStudyConversation,
  getStudyPedagogyHistory,
} from "../../../services/studyRepository";
import { deriveAirsJourney } from "../../../../shared/airsJourney";
import { ensureObjectiveFlow, usesObjectiveFlow } from '../../../services/studyObjectiveFlow';

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  let conversation = await getStudyConversation(
    identity.userId,
    getRouterParam(event, "id") || "",
    event,
  );
  if (!conversation.abandonedAt && conversation.plan.status === 'APPROVED' && usesObjectiveFlow(conversation,event)) conversation = await ensureObjectiveFlow(conversation,event);
  const artifact = await readAirsArtifact<{ operation: AirsOperation }>(
    identity.userId,
    "PLAN_OPERATION#" + conversation.id,
    event,
  );
  const journey = deriveAirsJourney(
    conversation,
    await getStudyPedagogyHistory(identity.userId, conversation.id, event),
  );
  return {
    ...conversation,
    journey,
    plan: { ...conversation.plan, operation: artifact?.operation },
  };
});
