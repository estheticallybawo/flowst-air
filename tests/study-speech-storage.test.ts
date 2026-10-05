import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({ get: vi.fn(), db: vi.fn(), s3: vi.fn(), voice: vi.fn() }));
vi.mock("../server/services/studyRepository", () => ({
  getStudyConversation: mocks.get,
  studyStorageResources: () => ({ mock: false, table: "records", bucket: "sources", db: { send: mocks.db }, s3: { send: mocks.s3 } }),
}));
vi.mock("../server/services/studyElevenSpeech", () => ({ elevenSynthesizeTimedStudySpeech: mocks.voice }));
vi.mock("../server/services/studyAwsSpeech", () => ({ synthesizeStudySpeech: mocks.voice }));
import { getOrPrepareStudySpeech } from "../server/services/studySpeechCache";
const text = "Explain the source.", owner = "owner", id = "study", turnId = "turn";
const record = (status: "READY" | "PENDING" | "FAILED" = "READY") => ({ ownerId: owner, revision: "saved", objectKey: "study-speech/owner/study/turn.json", status, textHash: createHash("sha256").update(text).digest("hex") });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({ ownerId: owner, turns: [{ id: turnId, role: "AMIRA", text }] });
  mocks.db.mockResolvedValue({ Item: record() });
});
it.each(["AccessDenied", "AccessDeniedException"])("reports %s during saved audio lookup without synthesizing or altering its record", async name => {
  mocks.s3.mockRejectedValue(Object.assign(new Error("Private provider details"), { name }));
  const error = await getOrPrepareStudySpeech(owner, id, turnId, true).catch(cause => cause);
  expect(error).toMatchObject({ statusCode: 503, data: { code: "SPEECH_CACHE_ACCESS", retryable: false } });
  expect(error.statusMessage).not.toContain("Private provider details");
  expect(mocks.voice).not.toHaveBeenCalled(); expect(mocks.db).toHaveBeenCalledTimes(1);
});
it.each(["ExpiredToken", "ExpiredTokenException", "CredentialsProviderError", "InvalidIdentityToken"])("separates storage identity failure %s from speech availability", async name => {
  mocks.s3.mockRejectedValue(Object.assign(new Error("private"), { name }));
  await expect(getOrPrepareStudySpeech(owner, id, turnId)).rejects.toMatchObject({ statusCode: 503, data: { code: "SPEECH_CACHE_AUTH", retryable: false } });
  expect(mocks.voice).not.toHaveBeenCalled();
});
it.each([ ["READY", "SPEECH_CACHE_UNAVAILABLE"], ["PENDING", "SPEECH_PENDING"] ] as const)("preserves %s recovery gates when AWS confirms a missing object", async (status, code) => {
  mocks.db.mockResolvedValue({ Item: record(status) });
  mocks.s3.mockRejectedValue(Object.assign(new Error("missing"), { name: "NoSuchKey" }));
  await expect(getOrPrepareStudySpeech(owner, id, turnId, true)).rejects.toMatchObject({ data: { code } });
  expect(mocks.voice).not.toHaveBeenCalled();
});
it("recovers an object saved before the ready marker without another paid request", async () => {
  mocks.db.mockResolvedValue({ Item: record("PENDING") });
  const packet = { audioBase64: "YXVkaW8=", mimeType: "audio/mpeg", spokenText: text, alignment: null };
  mocks.s3.mockResolvedValue({ ContentLength: 100, Body: (async function* () { yield Buffer.from(JSON.stringify(packet)); })() });
  expect(await getOrPrepareStudySpeech(owner, id, turnId)).toEqual(packet);
  expect(mocks.voice).not.toHaveBeenCalled();
});
it("rejects another owner's cache metadata before any object lookup", async () => {
  mocks.db.mockResolvedValue({ Item: { ...record(), ownerId: "other" } });
  await expect(getOrPrepareStudySpeech(owner, id, turnId)).rejects.toMatchObject({ statusCode: 409 });
  expect(mocks.s3).not.toHaveBeenCalled(); expect(mocks.voice).not.toHaveBeenCalled();
});
