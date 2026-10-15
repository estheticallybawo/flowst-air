import type { GrowthCapability, GrowthDimensionId } from "./airGrowth";
import { growthCapabilities } from "./airGrowthCapabilities";

export const MILESTONE_SAMPLE_COUNTS = [0, 5, 10, 25, 50, 100] as const;
export const DEFAULT_MILESTONE_SAMPLE_TIDES = 10;

export interface AirMilestoneDemo {
  readonly id: string;
  readonly threshold: number;
  readonly title: string;
  readonly description: string;
  readonly reward: string;
  readonly capabilityIds: readonly GrowthDimensionId[];
  readonly artworks: readonly GrowthCapability[];
}

const milestoneDefinitions = [
  {
    id: "first-light",
    threshold: 5,
    title: "First Light",
    description: "A soft mint glow and a small beginning for your collection.",
    reward: "Mint glow badge",
    capabilityIds: ["verbal_retrieval"],
  },
  {
    id: "steady-current",
    threshold: 10,
    title: "Steady Current",
    description: "A lilac accent with a gentle current running through it.",
    reward: "Lilac current badge",
    capabilityIds: ["clear_explanation"],
  },
  {
    id: "open-water",
    threshold: 25,
    title: "Open Water",
    description: "A warm coral finish inspired by light across open water.",
    reward: "Coral finish badge",
    capabilityIds: ["conceptual_precision"],
  },
  {
    id: "horizon-line",
    threshold: 50,
    title: "Horizon Line",
    description: "Sea-glass green meets a fine gold detail in this paired design.",
    reward: "Sea-glass and gold badge pair",
    capabilityIds: ["reasoning_aloud", "self_monitoring"],
  },
  {
    id: "northern-lights",
    threshold: 100,
    title: "Northern Lights",
    description: "A turquoise and orchid pairing with a quiet luminous finish.",
    reward: "Turquoise and orchid badge pair",
    capabilityIds: ["transfer", "conversation_flow"],
  },
] as const;

export const airMilestoneDemo: readonly AirMilestoneDemo[] =
  milestoneDefinitions.map((milestone) => ({
    ...milestone,
    artworks: milestone.capabilityIds.flatMap((capabilityId) => {
      const capability = growthCapabilities.find(
        (candidate) => candidate.id === capabilityId,
      );
      return capability ? [capability] : [];
    }),
  }));

export function normalizeMilestoneSampleTides(sampleTides: number): number {
  return Number.isFinite(sampleTides)
    ? Math.min(100, Math.max(0, Math.floor(sampleTides)))
    : 0;
}

export function isMilestoneUnlocked(
  milestoneId: string,
  sampleTides: number,
): boolean {
  const milestone = airMilestoneDemo.find(
    (candidate) => candidate.id === milestoneId,
  );
  return Boolean(
    milestone &&
      normalizeMilestoneSampleTides(sampleTides) >= milestone.threshold,
  );
}

export function nextMilestoneThreshold(sampleTides: number): number | null {
  const normalizedTides = normalizeMilestoneSampleTides(sampleTides);
  return (
    airMilestoneDemo.find((milestone) => milestone.threshold > normalizedTides)
      ?.threshold ?? null
  );
}

function escapeSvgText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character]!;
  });
}

export function buildMilestoneShareSvg(
  milestoneId: string,
  sampleTides: number,
  artworkData: Readonly<Record<string, string>> = {},
): string | null {
  const milestone = airMilestoneDemo.find(
    (candidate) => candidate.id === milestoneId,
  );
  if (!milestone || !isMilestoneUnlocked(milestoneId, sampleTides)) return null;

  const normalizedTides = normalizeMilestoneSampleTides(sampleTides);
  const primaryColor = milestone.artworks[0]?.color ?? "#15a793";
  const secondaryColor = milestone.artworks[1]?.color ?? primaryColor;
  const embeddedArtwork = milestone.artworks.flatMap((capability) => {
    const imageData = Object.hasOwn(artworkData, capability.id)
      ? artworkData[capability.id]
      : undefined;
    return typeof imageData === "string" &&
      /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(imageData)
      ? [imageData]
      : [];
  });
  const artworkMarkup = embeddedArtwork.length
    ? embeddedArtwork
        .map((imageData, index) => {
          const imageSize = embeddedArtwork.length === 1 ? 196 : 164;
          const imageLeft =
            embeddedArtwork.length === 1 ? 442 : 374 + index * 168;
          return `<image href="${imageData}" x="${imageLeft}" y="${embeddedArtwork.length === 1 ? 98 : 114}" width="${imageSize}" height="${imageSize}" preserveAspectRatio="xMidYMid meet"/>`;
        })
        .join("")
    : `<path d="M464 196c20-48 56-64 77-28s44 43 72-2" fill="none" stroke="${primaryColor}" stroke-width="25" stroke-linecap="round"/><circle cx="486" cy="145" r="12" fill="${secondaryColor}"/><circle cx="600" cy="233" r="10" fill="${primaryColor}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="720" viewBox="0 0 1080 720" role="img" aria-labelledby="milestone-title milestone-description">
  <title id="milestone-title">Airs · ${escapeSvgText(milestone.title)} · Sample appearance concept</title>
  <desc id="milestone-description">${escapeSvgText(milestone.description)} Sample threshold: ${milestone.threshold} Tides. This is a demonstration, not an earned award.</desc>
  <rect width="1080" height="720" rx="36" fill="#f3f9fe"/>
  <rect x="28" y="28" width="1024" height="664" rx="22" fill="none" stroke="#d3e2ed"/>
  <text x="64" y="86" font-family="Unbounded, Arial, sans-serif" font-size="25" font-weight="700" fill="#17364d">Airs</text>
  <text x="1016" y="83" text-anchor="end" font-family="Albert Sans, Arial, sans-serif" font-size="13" letter-spacing="2" fill="#315e7d">MILESTONE COLLECTION</text>
  <circle cx="540" cy="196" r="112" fill="${milestone.artworks[0]?.tint ?? "#e6f5ef"}"/>
  <circle cx="540" cy="196" r="127" fill="none" stroke="${primaryColor}" stroke-opacity="0.22"/>
  ${artworkMarkup}
  <text x="540" y="375" text-anchor="middle" font-family="Unbounded, Arial, sans-serif" font-size="47" font-weight="700" fill="#17364d">${escapeSvgText(milestone.title)}</text>
  <text x="540" y="424" text-anchor="middle" font-family="Albert Sans, Arial, sans-serif" font-size="23" fill="#315e7d">${milestone.threshold} Tides · ${escapeSvgText(milestone.reward)}</text>
  <text x="540" y="475" text-anchor="middle" font-family="Albert Sans, Arial, sans-serif" font-size="19" fill="#315e7d">${escapeSvgText(milestone.description)}</text>
  <path d="M64 526h952" stroke="#d3e2ed"/>
  <text x="540" y="574" text-anchor="middle" font-family="Albert Sans, Arial, sans-serif" font-size="16" letter-spacing="2" fill="#17364d">SAMPLE · APPEARANCE CONCEPT</text>
  <text x="540" y="613" text-anchor="middle" font-family="Albert Sans, Arial, sans-serif" font-size="17" fill="#315e7d">Previewed with ${normalizedTides} sample Tides · Not an earned award</text>
  <text x="540" y="650" text-anchor="middle" font-family="Albert Sans, Arial, sans-serif" font-size="14" fill="#315e7d">A visual collection concept for the Airs hackathon demonstration.</text>
</svg>`;
}
