/** Growth presentation contracts, independent of data source and Kai session assessment. */
export type GrowthDataSource = "example" | "assessed";
export type GrowthReviewStatus = "ready" | "pending" | "failed";
export type GrowthDimensionId =
  | "verbal_retrieval"
  | "clear_explanation"
  | "conceptual_precision"
  | "reasoning_aloud"
  | "self_monitoring"
  | "transfer"
  | "conversation_flow";
export type GrowthScenario = "returning" | "new" | "pending" | "failed";
export interface GrowthCapability {
  id: GrowthDimensionId;
  title: string;
  meaning: string;
  color: string;
  tint: string;
  artwork: { src?: string; scale?: number; placeholder: string };
  suggestion: string;
}
export interface GrowthEvidenceSummary {
  id: string;
  text: string;
  met: boolean;
  topic?: string;
  quote?: string;
}
export interface GrowthCycleHistory {
  number: number;
  completedAt: string;
  flowmarkId: string;
}
export interface GrowthDimensionProgress {
  dimensionId: GrowthDimensionId;
  completedCycles: number;
  progress: number;
  evidence: GrowthEvidenceSummary[];
  history: GrowthCycleHistory[];
}
export interface GrowthFlowmark {
  id: string;
  dimensionId: GrowthDimensionId;
  cycle: number;
  completedAt: string;
  conversations: number;
  contexts: number;
  evidence: string[];
  source: GrowthDataSource;
}
export interface GrowthSessionChange {
  dimensionId: GrowthDimensionId;
  previous: number;
  next: number;
  reason: string;
}
export interface GrowthCycleCompletion {
  dimensionId: GrowthDimensionId;
  completedCycle: number;
  progress: 100;
  flowmarkId: string;
}
export interface GrowthSnapshot {
  source: GrowthDataSource;
  reviewStatus: GrowthReviewStatus;
  dimensions: GrowthDimensionProgress[];
  flowmarks: GrowthFlowmark[];
  sessionChanges: GrowthSessionChange[];
  completion: GrowthCycleCompletion | null;
}
/** Example adapter controls are not part of the product snapshot. */
export interface GrowthPrototypeState extends GrowthSnapshot {
  scenario: GrowthScenario;
  selectedDimension: GrowthDimensionId;
  sessionApplied: boolean;
  completionApplied: boolean;
}
export function growthBadgeStage(completedCycles: number) {
  return completedCycles >= 10
    ? 4
    : completedCycles >= 5
      ? 3
      : completedCycles >= 3
        ? 2
        : completedCycles >= 1
          ? 1
          : 0;
}

export function growthDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
