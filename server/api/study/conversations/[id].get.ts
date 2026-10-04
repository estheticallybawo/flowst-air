import { readAirsArtifact } from '../../../services/airsContext'
import type { AirsOperation } from '../../../../shared/airsOrchestration'
import { requireIdentity } from "../../../utils/auth";
import { getStudyConversation } from "../../../services/studyRepository";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const conversation=await getStudyConversation(
    identity.userId,
    getRouterParam(event, "id") || "",
    event,
  );
  const artifact=await readAirsArtifact<{operation:AirsOperation}>(identity.userId,'PLAN_OPERATION#'+conversation.id,event)
  return {...conversation,plan:{...conversation.plan,operation:artifact?.operation}}
});
