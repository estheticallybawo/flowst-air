import { sourceJsonBody } from '../../../../utils/sourceBody'
import { z } from "zod";
import { requireIdentity } from "../../../../utils/auth";
import { generateMisuPlan } from "../../../../services/studyMisu";

const schema = z.object({ regenerate: z.boolean().optional().default(false), adjustment:z.string().trim().max(600).optional().default(''), preferences:z.unknown().optional() }).strict();

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const { regenerate,adjustment,preferences } = schema.parse(await sourceJsonBody(event,6000));
  return generateMisuPlan(
    identity.userId,
    getRouterParam(event, "id") || "",
    regenerate,
    event,
    adjustment,
    preferences as import("../../../../../shared/study").StudyPreferences | undefined,
  );
});
