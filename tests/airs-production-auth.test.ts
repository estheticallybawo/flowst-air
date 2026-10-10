import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createError, createEvent, defineEventHandler, deleteCookie, getCookie, getHeader, getRequestURL, setCookie, setHeader } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { getGuestSession, guestMode, verifyGuestToken } from "../server/utils/airsGuest";
import { refreshCognito } from "../server/services/cognito";

vi.mock("../server/services/cognito", () => ({ refreshCognito: vi.fn() }));
vi.mock("../server/services/authRepository", () => ({ getMe: vi.fn() }));

function event(cookie = "") {
  const req = new IncomingMessage(new Socket());
  req.url = "/api/auth/session";
  if (cookie) req.headers.cookie = cookie;
  return createEvent(req, new ServerResponse(req));
}
beforeEach(() => {
  vi.stubGlobal("useRuntimeConfig", () => ({
    airsGuestSecret: "local-test-key-".repeat(4),
    flowstAuthMode: "cognito",
    public: { appSurface: "air", airsGuestEnabled: true, authRequired: false },
  }));
  for (const [name, fn] of Object.entries({ createError, defineEventHandler, deleteCookie, getCookie, getHeader, getRequestURL, setCookie, setHeader })) vi.stubGlobal(name, fn);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("production account boundary", () => {
  it("keeps signed private guest sessions available in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const e = event(), session = getGuestSession(e, true)!;
    expect(verifyGuestToken(session.token)).toEqual(session.identity);
    expect(String(e.node.res.getHeader("set-cookie"))).toContain("airs_guest=");
  });
  it("cannot create a production guest even with legacy flags and a signing key", () => {
    vi.stubEnv("NODE_ENV", "production");
    const e = event();
    expect(guestMode(e)).toBe(false);
    expect(getGuestSession(e, true)).toBeNull();
    expect(e.node.res.getHeader("set-cookie")).toBeUndefined();
  });
  it("rejects an otherwise valid previously signed guest cookie and bearer token in production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const guest = getGuestSession(event(), true)!;
    vi.stubEnv("NODE_ENV", "production");
    expect(verifyGuestToken(guest.token)).toBeNull();
    expect(getGuestSession(event("airs_guest=" + guest.token), true)).toBeNull();
  });
  it("leaves anonymous visitors signed out instead of creating a guest account", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const handler = (await import("../server/api/auth/session.get")).default;
    expect(await handler(event())).toEqual({ authenticated: false });
    expect(refreshCognito).not.toHaveBeenCalled();
  });
  it("rejects cross-site account and study mutations even when guests are disabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const boundary = (await import("../server/middleware/00.air-session-boundary")).default;
    for (const path of ["/api/auth/sign-in", "/api/auth/sign-out", "/api/auth/session", "/api/study/context"]) {
      const e = event(); e.node.req.url = path; e.node.req.method = "POST";
      e.node.req.headers.host = "localhost:4324"; e.node.req.headers.origin = "https://outside.invalid";
      expect(() => boundary(e)).toThrowError(expect.objectContaining({ statusCode: 403 }));
    }
  });
  it("allows same-origin account actions without issuing guests or shared cache responses", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const boundary = (await import("../server/middleware/00.air-session-boundary")).default;
    const e = event(); e.node.req.url = "/api/auth/sign-in"; e.node.req.method = "POST";
    e.node.req.headers.host = "localhost:4324"; e.node.req.headers.origin = "http://localhost:4324";
    expect(() => boundary(e)).not.toThrow();
    expect(e.node.res.getHeader("cache-control")).toBe("private, no-store");
    expect(e.node.res.getHeader("set-cookie")).toBeUndefined();
  });
  it("restores the existing Cognito account when a stale guest cookie is also present", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const guest = getGuestSession(event(), true)!;
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(refreshCognito).mockResolvedValue({ AccessToken: "account-access-token", ExpiresIn: 3600 });
    const handler = (await import("../server/api/auth/session.get")).default;
    const e = event("airs_guest=" + guest.token + "; flowst_refresh=account-refresh-token");
    expect(await handler(e)).toEqual({ authenticated: true, accessToken: "account-access-token", expiresIn: 3600 });
    expect(refreshCognito).toHaveBeenCalledExactlyOnceWith("account-refresh-token", e);
  });
});
