import { requireIdentity } from "../../../../../utils/auth";
import { refreshMiroRecommendation } from "../../../../../services/studyMiro";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  return refreshMiroRecommendation(
    identity.userId,
    getRouterParam(event, "id") || "",
    event,
  );
});
