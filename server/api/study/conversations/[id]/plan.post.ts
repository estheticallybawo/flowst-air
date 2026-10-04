import { z } from "zod";
import { requireIdentity } from "../../../../utils/auth";
import { generateMisuPlan } from "../../../../services/studyMisu";

const schema = z.object({ regenerate: z.boolean().optional().default(false) });

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const { regenerate } = schema.parse(await readBody(event).catch(() => ({})));
  return generateMisuPlan(
    identity.userId,
    getRouterParam(event, "id") || "",
    regenerate,
    event,
  );
});
