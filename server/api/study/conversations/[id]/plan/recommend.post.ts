import { requireIdentity } from "../../../../../utils/auth";
import { refreshMisuRecommendation } from "../../../../../services/studyMisu";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  return refreshMisuRecommendation(
    identity.userId,
    getRouterParam(event, "id") || "",
    event,
  );
});
