/** Presentation contracts for the labelled Growth prototype, independent of Kai assessment. */
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
  sample: true;
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
export interface GrowthPrototypeState {
  scenario: GrowthScenario;
  selectedDimension: GrowthDimensionId;
  dimensions: GrowthDimensionProgress[];
  flowmarks: GrowthFlowmark[];
  sessionChanges: GrowthSessionChange[];
  sessionApplied: boolean;
  completionApplied: boolean;
  completion: GrowthCycleCompletion | null;
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
