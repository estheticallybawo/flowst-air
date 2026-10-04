import { requireIdentity } from "../../../utils/auth";
import { getStudyConversation } from "../../../services/studyRepository";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  return getStudyConversation(
    identity.userId,
    getRouterParam(event, "id") || "",
    event,
  );
});
