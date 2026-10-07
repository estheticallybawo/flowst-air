import { requireIdentity } from "../../../../utils/auth";
import { readSavedKaiReview } from '../../../../services/airsKai';
export default defineEventHandler(async (event) => {
  const owner = (await requireIdentity(event)).userId,
    id = getRouterParam(event, "id") || "";
  return { review: await readSavedKaiReview(owner, id, event) };
});
