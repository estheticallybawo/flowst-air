import type {
  GrowthCapability,
  GrowthDimensionId,
  GrowthFlowmark,
  GrowthPrototypeState,
  GrowthScenario,
} from "./airGrowth";

export const growthCapabilities: readonly GrowthCapability[] = [
  {
    id: "verbal_retrieval",
    title: "Verbal Retrieval",
    meaning: "Recall an idea and express it without relying on the source.",
    color: "#237e72",
    tint: "#e6f5ef",
    artwork: {
      src: "/growth/verbal-retrieval-3d.png",
      scale: 1.45,
      placeholder: "VR",
    },
    suggestion: "Put your notes aside and explain one idea you remember.",
  },
  {
    id: "clear_explanation",
    title: "Clear Explanation",
    meaning: "Organize an idea clearly and explain it in your own words.",
    color: "#7560bc",
    tint: "#f0ecfc",
    artwork: { src: "/growth/clear-explanation-3d.png", placeholder: "CE" },
    suggestion:
      "Explain a familiar idea to someone encountering it for the first time.",
  },
  {
    id: "conceptual_precision",
    title: "Conceptual Precision",
    meaning: "Use concepts, distinctions, and relationships accurately.",
    color: "#b85d49",
    tint: "#fff0e9",
    artwork: {
      src: "/growth/conceptual-precision-3d.png",
      placeholder: "CP",
    },
    suggestion:
      "Compare two related ideas and name the distinction that matters.",
  },
  {
    id: "reasoning_aloud",
    title: "Reasoning Aloud",
    meaning:
      "Make your reasoning visible by explaining why and how ideas connect.",
    color: "#257e68",
    tint: "#e7f5ef",
    artwork: {
      src: "/growth/reasoning-aloud-3d.png",
      placeholder: "RA",
    },
    suggestion: "Make a claim, give a reason, and consider an alternative.",
  },
  {
    id: "self_monitoring",
    title: "Self-Monitoring",
    meaning:
      "Notice uncertainty, correct a mistake, and revise your reasoning.",
    color: "#947014",
    tint: "#fff7dc",
    artwork: { placeholder: "SM" },
    suggestion:
      "Revisit an explanation and name what you would change and why.",
  },
  {
    id: "transfer",
    title: "Transfer",
    meaning: "Apply an idea in a meaningfully different situation.",
    color: "#277e84",
    tint: "#e5f5f3",
    artwork: {
      src: "/growth/transfer-3d.png",
      placeholder: "TR",
    },
    suggestion:
      "Try applying your idea to a situation the source did not cover.",
  },
  {
    id: "conversation_flow",
    title: "Conversation Flow",
    meaning:
      "Follow the thread, respond to questions, and connect ideas in dialogue.",
    color: "#7160b4",
    tint: "#f0ecfa",
    artwork: {
      src: "/growth/conversation-flow-3d.png",
      placeholder: "CF",
    },
    suggestion:
      "Answer a follow-up question and connect it to your earlier explanation.",
  },
];
const seeds: Record<GrowthDimensionId, [number, number]> = {
  verbal_retrieval: [2, 45],
  clear_explanation: [3, 72],
  conceptual_precision: [1, 25],
  reasoning_aloud: [4, 88],
  self_monitoring: [2, 40],
  transfer: [1, 30],
  conversation_flow: [3, 67],
};
const evidenceText: Record<GrowthDimensionId, [string, string, string]> = {
  verbal_retrieval: [
    "Recalled the main idea without reading the source",
    "Retrieved the idea in a later sample conversation",
    "Try retrieval in a different context",
  ],
  clear_explanation: [
    "Explained independently across three sample topics",
    "Responded clearly to a follow-up question",
    "Gather another explanation in an unfamiliar context",
  ],
  conceptual_precision: [
    "Distinguished a concept from a related idea",
    "Used the distinction accurately in an example",
    "Gather another precise explanation with less support",
  ],
  reasoning_aloud: [
    "Connected a claim to its supporting reason",
    "Considered an alternative across sample contexts",
    "Gather one more independent reasoning example",
  ],
  self_monitoring: [
    "Noticed an uncertainty in an explanation",
    "Revised an earlier claim and explained the change",
    "Try a fresh opportunity for independent self-correction",
  ],
  transfer: [
    "Applied an idea to a new sample scenario",
    "Explained the connection to the original concept",
    "Try a second meaningfully different context",
  ],
  conversation_flow: [
    "Kept the thread through a follow-up question",
    "Connected a new question to an earlier idea",
    "Gather another sustained exchange on unfamiliar material",
  ],
};
const dates = ["2026-08-16", "2026-09-08", "2026-09-29", "2026-10-05"];
function sampleFlowmark(
  dimensionId: GrowthDimensionId,
  cycle: number,
  completedAt: string,
): GrowthFlowmark {
  return {
    id: `sample-${dimensionId}-${cycle}`,
    dimensionId,
    cycle,
    completedAt,
    conversations: cycle === 5 ? 6 : 4,
    contexts: 3,
    sample: true,
    evidence: [
      evidenceText[dimensionId][0],
      evidenceText[dimensionId][1],
      "Demonstrated the capability in more than one sample context",
    ],
  };
}
export function createGrowthPrototype(
  scenario: GrowthScenario = "returning",
): GrowthPrototypeState {
  const empty = scenario === "new";
  const dimensions = growthCapabilities.map((capability) => {
    const [completedCycles, progress] = empty ? [0, 0] : seeds[capability.id];
    const history = Array.from({ length: completedCycles! }, (_, i) => ({
      number: i + 1,
      completedAt: dates[i]!,
      flowmarkId: `sample-${capability.id}-${i + 1}`,
    }));
    return {
      dimensionId: capability.id,
      completedCycles: completedCycles!,
      progress: progress!,
      history,
      evidence: empty
        ? []
        : evidenceText[capability.id].map((text, i) => ({
            id: `sample-${capability.id}-e${i}`,
            text,
            met: i < 2,
            ...(i < 2
              ? {
                  topic: [
                    "Understanding a public code repository",
                    "Explaining a learning concept",
                  ][i],
                  quote:
                    i === 0
                      ? "I can explain the connection in my own words, then show how it works in this example."
                      : "That connects to my earlier point because the same relationship applies here.",
                }
              : {}),
          })),
    };
  });
  return {
    scenario,
    selectedDimension: "clear_explanation",
    dimensions,
    flowmarks: dimensions.flatMap((d) =>
      d.history.map((h) =>
        sampleFlowmark(d.dimensionId, h.number, h.completedAt),
      ),
    ),
    sessionChanges: [],
    sessionApplied: false,
    completionApplied: false,
    completion: null,
  };
}
export function applyGrowthSession(state: GrowthPrototypeState) {
  if (state.scenario !== "returning" || state.sessionApplied) return;
  const changes = [
    {
      dimensionId: "clear_explanation" as const,
      gain: 12,
      reason:
        "Explained a relationship independently and answered a follow-up question.",
    },
    {
      dimensionId: "reasoning_aloud" as const,
      gain: 8,
      reason: "Connected a claim to a reason and considered an alternative.",
    },
    {
      dimensionId: "self_monitoring" as const,
      gain: 6,
      reason: "Revised a claim after noticing uncertainty.",
    },
  ];
  state.sessionChanges = changes.map((change) => {
    const dimension = state.dimensions.find(
      (d) => d.dimensionId === change.dimensionId,
    )!;
    const previous = dimension.progress;
    dimension.progress += change.gain;
    dimension.evidence.unshift({
      id: `sample-session-${change.dimensionId}`,
      text: change.reason,
      met: true,
      topic: "A fresh sample learning conversation",
      quote:
        "I would revise that first claim. Here is the reason for the change.",
    });
    return {
      dimensionId: change.dimensionId,
      previous,
      next: dimension.progress,
      reason: change.reason,
    };
  });
  const transfer = state.dimensions.find((d) => d.dimensionId === "transfer")!;
  state.sessionChanges.push({
    dimensionId: transfer.dimensionId,
    previous: transfer.progress,
    next: transfer.progress,
    reason:
      "No new-context application occurred in this sample conversation, so there is no new Transfer evidence.",
  });
  state.sessionApplied = true;
}
export function completeGrowthCycle(state: GrowthPrototypeState) {
  if (
    state.scenario !== "returning" ||
    !state.sessionApplied ||
    state.completionApplied
  )
    return;
  const dimension = state.dimensions.find(
    (d) => d.dimensionId === "reasoning_aloud",
  )!;
  dimension.completedCycles++;
  dimension.progress = 0;
  const mark = sampleFlowmark(
    dimension.dimensionId,
    dimension.completedCycles,
    "2026-10-10",
  );
  state.flowmarks.unshift(mark);
  state.completion = {
    dimensionId: dimension.dimensionId,
    completedCycle: mark.cycle,
    progress: 100,
    flowmarkId: mark.id,
  };
  dimension.history.push({
    number: mark.cycle,
    completedAt: mark.completedAt,
    flowmarkId: mark.id,
  });
  dimension.evidence = [];
  state.selectedDimension = dimension.dimensionId;
  state.completionApplied = true;
}
export function retryGrowthPreview(state: GrowthPrototypeState) {
  if (state.scenario === "failed" || state.scenario === "pending")
    state.scenario = "returning";
}
export function growthDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
