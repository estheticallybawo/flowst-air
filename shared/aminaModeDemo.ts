export type DemoModeId = "study" | "interview" | "conversation" | "language";

export type DemoTurn = Readonly<{
  amina: string;
  learner: string;
  feedback: string;
  translation?: string;
  learnerTranslation?: string;
}>;

export type AminaDemoMode = Readonly<{
  id: DemoModeId;
  title: string;
  navLabel: string;
  shortDescription: string;
  scenarioLabel: string;
  contextLabel: string;
  contextDetail: string;
  goal: string;
  sourceItems: readonly Readonly<{ name: string; detail: string }>[];
  prompts: readonly DemoTurn[];
  accent: string;
}>;

export const aminaDemoModes: readonly AminaDemoMode[] = [
  {
    id: "study",
    title: "Make the idea your own",
    navLabel: "Study",
    shortDescription: "Explore a concept, recall it, then try it in context.",
    scenarioLabel: "Sample session · Product design foundations",
    contextLabel: "Your study material",
    contextDetail: "A short fictional handout about understanding a user need before choosing a solution.",
    goal: "Explain the difference between a user need and a proposed feature.",
    sourceItems: [
      { name: "Product design foundations", detail: "Sample handout · Understanding user needs" },
      { name: "Practice focus", detail: "Recall first, then apply the idea" },
    ],
    prompts: [
      {
        amina: "Without looking at your notes, what is the difference between a user need and a feature?",
        learner: "A need is what someone is trying to achieve. A feature is one possible way to help them do it.",
        feedback: "In this sample answer, the learner distinguishes the goal from a possible solution. Next, try a concrete example.",
      },
      {
        amina: "A team asks for a reminder button. What would you ask before deciding to build it?",
        learner: "What do people forget, when does it happen, and what does that stop them from doing?",
        feedback: "The sample questions explore the situation before committing to the requested feature.",
      },
      {
        amina: "Now explain the idea to a teammate using that reminder example.",
        learner: "The button is a solution we could test. First we need to understand why people miss the task and what would help them finish it.",
        feedback: "This sample explanation connects the distinction to a design decision. A later attempt could test recall with a different example.",
      },
    ],
    accent: "#0369a1",
  },
  {
    id: "interview",
    title: "Meet your next opportunity",
    navLabel: "Interview practice",
    shortDescription: "Practise answering follow-up questions grounded in a role.",
    scenarioLabel: "Sample interview · Junior product designer",
    contextLabel: "Your interview brief",
    contextDetail: "A fictional CV and job description. Amina plays the interviewer and offers coaching between questions.",
    goal: "Describe your contribution to a project with specific evidence.",
    sourceItems: [
      { name: "Alex Morgan · CV", detail: "Fictional candidate · Student app redesign" },
      { name: "Junior product designer", detail: "Sample role · Research, prototyping and collaboration" },
    ],
    prompts: [
      {
        amina: "Your CV mentions a student app redesign. What problem did you work on, and what was your own contribution?",
        learner: "Students could not find upcoming deadlines. I interviewed three classmates, mapped the current flow and prototyped a clearer task list.",
        feedback: "The sample answer identifies the problem and the candidate's own actions. The next question asks what informed a design decision.",
      },
      {
        amina: "What did those interviews change about your first design idea?",
        learner: "I initially wanted more notifications. The interviews suggested the bigger issue was finding deadlines in several different screens, so I tested a single overview instead.",
        feedback: "This sample answer connects a research observation to a changed design choice. Avoid claiming the change worked without evidence.",
      },
      {
        amina: "If you had another week, what would you test, and why?",
        learner: "I would ask students to find their next deadline in the prototype and watch where they hesitate. That would help me decide whether the overview is clear enough.",
        feedback: "The sample proposes an observable task and explains what the candidate wants to learn from it.",
      },
    ],
    accent: "#6d4eb4",
  },
  {
    id: "conversation",
    title: "Find the words before it matters",
    navLabel: "Rehearse a conversation",
    shortDescription: "Try a real-life conversation with room to pause and rephrase.",
    scenarioLabel: "Sample rehearsal · Asking for more time",
    contextLabel: "The situation",
    contextDetail: "A fictional work scenario. Amina plays your manager while you practise asking for a deadline extension.",
    goal: "Explain the constraint, propose a new deadline and agree a next step.",
    sourceItems: [
      { name: "Deadline extension", detail: "Fictional scenario · Friday deadline, Tuesday proposal" },
      { name: "Your manager", detail: "Role played by Amina · A client review is already scheduled" },
    ],
    prompts: [
      {
        amina: "We were expecting the draft on Friday. What would you like to discuss?",
        learner: "The research input arrived later than planned. Could we move the complete draft to Tuesday? I can still share the outline on Friday.",
        feedback: "The sample request explains the constraint and offers a specific alternative. The manager can now respond to the trade-off.",
      },
      {
        amina: "Tuesday might affect the client review. What could we still review on Friday?",
        learner: "I can send the structure and the two completed sections by Friday morning. Could we use the review to confirm direction, then review the remaining sections on Tuesday?",
        feedback: "The sample response acknowledges the review and proposes a smaller deliverable instead of repeating the request.",
      },
      {
        amina: "That could work. How will you keep me updated if anything else changes?",
        learner: "I'll send a progress note tomorrow afternoon and flag any risk before the review. I'll also confirm the revised dates in writing after this conversation.",
        feedback: "The sample closes with a clear update point. In a real conversation, confirm that the other person agrees to the revised plan.",
      },
    ],
    accent: "#9b603b",
  },
  {
    id: "language",
    title: "Take the conversation further",
    navLabel: "Practise a language",
    shortDescription: "Try everyday French with optional English support.",
    scenarioLabel: "Sample practice · French A2 · At a café",
    contextLabel: "Your language practice",
    contextDetail: "A fictional café conversation. Amina plays the barista; English translations support the sample dialogue.",
    goal: "Order a drink, ask a question and finish the exchange politely.",
    sourceItems: [
      { name: "French · A2 practice", detail: "Sample level selected for this demonstration" },
      { name: "At a café", detail: "Order a drink · Ask the price · Thank the barista" },
    ],
    prompts: [
      {
        amina: "Bonjour ! Qu'est-ce que vous voulez boire ?",
        learner: "Bonjour, je voudrais un café au lait, s'il vous plaît.",
        feedback: "The sample uses « je voudrais » for a polite request. Try saying the sentence once without the English support.",
        translation: "Hello! What would you like to drink?",
        learnerTranslation: "Hello, I would like a coffee with milk, please.",
      },
      {
        amina: "Bien sûr. Vous voulez quelque chose à manger aussi ?",
        learner: "Oui, un croissant, s'il vous plaît. Ça coûte combien ?",
        feedback: "The sample adds an item and asks the price. « Ça coûte combien ? » is an everyday way to ask how much something costs.",
        translation: "Of course. Would you like something to eat too?",
        learnerTranslation: "Yes, a croissant, please. How much does that cost?",
      },
      {
        amina: "Ça fait six euros. Vous prenez votre café ici ?",
        learner: "Oui, sur place. Merci beaucoup !",
        feedback: "The sample answers the question and ends politely. « Sur place » means you will have it at the café.",
        translation: "That comes to six euros. Are you having your coffee here?",
        learnerTranslation: "Yes, here. Thank you very much!",
      },
    ],
    accent: "#247564",
  },
];

export function getAminaDemoMode(id: string): AminaDemoMode {
  return aminaDemoModes.find((mode) => mode.id === id) ?? aminaDemoModes[0]!;
}
