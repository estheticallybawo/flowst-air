import { z } from "zod";
import { requireIdentity } from "../../../utils/auth";
import { sourceJsonBody } from "../../../utils/sourceBody";
import { summarizeAirsContext } from "../../../services/airsContextSummary";
export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const { revision } = z
    .object({ revision: z.string().max(100) })
    .strict()
    .parse(await sourceJsonBody(event, 1000));
  return summarizeAirsContext(identity.userId, revision, event);
});
