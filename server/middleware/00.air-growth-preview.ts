import { createError, defineEventHandler, getRequestURL, setHeader } from "h3";
import { isAirGrowthPreview } from "../utils/airGrowthPreview";

export default defineEventHandler((event) => {
  if (!isAirGrowthPreview(event)) return;
  setHeader(event, "Cache-Control", "private, no-store");
  const path = getRequestURL(event).pathname;
  if (path === "/api" || path.startsWith("/api/")) {
    throw createError({
      statusCode: 503,
      statusMessage: "This Growth demo uses sample data. Real sessions are unavailable.",
      data: { code: "GROWTH_SAMPLE_PREVIEW" },
    });
  }
});
