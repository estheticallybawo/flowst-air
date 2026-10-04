import { requireIdentity } from "../../../utils/auth";
import { listStudyConversations } from "../../../services/studyRepository";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  return listStudyConversations(identity.userId, event);
});
