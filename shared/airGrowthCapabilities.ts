import type { GrowthCapability } from "./airGrowth";

export const growthCapabilities: readonly GrowthCapability[] = [
  {
    id: "verbal_retrieval",
    title: "Verbal Retrieval",
    meaning: "Recall an idea and express it without relying on the source.",
    color: "#15a793",
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
    color: "#ad9edd",
    tint: "#f0ecfc",
    artwork: { src: "/growth/clear-explanation-3d.png", placeholder: "CE" },
    suggestion:
      "Explain a familiar idea to someone encountering it for the first time.",
  },
  {
    id: "conceptual_precision",
    title: "Conceptual Precision",
    meaning: "Use concepts, distinctions, and relationships accurately.",
    color: "#e29d8e",
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
    color: "#71c9b3",
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
    color: "#daac68",
    tint: "#fff7dc",
    artwork: {
      src: "/growth/self-monitoring-3d.png",
      placeholder: "SM",
    },
    suggestion:
      "Revisit an explanation and name what you would change and why.",
  },
  {
    id: "transfer",
    title: "Transfer",
    meaning: "Apply an idea in a meaningfully different situation.",
    color: "#4fd2db",
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
    color: "#c38cd4",
    tint: "#f0ecfa",
    artwork: {
      src: "/growth/conversation-flow-3d.png",
      placeholder: "CF",
    },
    suggestion:
      "Answer a follow-up question and connect it to your earlier explanation.",
  },
];
