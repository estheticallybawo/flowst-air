import type { GrowthDimensionId } from './airGrowth';
import type { CompanionMotionAgentId } from './companionMotion';

export type WebCompanionTopicId = 'retrieval' | 'explanation' | 'precision' | 'reasoning' | 'monitoring' | 'transfer' | 'conversation';
export type WebCompanionStage = 'invite' | 'plan' | 'practice' | 'answer' | 'reflection';

export interface WebCompanionTopic {
  id: WebCompanionTopicId;
  dimensionId: GrowthDimensionId;
  title: string;
  context: string;
  invitation: string;
  objectives: [string, string, string];
  prompt: string;
  sampleAnswer: string;
  reflection: { observation: string; gap: string; nextStep: string };
}

export const WEB_COMPANION_TOPICS: readonly WebCompanionTopic[] = [
  {
    id: 'retrieval', dimensionId: 'verbal_retrieval', title: 'Verbal Retrieval',
    context: 'A capability introduced on your Airs Growth Home: recalling an idea in your own words.',
    invitation: 'Hi, I’m Misu. Exploring Verbal Retrieval on Home? I can help turn that idea into a short practice plan.',
    objectives: ['Describe retrieval in your own words.', 'Contrast recalling an idea with rereading it.', 'Give one example you could try after reading.'],
    prompt: 'Without looking back at a source, how would you explain verbal retrieval to a friend? Add one example.',
    sampleAnswer: 'Verbal retrieval is bringing an idea back from memory and saying it in my own words. Instead of rereading a paragraph, I could close it and explain its main point to a friend.',
    reflection: {
      observation: 'The scripted answer defines retrieval and gives a concrete example: closing the source and explaining its main point.',
      gap: 'This sample does not show whether the explanation stays accurate against a particular learning source.',
      nextStep: 'A next exercise could be to compare the explanation with that source and name one missing detail.',
    },
  },
  {
    id: 'explanation', dimensionId: 'clear_explanation', title: 'Clear Explanation',
    context: 'A capability introduced on your Airs Growth Home: making an idea understandable to someone else.',
    invitation: 'Hi, I’m Misu. Want to explore Clear Explanation from this Home page? Let’s make a little plan before you try explaining it.',
    objectives: ['State the main idea before its details.', 'Adapt your words to a particular listener.', 'Use an example to make the idea concrete.'],
    prompt: 'How would you make an unfamiliar idea clear to a beginner? Describe your approach and one example.',
    sampleAnswer: 'I would start with the main idea, explain unfamiliar words, and use an example the listener knows. To explain a variable, I might compare it with a labelled box that holds a value.',
    reflection: {
      observation: 'The scripted answer proposes a sequence and supplies a labelled-box example for a beginner.',
      gap: 'It does not yet explain where that comparison stops being useful, or demonstrate that the listener understood.',
      nextStep: 'A next exercise could be to explain one limitation of the example and invite the listener to restate the idea.',
    },
  },
  {
    id: 'precision', dimensionId: 'conceptual_precision', title: 'Conceptual Precision',
    context: 'A capability introduced on your Airs Growth Home: using concepts, distinctions and relationships accurately.',
    invitation: 'Exploring Conceptual Precision? I can help turn this page’s idea into a short practice plan.',
    objectives: ['Define a concept using precise words.', 'Distinguish it from a related concept.', 'Give an example that makes the distinction clear.'],
    prompt: 'How are an example and a definition different? Explain the distinction and give one of each.',
    sampleAnswer: 'A definition describes what a concept means; an example is a particular instance. A triangle is a polygon with three sides. A road sign with that shape is an example, not the definition itself.',
    reflection: {
      observation: 'The scripted answer distinguishes a definition from an example and illustrates both using a triangle.',
      gap: 'This sample does not show accurate use of concepts from the learner’s own material.',
      nextStep: 'A next exercise could be to define a concept from an approved source and distinguish it from a related idea.',
    },
  },
  {
    id: 'reasoning', dimensionId: 'reasoning_aloud', title: 'Reasoning Aloud',
    context: 'A capability introduced on your Airs Growth Home: making the reasons behind an explanation explicit.',
    invitation: 'Hi, I’m Misu. Curious about Reasoning Aloud on Home? I can suggest a plan for making the “why” behind an answer easier to follow.',
    objectives: ['State a conclusion clearly.', 'Connect the conclusion to a reason.', 'Consider an alternative or limitation.'],
    prompt: 'Why might explaining a concept after reading be useful? Give a reason and one limitation.',
    sampleAnswer: 'Explaining after reading could help me notice gaps because I have to connect the ideas without copying the text. But sounding confident does not prove I am right; I should still check my explanation against the source.',
    reflection: {
      observation: 'The scripted answer connects a suggestion to a reason and states a limitation about confidence and accuracy.',
      gap: 'It gives no actual explanation of a learning concept to check against a source.',
      nextStep: 'A next exercise could be to explain a specific concept and point to the source evidence supporting it.',
    },
  },
  {
    id: 'monitoring', dimensionId: 'self_monitoring', title: 'Self-Monitoring',
    context: 'A capability introduced on your Airs Growth Home: noticing uncertainty and revising an explanation.',
    invitation: 'Exploring Self-Monitoring? I can suggest a short plan for noticing what needs another look.',
    objectives: ['Name a part of an explanation you are unsure about.', 'Describe how you would check it.', 'Revise the explanation using what you find.'],
    prompt: 'Imagine you notice a gap while explaining something. How would you check it and revise your explanation?',
    sampleAnswer: 'I would name the step I cannot explain rather than guess. Then I would check the relevant section of my source, try the explanation again, and say which part I changed and why.',
    reflection: {
      observation: 'The scripted answer describes identifying a gap, checking a source and explaining a revision.',
      gap: 'It describes a strategy, but contains no actual mistake or source-backed revision to review.',
      nextStep: 'A next exercise could be to revisit an uncertain claim and explain a specific correction with source evidence.',
    },
  },
  {
    id: 'transfer', dimensionId: 'transfer', title: 'Transfer',
    context: 'A capability introduced on your Airs Growth Home: applying an idea in a meaningfully different situation.',
    invitation: 'Exploring Transfer? I can help plan a small exercise that takes an idea into a different situation.',
    objectives: ['State an idea you could apply.', 'Choose a different situation for it.', 'Explain what carries over and what changes.'],
    prompt: 'How could a checklist used for packing help with preparing a presentation? Explain a similarity and a difference.',
    sampleAnswer: 'Both checklists can help me notice missing essentials before I begin. A presentation checklist might include testing slides and practising the opening instead of packing clothes. It would not tell me whether the explanation itself is clear.',
    reflection: {
      observation: 'The scripted answer applies a checklist to a different situation and names a limitation.',
      gap: 'This everyday analogy does not demonstrate transfer of a concept from the learner’s study material.',
      nextStep: 'A next exercise could be to apply a source-backed concept to a new case and justify which parts still hold.',
    },
  },
  {
    id: 'conversation', dimensionId: 'conversation_flow', title: 'Conversation Flow',
    context: 'A capability introduced on your Airs Growth Home: responding to another person while keeping an explanation connected.',
    invitation: 'Exploring Conversation Flow? I can help plan a short practice with a follow-up question.',
    objectives: ['Respond to the question that was asked.', 'Connect the response to your main idea.', 'Invite a useful follow-up or clarification.'],
    prompt: 'Someone asks “Can you give an example?” while you explain an idea. How could you respond and keep the conversation connected?',
    sampleAnswer: 'I would give an example linked to the point I was making, explain that link, and ask whether it addresses the question. If it does not, I would invite them to say which part needs a different explanation.',
    reflection: {
      observation: 'The scripted answer proposes a relevant example, a connecting explanation and a clarification question.',
      gap: 'No actual exchange is shown, so this sample cannot establish how the learner responds to another person.',
      nextStep: 'A next exercise could be to answer a real follow-up and explain how it connects to the original idea.',
    },
  },
];

export interface WebCompanionState {
  enabled: boolean;
  topicId: WebCompanionTopicId;
  inviter: CompanionMotionAgentId;
  stage: WebCompanionStage;
  visibility: 'open' | 'minimized' | 'snoozed';
  motion: boolean;
}

export type WebCompanionAction =
  | { type: 'enable' | 'disable' | 'open-plan' | 'approve-plan' | 'show-sample-answer' | 'reflect' | 'restart' | 'minimize' | 'snooze' | 'reopen' | 'route-left' }
  | { type: 'topic'; topicId: WebCompanionTopicId }
  | { type: 'inviter'; agentId: CompanionMotionAgentId }
  | { type: 'motion'; enabled: boolean };

export function createWebCompanionState(): WebCompanionState {
  return { enabled: false, topicId: 'retrieval', inviter: 'MIRO', stage: 'invite', visibility: 'open', motion: true };
}

export function getWebCompanionTopic(id: string): WebCompanionTopic {
  return WEB_COMPANION_TOPICS.find(topic => topic.id === id) || WEB_COMPANION_TOPICS[0]!;
}

export function getWebCompanionTopicForDimension(dimensionId: string): WebCompanionTopic {
  return WEB_COMPANION_TOPICS.find(topic => topic.dimensionId === dimensionId) || WEB_COMPANION_TOPICS[0]!;
}

export function getWebCompanionInvitation(topic: WebCompanionTopic, inviter: CompanionMotionAgentId): string {
  if (inviter === 'AMIRA') return `Want to practise ${topic.title} aloud? Start a session and explain it in your own words.`;
  if (inviter === 'KAI') return `Curious about ${topic.title}? Preview how a reflection on a sample answer could work.`;
  return topic.invitation;
}

export function transitionWebCompanion(state: WebCompanionState, action: WebCompanionAction): WebCompanionState {
  if (action.type === 'disable') return createWebCompanionState();
  if (action.type === 'enable') return { ...state, enabled: true, stage: 'invite', visibility: 'open' };
  if (action.type === 'topic') return WEB_COMPANION_TOPICS.some(topic => topic.id === action.topicId)
    ? { ...state, topicId: action.topicId, stage: 'invite' } : state;
  if (action.type === 'inviter') return ['MIRO', 'AMIRA', 'KAI'].includes(action.agentId)
    ? { ...state, inviter: action.agentId, stage: 'invite' } : state;
  if (action.type === 'motion') return { ...state, motion: action.enabled };
  if (!state.enabled) return state;
  if (action.type === 'route-left') return { ...state, stage: 'invite', visibility: 'open' };
  if (action.type === 'restart') return { ...state, stage: 'invite', visibility: 'open' };
  if (action.type === 'minimize') return { ...state, visibility: 'minimized' };
  if (action.type === 'snooze') return { ...state, visibility: 'snoozed' };
  if (action.type === 'reopen') return { ...state, visibility: 'open' };
  if (state.visibility !== 'open') return state;
  if (action.type === 'open-plan' && state.stage === 'invite') return { ...state, stage: 'plan' };
  if (action.type === 'approve-plan' && state.stage === 'plan') return { ...state, stage: 'practice' };
  if (action.type === 'show-sample-answer' && state.stage === 'practice') return { ...state, stage: 'answer' };
  if (action.type === 'reflect' && state.stage === 'answer') return { ...state, stage: 'reflection' };
  return state;
}
