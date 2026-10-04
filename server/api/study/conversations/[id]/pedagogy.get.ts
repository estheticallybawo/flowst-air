import { requireIdentity } from "../../../../utils/auth";
import { getStudyPedagogyHistory } from "../../../../services/studyRepository";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  setHeader(event, "Cache-Control", "private, no-store");
  return getStudyPedagogyHistory(identity.userId, id, event);
});
