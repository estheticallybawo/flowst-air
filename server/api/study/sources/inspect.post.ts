import { requireIdentity } from "../../../utils/auth";
import { sourceJsonBody } from "../../../utils/sourceBody";
import { inspectStudySource } from "../../../services/studySources";
export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  return inspectStudySource(
    identity.userId,
    await sourceJsonBody(event),
    event,
  );
});
