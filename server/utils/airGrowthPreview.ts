import type { H3Event } from "h3";
import { growthPreviewEnabled } from "../../shared/airGrowthPreview";

export function isAirGrowthPreview(event: H3Event): boolean {
  return growthPreviewEnabled(
    useRuntimeConfig(event).airGrowthPreview,
    process.env.VERCEL_ENV,
    process.env.NODE_ENV,
  );
}
