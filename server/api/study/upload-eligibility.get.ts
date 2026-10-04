import { requireIdentity } from "../../utils/auth";
import { getStudyUploadEligibility } from "../../services/studyRepository";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  return getStudyUploadEligibility(identity.userId, event);
});
