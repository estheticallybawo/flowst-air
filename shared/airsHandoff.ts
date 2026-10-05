export type AirsHandoffKind = "AMINA" | "KAI";
export interface AirsHandoffStep {
  agent: "MISU" | "AMIRA" | "KAI";
  state: "working" | "composing" | "connecting" | "weaving";
  title: string;
  description: string;
}
/** Presentation of saved responsibilities; these are not live tool-completion events. */
export const AIRS_HANDOFF_STEPS: Record<AirsHandoffKind, AirsHandoffStep[]> = {
  AMINA: [
    { agent: "MISU", state: "working", title: "Misu is reviewing your plan", description: "Your approved objectives and chosen pace guide this session." },
    { agent: "MISU", state: "composing", title: "Misu is arranging your practice", description: "Amina will use your confirmed context and source to guide one question at a time." },
    { agent: "KAI", state: "connecting", title: "Misu is introducing Kai’s role", description: "Kai will consider your recorded explanations and application attempts against the approved goals." },
    { agent: "AMIRA", state: "working", title: "Amina is getting ready", description: "Your welcome is saved. You choose when to start speaking; your microphone is off." },
  ],
  KAI: [
    { agent: "AMIRA", state: "connecting", title: "Amina is passing the practice forward", description: "Your confirmed objective checkpoints remain part of this session." },
    { agent: "MISU", state: "working", title: "Misu’s goals guide the review", description: "Your approved objectives provide the criteria for feedback." },
    { agent: "KAI", state: "weaving", title: "Meet Kai’s feedback role", description: "Kai considers saved evidence, gaps and suggestions for your next practice." },
    { agent: "KAI", state: "working", title: "Your feedback workspace is next", description: "You can inspect the evidence behind your review. Completion alone does not establish mastery." },
  ],
};
export function airsHandoffStep(elapsedMs: number, durationMs = 10000): number {
  return Math.min(3, Math.max(0, Math.floor((Math.max(0, elapsedMs) / Math.max(1, durationMs)) * 4)));
}
