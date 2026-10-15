import { FLOWST_AGENTS } from "./agents";

export type CompanionMotionAgentId = "AMIRA" | "MIRO" | "KAI";
export type CompanionMotionStateId =
  | "idle"
  | "listening"
  | "greeting"
  | "thinking"
  | "celebrate"
  | "dance";

export interface CompanionMotionDefinition {
  readonly id: CompanionMotionStateId;
  readonly label: string;
  readonly description: string;
  readonly threshold: number;
  readonly row: number;
  readonly durationMs: number;
}

export interface CompanionMotionAgent {
  readonly id: CompanionMotionAgentId;
  readonly name: string;
  readonly atlas: string;
  readonly portrait: string;
  readonly avatar: string;
}

export const COMPANION_MOTION_COLUMNS = 4;
export const COMPANION_MOTION_ROWS = 6;
export const COMPANION_MOTION_SAMPLE_COUNTS = [0, 1, 3, 5, 10] as const;

export const companionMotionCatalog: readonly CompanionMotionDefinition[] = [
  {
    id: "idle",
    label: "At ease",
    description: "A gentle facial idle loop with a relaxed expression.",
    threshold: 0,
    row: 0,
    durationMs: 2400,
  },
  {
    id: "listening",
    label: "Listening",
    description: "An attentive gaze and a subtle change of facial expression.",
    threshold: 0,
    row: 1,
    durationMs: 1600,
  },
  {
    id: "greeting",
    label: "Hello wink",
    description: "A friendly head tilt and wink for the character's greeting.",
    threshold: 1,
    row: 2,
    durationMs: 1200,
  },
  {
    id: "thinking",
    label: "Thoughtful look",
    description: "A raised brow and a small eye glance for a thoughtful look.",
    threshold: 3,
    row: 3,
    durationMs: 2000,
  },
  {
    id: "celebrate",
    label: "Beaming smile",
    description: "A bright, beaming smile for the appearance collection.",
    threshold: 5,
    row: 4,
    durationMs: 1200,
  },
  {
    id: "dance",
    label: "Happy wiggle",
    description: "A playful head wiggle that changes only the character's look.",
    threshold: 10,
    row: 5,
    durationMs: 1000,
  },
];

export const companionMotionAgents: readonly CompanionMotionAgent[] = [
  {
    id: "AMIRA",
    name: FLOWST_AGENTS.AMIRA.name,
    atlas: "/mascots/amina-motion-atlas-v1.webp",
    portrait: FLOWST_AGENTS.AMIRA.portrait!,
    avatar: FLOWST_AGENTS.AMIRA.avatar!,
  },
  {
    id: "MIRO",
    name: FLOWST_AGENTS.MIRO.name,
    atlas: "/mascots/misu-motion-atlas-v1.webp",
    portrait: FLOWST_AGENTS.MIRO.portrait!,
    avatar: FLOWST_AGENTS.MIRO.avatar!,
  },
  {
    id: "KAI",
    name: FLOWST_AGENTS.KAI.name,
    atlas: "/mascots/kai-motion-atlas-v1.webp",
    portrait: FLOWST_AGENTS.KAI.portrait!,
    avatar: FLOWST_AGENTS.KAI.avatar!,
  },
];

export function getCompanionMotion(state: string): CompanionMotionDefinition {
  return (
    companionMotionCatalog.find((motion) => motion.id === state) ??
    companionMotionCatalog[0]!
  );
}

export function getCompanionMotionAgent(agent: string): CompanionMotionAgent {
  return (
    companionMotionAgents.find((candidate) => candidate.id === agent) ??
    companionMotionAgents[0]!
  );
}

export function normalizeCompanionSampleTides(sampleTides: number): number {
  return Number.isFinite(sampleTides)
    ? Math.min(10, Math.max(0, Math.floor(sampleTides)))
    : 0;
}

export function isCompanionMotionUnlocked(
  state: string,
  sampleTides: number,
): boolean {
  const motion = companionMotionCatalog.find((candidate) => candidate.id === state);
  return Boolean(
    motion && normalizeCompanionSampleTides(sampleTides) >= motion.threshold,
  );
}

export function reconcileCompanionMotion(
  state: CompanionMotionStateId,
  sampleTides: number,
): CompanionMotionStateId {
  return isCompanionMotionUnlocked(state, sampleTides) ? state : "idle";
}
