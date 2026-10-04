import { z } from "zod";
import { requireIdentity } from "../../../../utils/auth";
import { abandonStudyDocument } from "../../../../services/studyRepository";

const schema = z.object({ confirmAbandon: z.literal(true) }).strict();

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const parsed = schema.safeParse(await readBody(event));
  if (!parsed.success)
    throw createError({
      statusCode: 400,
      statusMessage:
        "Confirm abandonment before replacing this study document.",
    });
  setHeader(event, "Cache-Control", "private, no-store");
  return abandonStudyDocument(
    identity.userId,
    getRouterParam(event, "id") || "",
    event,
  );
});
