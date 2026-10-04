import { deleteAirsConversationMemory } from '../../../services/airsContext'
import { requireIdentity } from "../../../utils/auth";
import { deleteStudyConversation } from "../../../services/studyRepository";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  await deleteStudyConversation(
    identity.userId,
    getRouterParam(event, "id") || "",
    event,
  );
  await deleteAirsConversationMemory(identity.userId,getRouterParam(event,'id') || '',event);
  return { deleted: true };
});
