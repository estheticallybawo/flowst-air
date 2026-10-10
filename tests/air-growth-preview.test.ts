import { afterEach, expect, test, vi } from "vitest";
import { growthPreviewEnabled } from "../shared/airGrowthPreview";
import { isAirGrowthPreview } from "../server/utils/airGrowthPreview";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import previewBoundary from "../server/middleware/00.air-growth-preview";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("hosted sample mode requires opt-in and cannot enable in Production", () => {
  expect(growthPreviewEnabled("true", "preview", "production")).toBe(true);
  expect(growthPreviewEnabled(true, undefined, "development")).toBe(true);
  for (const target of ["production", "staging", "unexpected"])
    expect(growthPreviewEnabled(true, target, "production")).toBe(false);
  expect(growthPreviewEnabled(true, undefined, "production")).toBe(false);
  for (const value of [false, "false", undefined, "1"])
    expect(growthPreviewEnabled(value, "preview", "production")).toBe(false);
});

function request(path: string, method = "GET") {
  const req = new IncomingMessage(new Socket());
  req.url = path;
  req.method = method;
  req.headers.host = "preview.example";
  return createEvent(req, new ServerResponse(req));
}
function configure(enabled: boolean, environment = "preview") {
  vi.stubGlobal("useRuntimeConfig", () => ({ airGrowthPreview: enabled }));
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", environment);
}

test("sample host denies reads, writes, auth and provider callbacks before handlers", async () => {
  configure(true);
  for (const [path, method] of [
    ["/api/auth/session", "GET"],
    ["/api/study/context", "GET"],
    ["/api/study/conversations", "POST"],
    ["/api/study/conversations/example", "DELETE"],
    ["/api/study/llm/v1/chat/completions", "POST"],
    ["/api/auth/sign-out", "POST"],
  ]) {
    await expect(Promise.resolve().then(() => previewBoundary(request(path!, method!))))
      .rejects.toMatchObject({ statusCode: 503, data: { code: "GROWTH_SAMPLE_PREVIEW" } });
  }
  const home = request("/airs");
  expect(previewBoundary(home)).toBeUndefined();
  expect(home.node.res.getHeader("Cache-Control")).toBe("private, no-store");
});

test("ordinary and Production hosts keep their existing auth and API handling", () => {
  configure(false);
  expect(isAirGrowthPreview(request("/airs"))).toBe(false);
  expect(previewBoundary(request("/api/study/context", "PUT"))).toBeUndefined();
  configure(true, "production");
  expect(isAirGrowthPreview(request("/airs"))).toBe(false);
  expect(previewBoundary(request("/api/auth/session"))).toBeUndefined();
});
