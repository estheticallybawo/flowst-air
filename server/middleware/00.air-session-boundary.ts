import { isAirStandalone, isAirStandalonePage } from "../../shared/airSurface";
import { guestMode, guestStudyPath, getGuestSession } from "../utils/airsGuest";

export default defineEventHandler((event) => {
  if (!isAirStandalone(useRuntimeConfig(event).public.appSurface)) return;
  const url = getRequestURL(event);
  // Account-aware pages and API responses must not be cached across learners.
  if (url.pathname.startsWith("/api/") || isAirStandalonePage(url.pathname))
    setHeader(event, "Cache-Control", "private, no-store");
  // Keep the request-origin boundary for accounts as well as development guests.
  // Run before entitlement/storage handlers and include all account mutations.
  if (!["GET", "HEAD", "OPTIONS"].includes(event.method) &&
      (guestStudyPath(url.pathname) || url.pathname.startsWith("/api/auth/"))) {
    const origin = getHeader(event, "origin");
    if (origin && origin !== url.origin)
      throw createError({ statusCode: 403, statusMessage: "Open this action from your Airs session." });
  }
  if (!guestMode(event)) return;
  if (!url.pathname.startsWith("/api/") && getHeader(event, "accept")?.includes("text/html")) {
    const session = getGuestSession(event, true);
    if (session) event.node.req.headers.cookie = (event.node.req.headers.cookie || "")
      .split(";").filter(part => !part.trim().startsWith("airs_guest=")).join(";") + "; airs_guest=" + session.token;
  }
});
