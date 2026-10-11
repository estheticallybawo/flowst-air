<script setup lang="ts">
import { ArrowRight, BookOpen, MessageCircle, Mic } from "lucide-vue-next";
import { FLOWST_AGENTS } from "~/shared/agents";
defineProps<{ authenticated: boolean }>();
const audiences = [
  { title: "Independent learners", text: "Work through an idea from a course, document or article, then practise explaining it in your own words." },
  { title: "Recent graduates", text: "Prepare to explain your ideas in an interview, presentation or discussion at work. Shape your practice around the audience you want to reach." },
  { title: "People building with AI", text: "Bring a public repository. Explore how it works and practise explaining the decisions behind AI-assisted code." },
];
const journey = [
  { title: "Tell Misu what matters to you", text: "Sign in, choose New session, and share your background, goals and audience. Confirm or correct Misu’s understanding before moving on." },
  { title: "Review what you’ll learn from", text: "Bring a document, public repository, readable web page or video transcript. Check which material is included before it shapes your session." },
  { title: "Shape and approve your plan", text: "Choose your purpose and available time. Review Misu’s proposed objectives, make adjustments, and approve the plan when you’re ready." },
  { title: "Think aloud with Amina", text: "Explain ideas, share your reasoning and try new examples in a spoken conversation. Ask for help or another attempt. You choose when to enable your microphone." },
  { title: "Review your evidence with Kai", text: "After completing your agreed objectives, review Kai’s feedback on your saved attempts and a suggested next exercise." },
  { title: "Choose what to practise next", text: "Return to your Growth Home, see where to focus next, and earn Tides as you complete growth cycles. Revisit saved conversations in your Library and keep practising." },
];
const features = [
  { agent: "MISU", portrait: FLOWST_AGENTS.MIRO.portrait, title: "Plan with Misu", text: "Share your background, goals and audience. Review your source material, choose your preferences, then adjust and approve the learning plan Misu proposes." },
  { agent: "AMIRA", portrait: FLOWST_AGENTS.AMIRA.portrait, title: "Practise with Amina", text: "When your plan is ready, choose when to enable your microphone. Explain ideas in your own words, reason through questions and try new examples in a guided conversation." },
  { agent: "KAI", portrait: FLOWST_AGENTS.KAI.portrait, title: "Reflect with Kai", text: "After your practice, review feedback tied to your saved attempts and source material. See the evidence behind the feedback and choose what to practise next." },
] as const;
const questions = [
  { question: "What can I learn with Airs?", answer: "Bring something you want to understand and explain: a course topic, a work-related idea or how a codebase works. Your chosen source and learning goal shape the session." },
  { question: "What sources can I bring?", answer: "Use a text-based PDF, Word document, PowerPoint, public GitHub repository, readable web page or video transcript. Review the included material before it becomes your learning plan." },
  { question: "Do I need to turn on my microphone straight away?", answer: "No. You can share your goals, review your source and approve a plan with the microphone off. Spoken practice with Amina starts when you choose to enable it." },
  { question: "How do I earn Tides?", answer: "Build evidence through your practice. Complete a growth cycle in a capability to earn a Tide, then work toward the next cycle with fresh evidence and new contexts." },
  { question: "Is Airs free to use?", answer: "The current pilot is free. Sign in or create your learner account to start. Airs is built for adults aged 18 and over." },
];
const expectations = [
  { title: "Before you speak", text: "Share your goals, review your source and approve a focused plan. Your microphone stays off while you get ready." },
  { title: "While you practise", text: "Explain, reason and try examples with Amina. Ask for help or another attempt, and choose when to pause or end." },
  { title: "After a session", text: "Return to your saved conversation and review Kai’s evidence-linked feedback. Decide which ideas deserve another pass." },
  { title: "As you keep going", text: "Build evidence across the seven capabilities, complete growth cycles and earn Tides that recognise your progress." },
];</script>

<template>
  <AirPublicShell landing>
    <div class="air-landing">
      <section class="air-hero landing-hero" aria-labelledby="landing-title">
        <div class="air-hero-copy">
          <p class="air-eyebrow">For independent learners</p>
          <h1 id="landing-title">Make what you learn <span>your own.</span></h1>
          <p class="landing-hero-promise">Make your views and knowledge easier to air</p>
          <p>Flowst Airs turns your learning material into guided spoken practice. Work through ideas, get feedback on your attempts, and earn Tides as your understanding grows.</p>
          <div class="air-hero-benefits">
            <span><BookOpen :size="18" :stroke-width="1.5" aria-hidden="true" />Your sources</span>
            <span><Mic :size="18" :stroke-width="1.5" aria-hidden="true" />Guided spoken practice</span>
            <span><MessageCircle :size="18" :stroke-width="1.5" aria-hidden="true" />Growth you can see</span>
          </div>
          <div class="air-action-row">
            <NuxtLink class="air-button" :to="authenticated ? '/airs' : '/auth/sign-in?redirect=/airs'">
              {{ authenticated ? "Continue" : "Sign in" }}
              <span class="landing-button-icon" aria-hidden="true"><ArrowRight :size="17" :stroke-width="1.5" /></span>
            </NuxtLink>
            <a class="air-button air-button-secondary" href="#how-it-works">See how a session works</a>
          </div>
          <div class="landing-team" aria-label="Your AI learning team">
            <span><AgentAvatar agent="MISU" size="compact" :labelled="true" />Misu plans</span>
            <span><AgentAvatar agent="AMIRA" size="compact" :labelled="true" />Amina practises with you</span>
            <span><AgentAvatar agent="KAI" size="compact" :labelled="true" />Kai reviews</span>
          </div>
        </div>
      </section>

      <section class="landing-problem landing-section" aria-labelledby="problem-title">
        <div class="landing-section-intro"><p class="air-eyebrow">When it’s your turn to explain</p><h2 id="problem-title">When the idea feels familiar.<br />Practice makes the words become easier</h2><p>You’ve read the article, watched the lesson or built with AI. Now you want to recall the idea, explain your thinking and use it beyond the example you’ve seen.</p></div>
        <ul><li>You recognise the material but struggle to recall it.</li><li>You follow an explanation but need help making it your own.</li><li>You’ve built something, and want to explain how and why it works.</li></ul>
      </section>


      <AirScrollStory id="how-it-works" class="landing-solution landing-section" aria-labelledby="solution-title" :count="features.length" label="Your AI learning team" item-name="agent">
        <template #intro>
          <div class="landing-section-intro">
            <p class="air-eyebrow">Your AI learning team</p><h2 id="solution-title">How it works</h2>
            <p>Misu helps you plan. Amina helps you practise aloud. Kai helps you reflect on your evidence. Three agents guide one connected learning journey.</p>
            <p class="landing-journey-continuation">Return to your Growth Home, earn Tides as you complete growth cycles, and build on your learning in your next session.</p>
            <a class="air-text-link" href="#session-journey">See your session step by step <ArrowRight :size="16" :stroke-width="1.5" aria-hidden="true" /></a>
          </div>
        </template>
        <template #item="{ index }">
          <div class="landing-features"><article><h3>{{ features[index]!.title }}</h3><p>{{ features[index]!.text }}</p><img :src="features[index]!.portrait" alt="" width="240" height="240" loading="lazy" decoding="async" /></article></div>
        </template>
      </AirScrollStory>


      <AirScrollStory id="for-you" class="landing-audience landing-section" aria-labelledby="audience-title" :count="audiences.length" label="Who Airs is for" item-name="audience">
        <template #intro><div class="landing-section-intro"><p class="air-eyebrow">Who it’s for</p><h2 id="audience-title">For learners. For graduates. For builders.</h2><p>For independent adult learners who want to understand their material and speak about it with greater confidence.</p></div></template>
        <template #item="{ index }"><dl class="landing-audience-list"><div><dt>{{ audiences[index]!.title }}</dt><dd>{{ audiences[index]!.text }}</dd></div></dl></template>
      </AirScrollStory>


      <AirScrollStory id="session-journey" class="landing-journey landing-section" aria-labelledby="journey-title" :count="journey.length" label="Your session step by step" item-name="session step">
        <template #intro><div class="landing-section-intro"><p class="air-eyebrow">Your session, step by step</p><h2 id="journey-title">Your goals lead the session.</h2><p>Start from your Growth Home, then choose New session. You review your source and approve your plan before spoken practice begins.</p><p class="landing-source-note">Bring a text-based PDF, Word document, PowerPoint, public repository, readable page or video transcript.</p></div></template>
        <template #item="{ index }"><article class="landing-session-step"><span class="landing-session-number">{{ index + 1 }}</span><h3>{{ journey[index]!.title }}</h3><p>{{ journey[index]!.text }}</p></article></template>
      </AirScrollStory>

      <AirLandingTides :authenticated="authenticated" />


      <AirScrollStory class="landing-expectations landing-section" aria-labelledby="expectations-title" :count="expectations.length" label="What to expect" item-name="expectation">
        <template #intro><div class="landing-section-intro"><p class="air-eyebrow">What to expect</p><h2 id="expectations-title">From your first session<br />to your next milestone.</h2><NuxtLink class="air-text-link" to="/airs/about">How your material and microphone are used <ArrowRight :size="16" :stroke-width="1.5" aria-hidden="true" /></NuxtLink></div></template>
        <template #item="{ index }"><dl class="landing-expectation-list"><div><dt>{{ expectations[index]!.title }}</dt><dd>{{ expectations[index]!.text }}</dd></div></dl></template>
      </AirScrollStory>

      <section id="faq" class="landing-faq landing-section" aria-labelledby="faq-title">
        <div class="landing-section-intro"><p class="air-eyebrow">A few things to know</p><h2 id="faq-title">Before you begin.</h2></div>
        <div class="landing-questions"><details v-for="item in questions" :key="item.question"><summary>{{ item.question }}</summary><p>{{ item.answer }}</p></details></div>
      </section>

      <section class="landing-start" aria-labelledby="start-title">
        <div><p class="air-eyebrow">Start with one idea</p><h2 id="start-title">What would you like to understand more deeply?</h2><p>Bring something you’re learning. Make space to work through it, put it into words, and decide what comes next.</p></div>
        <NuxtLink class="air-button" :to="authenticated ? '/airs/new' : '/auth/sign-in?redirect=/airs/new'">
          {{ authenticated ? "Start a new session" : "Sign in to start a session" }}
          <span class="landing-button-icon" aria-hidden="true"><ArrowRight :size="17" :stroke-width="1.5" /></span>
        </NuxtLink>
      </section>
    </div>
  </AirPublicShell>
</template>

<style scoped>
.air-landing { --landing-ease: cubic-bezier(.16,1,.3,1); }
.air-landing :deep(:is(h1,h2,h3,h4,h5,h6,dt,summary)) { font-family: "Unbounded", system-ui, sans-serif; }
.air-landing .landing-hero { display: block; min-height: auto; padding: 96px 0 76px; text-align: center; }
.landing-hero .air-hero-copy { max-width: 1080px; margin: auto; }
.air-landing .landing-hero h1 { max-width: 1080px; margin: 20px auto 24px; font-size: clamp(3rem,7vw,6.8rem); font-weight: 700; letter-spacing: -.045em; line-height: 1.04; text-wrap: balance; }
.air-landing .landing-hero .air-hero-copy > p:not(.air-eyebrow) { max-width: 61ch; margin-left: auto; margin-right: auto; }
.air-landing .landing-hero .landing-hero-promise { font-size: clamp(1.1rem,2vw,1.35rem); font-weight: 650; color: var(--air-ink); margin-bottom: 22px; }
.landing-hero .air-action-row, .landing-hero .air-hero-benefits { justify-content: center; }
.air-landing .landing-hero .air-hero-benefits { margin: 28px 0; gap: 12px; flex-wrap: wrap; }
.landing-hero .air-hero-benefits > span { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: #fff; line-height: 1.5; }
.landing-hero .air-hero-benefits > span:nth-child(2) { background: #f0ecfc; }
.landing-hero .air-hero-benefits > span:nth-child(3) { background: #e6f5ef; }
.landing-hero .air-hero-benefits svg { width: 22px; height: 22px; padding: 0; background: transparent; }
.air-landing .air-button { transition: transform .25s var(--landing-ease), background-color .25s var(--landing-ease); }
.landing-button-icon { width: 29px; height: 29px; display: grid; place-items: center; border-radius: 50%; background: rgb(255 255 255 / 15%); flex-shrink: 0; }
.landing-team { margin-top: 32px; display: flex; justify-content: center; flex-wrap: wrap; gap: 14px 24px; color: var(--air-muted); font-size: .8rem; }
.landing-team > span { display: inline-flex; gap: 8px; align-items: center; }
.landing-section { padding: 88px 0; }
.landing-problem, .landing-faq { min-height: 100svh; box-sizing: border-box; align-content: center; }
.landing-session-step { min-width: 0; }
.landing-session-number { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--air-accent-soft); color: var(--air-accent-strong); font-weight: 700; }
.landing-session-step h3 { margin: 24px 0 16px; font-size: clamp(1.6rem,2.6vw,2.3rem); line-height: 1.3; text-wrap: balance; }
.landing-session-step p { margin: 0; color: var(--air-muted); line-height: 1.75; }
.landing-section-intro { min-width: 0; }
.landing-section h2, .landing-start h2 { font-size: clamp(1.7rem,2.8vw,2.4rem); line-height: 1.3; margin: 14px 0 22px; text-wrap: balance; }
.landing-section-intro > p:not(.air-eyebrow), .landing-start p:not(.air-eyebrow) { color: var(--air-muted); line-height: 1.75; max-width: 53ch; }
.landing-problem { display: grid; grid-template-columns: 1.1fr 1fr; gap: 72px; align-items: center; }
.landing-problem ul { margin: 0; padding: 0 0 0 22px; display: grid; gap: 24px; color: var(--air-muted); line-height: 1.75; }
.landing-solution { display: grid; grid-template-columns: .85fr 1.3fr; gap: 64px; align-items: start; }
.landing-features { display: grid; gap: 18px; margin: 0; }
.landing-features > article { display: grid; grid-template-columns: minmax(0,1fr) 180px; grid-template-areas: "title portrait" "description portrait"; gap: 20px 32px; align-content: center; min-width: 0; }
.landing-features h3 { grid-area: title; margin: 0; font-size: clamp(1.6rem,2.6vw,2.3rem); text-wrap: balance; }
.landing-features p { grid-area: description; }
.landing-features img { grid-area: portrait; display: block; align-self: center; width: 180px; height: 240px; object-fit: cover; border-radius: 20px; }
.landing-agent-step { color: var(--air-accent-strong); font-size: .7rem; font-weight: 600; padding-right: 4px; }
.landing-features h3, .landing-audience-list dt, .landing-expectation-list dt { font-weight: 700; color: var(--air-ink); line-height: 1.5; }
.landing-features p, .landing-audience-list dd, .landing-expectation-list dd { margin: 8px 0 0; color: var(--air-muted); line-height: 1.7; }
.landing-features h3 { display: flex; align-items: center; gap: 10px; }
.landing-features p { margin: 0; font-size: 1rem; }
.landing-journey-continuation { margin: 28px 0 18px; color: var(--air-muted); line-height: 1.75; font-size: .92rem; }
.landing-audience { display: grid; grid-template-columns: 1fr 1.2fr; gap: 72px; border-top: 1px solid var(--air-line); }
.landing-audience-list, .landing-expectation-list { margin: 0; display: grid; gap: 28px; }
.landing-audience-list > div { min-width: 0; }
.landing-audience-list dt, .landing-expectation-list dt { font-size: clamp(1.6rem,2.6vw,2.3rem); line-height: 1.3; margin-bottom: 24px; text-wrap: balance; }
.air-landing .air-how { gap: 72px; }
.air-landing .air-steps li { grid-template-columns: 32px minmax(0,1fr); padding: 0 0 28px; border: 0; }
.air-landing .air-steps li + li { padding-top: 8px; }
.air-landing .air-steps li > span { display: grid; place-items: center; align-self: start; width: 32px; height: 32px; background: var(--air-accent-soft); border-radius: 50%; font-size: .75rem; }
.air-landing .air-steps h3 { font-size: 1rem; line-height: 1.5; }
.air-landing .landing-source-note { margin-top: 26px; font-size: .88rem; }
.landing-expectations { border-top: 1px solid var(--air-line); }
.landing-expectation-list { grid-template-columns: minmax(0,1fr); gap: 0; margin: 0; }
.landing-expectations > a { margin-top: 32px; line-height: 1.6; }
.landing-faq { display: grid; grid-template-columns: .7fr 1.3fr; gap: 64px; }
.landing-questions details { border-bottom: 1px solid var(--air-line); padding: 18px 0; }
.landing-questions summary { cursor: pointer; font-weight: 650; font-size: 1rem; line-height: 1.65; min-height: 44px; }
.landing-questions details p { margin: 10px 0 8px; color: var(--air-muted); line-height: 1.75; max-width: 65ch; }
.landing-start { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 40px; padding: 40px; margin: 24px 0 72px; background: var(--air-accent-soft); border-radius: 28px; }
.landing-start h2 { max-width: 24ch; font-size: clamp(1.6rem,2.3vw,2rem); }
.landing-start .air-button { white-space: nowrap; }
@media (max-width: 1000px) {
  .landing-audience, .air-landing .air-how, .landing-problem, .landing-solution, .landing-faq { gap: 36px; }
  .landing-start { grid-template-columns: minmax(0,1fr); }
  .landing-start .air-button { justify-self: start; }
}
@media (max-width: 767px) {
  .air-landing .landing-hero { padding: 56px 0; }
  .air-landing .landing-hero h1 { font-size: clamp(2.35rem,10vw,3.9rem); }
  .landing-section { padding: 48px 0; }
  .landing-audience, .air-landing .air-how, .landing-problem, .landing-solution, .landing-faq { grid-template-columns: minmax(0,1fr); gap: 28px; }
  .landing-audience-list dt, .landing-expectation-list dt { font-size: 1.5rem; }
  .landing-features > article { grid-template-columns: 64px minmax(0,1fr); grid-template-areas: "portrait title" "description description"; gap: 20px; }
  .landing-features img { width: 64px; height: 72px; border-radius: 16px; }
  .landing-features h3 { align-self: center; font-size: 1.5rem; flex-wrap: wrap; gap: 4px 8px; }
  .landing-features > article { min-height: 0; }
  .landing-expectation-list { grid-template-columns: minmax(0,1fr); gap: 26px; }
  .landing-start { padding: 26px 22px; gap: 24px; margin-bottom: 48px; }
  .landing-start .air-button { white-space: normal; width: 100%; }
}
@media (prefers-reduced-motion: no-preference) {
  .landing-hero .air-hero-copy { animation: landing-enter .65s var(--landing-ease) both; }

  .landing-button-icon { transition: transform .25s var(--landing-ease); }
}
@media (prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) {
  .air-button:hover .landing-button-icon { transform: translateX(2px); }
  .air-button:active:not(:focus-visible) { transform: scale(.98); transition-duration: 120ms; }
}
@keyframes landing-enter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .air-landing .air-button { transition: none; transform: none; } }
</style>
