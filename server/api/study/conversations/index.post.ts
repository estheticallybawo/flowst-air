import { requireIdentity } from "../../../utils/auth";
import { extractStudyDocument } from "../../../services/studyExtraction";
import {
  assertStudyUploadAvailable,
  createStudyConversation,
} from "../../../services/studyRepository";
import { readStudyPreferencesField } from "../../../services/studyPreferences";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const standaloneAirs = ['airs', 'air', 'amira'].includes(useRuntimeConfig(event).public.appSurface);
  if (standaloneAirs) await assertStudyUploadAvailable(identity.userId, event);
  const maxBytes = standaloneAirs ? 4_000_000 : 20 * 1024 * 1024;
  const limitMessage = `Choose a document smaller than ${standaloneAirs ? "4 MB" : "20 MB"}.`;
  const length = Number(getHeader(event, "content-length") || 0);
  if (length > maxBytes + 100_000)
    throw createError({ statusCode: 413, statusMessage: limitMessage });
  const parts = await readMultipartFormData(event);
  const file = parts?.find((part) => part.name === "file" && part.filename);
  if (!file?.filename)
    throw createError({
      statusCode: 400,
      statusMessage: "Choose a PDF, DOCX, or PPTX file.",
    });
  if (file.data.length > maxBytes)
    throw createError({ statusCode: 413, statusMessage: limitMessage });
  const preferenceParts =
    parts?.filter((part) => part.name === "preferences") || [];
  if (preferenceParts.length > 1)
    throw createError({
      statusCode: 400,
      statusMessage: "Submit one set of session choices.",
    });
  const preferences = readStudyPreferencesField(preferenceParts[0]?.data);
  const extracted = await extractStudyDocument(file.filename, file.data);
  setResponseStatus(event, 201);
  return createStudyConversation(
    identity.userId,
    file.filename,
    file.type || "application/octet-stream",
    file.data,
    extracted,
    event,
    preferences,
  );
});
