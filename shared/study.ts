import type { ContextSnapshot, AirsOperation } from "./airsOrchestration";
import type { StudyFunctionRef } from "./studyPedagogy";
import type {
  StudyLocation,
  StudyMaterialKind,
  StudyProvenance,
} from "./studyMaterial";

export type StudyMode = "DISCUSSION" | "ORAL_EXAM" | "SCENARIO";

export type StudyPurpose =
  | "UNDERSTAND"
  | "EXAM"
  | "INTERVIEW"
  | "CONTENT_CREATION"
  | "OTHER";
export interface StudyPreferences {
  purpose: StudyPurpose;
  scope: "FOCUSED" | "BROAD";
  /** The learner's available time, not a promised completion time. */
  timeBudgetMinutes: number;
  context: string;
  /** Present only on new plans; legacy timeBudgetMinutes retains its whole-session meaning. */
  pacing?: {
    mode: "TOPIC_BLOCKS";
    practiceMinutes: number;
    breakMinutes: 3 | 5;
  };
}
export const DEFAULT_STUDY_PREFERENCES: StudyPreferences = {
  purpose: "UNDERSTAND",
  scope: "FOCUSED",
  timeBudgetMinutes: 15,
  context: "",
};
export const NEW_STUDY_PREFERENCES: StudyPreferences = {
  ...DEFAULT_STUDY_PREFERENCES,
  pacing: { mode: "TOPIC_BLOCKS", practiceMinutes: 5, breakMinutes: 3 },
};
export const STUDY_PURPOSE_LABELS: Record<StudyPurpose, string> = {
  UNDERSTAND: "Understand this resource",
  EXAM: "Prepare for an exam",
  INTERVIEW: "Prepare for an interview",
  CONTENT_CREATION: "Create content from this resource",
  OTHER: "Something else",
};

export interface StudySource {
  id: string;
  label: string;
  excerpt: string;
  location?: StudyLocation;
}

export interface StudyDocument {
  id: string;
  /** Misu's document-grounded display title; older chats may not have one. */
  title?: string;
  /** The original upload filename is retained for provenance. */
  name: string;
  kind: StudyMaterialKind;
  provenance?: StudyProvenance;
  createdAt: string;
  excerpt: string;
  sectionCount: number;
}

export interface StudyTurn {
  id: string;
  role: "USER" | "AMIRA";
  text: string;
  createdAt: string;
  mode: StudyMode;
  sources: StudySource[];
  provenance?: "DOCUMENT" | "GENERAL" | "MIXED";
  objectiveId?: string;
  kind?: "WELCOME" | "INTRO" | "CONTROL" | "QUESTION" | "PRACTICE";
}

export interface StudyObjective {
  id: string;
  title: string;
  outcome: string;
  sources: StudySource[];
  /** Planner-proposed effort, validated against the learner's available time. */
  /** A short planner explanation of the proposed objective, not private reasoning. */
  planningNote?: string;
  estimatedMinutes?: number;
}

export interface StudyPlan {
  pacing?: StudyPreferences["pacing"];
  estimatedBreakMinutes?: number;
  operation?: AirsOperation;
  contextSnapshot?: ContextSnapshot;
  rationale?: string;
  conversationStrategy?: string;
  evaluationCriteria?: Array<{
    id: "ACCURACY" | "CLARITY" | "RELEVANCE" | "REASONING" | "TRANSFER";
    description: string;
  }>;
  toolTrace?: Array<{ tool: string; status: "CONFIRMED" }>;
  memoryReviewId?: string;
  status: "PENDING" | "DRAFT" | "APPROVED" | "FAILED";
  version: number;
  functionRefs?: StudyFunctionRef[];
  approvedBy?: string;
  approvedAt?: string;
  objectives: StudyObjective[];
  /** Sum of the validated objective estimates; completion is never inferred from it. */
  estimatedTotalMinutes?: number;
  activeObjectiveId?: string;
  /** Set only after the learner confirms Misu's COMPLETE recommendation on the final objective. */
  courseCompletedAt?: string;
  courseCompletedBy?: string;
  generationStartedAt?: string;
  error?: string;
  recommendationError?: string;
  recommendation?: {
    objectiveId: string;
    reviewedObjectiveId?: string;
    evidenceIds?: string[];
    sourceIds?: string[];
    action: "ADVANCE" | "REVISIT" | "COMPLETE";
    reason: string;
    basedOnAttemptCount: number;
  };
}

export interface StudyPractice {
  questionNumber: number;
  totalQuestions: number;
  awaitingAnswer: boolean;
  attempts: Array<{
    question: string;
    answer: string;
    feedback: string;
    sources: StudySource[];
    objectiveId?: string;
    mode?: StudyMode;
    traceId?: string;
    evidenceId?: string;
  }>;
}

export interface StudyProgression {
  stage: "PLAN" | "COURSE" | "ORAL_EXAM" | "SCENARIO" | "COMPLETE";
  availableModes: StudyMode[];
  oralAnswersCompleted: number;
  oralAnswersRequired: number;
  scenarioAttemptCompleted: boolean;
}

export interface StudyVoiceUsageEvent {
  id: string;
  kind:
    | "TRANSCRIBE"
    | "POLLY"
    | "SONIC_INPUT"
    | "SONIC_OUTPUT"
    | "ELEVEN_INPUT"
    | "ELEVEN_OUTPUT"
    | "ELEVEN_CALL"
    | "ELEVEN_LIVE_OUTPUT";
  units: number;
  estimatedUsd?: number;
  createdAt: string;
}

export interface StudyVoiceUsage {
  transcribeSeconds: number;
  pollyCharacters: number;
  estimatedUsd?: number;
}

export interface StudyConversation {
  journey?: import("./airsJourney").AirsJourney;
  id: string;
  ownerId: string;
  document: StudyDocument;
  /** Older saved conversations may predate learner-selected planning context. */
  preferences?: StudyPreferences;
  /** Explicitly ended early; saved records remain readable and deletable. */
  abandonedAt?: string;
  mode: StudyMode;
  practice: StudyPractice;
  plan: StudyPlan;
  /** Derived from saved plan confirmation and attempts, never trusted from a client request. */
  progression?: StudyProgression;
  turns: StudyTurn[];
  voiceUsage?: StudyVoiceUsage;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
