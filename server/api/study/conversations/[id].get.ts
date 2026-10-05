import { readAirsArtifact } from "../../../services/airsContext";
import type { AirsOperation } from "../../../../shared/airsOrchestration";
import { requireIdentity } from "../../../utils/auth";
import {
  getStudyConversation,
  getStudyPedagogyHistory,
} from "../../../services/studyRepository";
import { deriveAirsJourney } from "../../../../shared/airsJourney";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const conversation = await getStudyConversation(
    identity.userId,
    getRouterParam(event, "id") || "",
    event,
  );
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
