<script setup lang="ts">
import AirsAgentPresence from "~/components/demo/AirsAgentPresence.vue";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  Languages,
  LockKeyhole,
  MessagesSquare,
} from "lucide-vue-next";

const upcomingModes = [
  {
    id: "interview",
    name: "Interview practice",
    icon: BriefcaseBusiness,
    description: "Prepare to tell your story and answer follow-up questions in a call-style room.",
    context: "A role, your experience, and a question to practise.",
  },
  {
    id: "conversation",
    name: "Conversation rehearsal",
    icon: MessagesSquare,
    description: "Explore a setting for practising a conversation before it happens.",
    context: "A situation, who you are speaking with, and your goal.",
  },
  {
    id: "language",
    name: "Language practice",
    icon: Languages,
    description: "Explore everyday conversation with Amina in a language-practice setting.",
    context: "A language, your level, and an everyday situation.",
  },
];
</script>

<template>
  <AirAppShell>
    <div class="session-mode-picker">
      <header class="mode-heading">
        <p class="mode-eyebrow">New session</p>
        <h1>What would you like to practise?</h1>
        <p>Start a study session today, or take a look at the other experiences we are exploring.</p>
      </header>

      <section class="study-mode" aria-labelledby="study-mode-title">
        <div class="study-copy">
          <span class="available-badge"><span aria-hidden="true" />Available now</span>
          <div class="study-title">
            <span class="study-icon"><BookOpen :size="27" :stroke-width="1.5" aria-hidden="true" /></span>
            <h2 id="study-mode-title">Study with Amina</h2>
          </div>
          <p class="study-description">Bring your learning material and practise it aloud in a guided conversation.</p>
          <ul class="study-features">
            <li><Check :size="16" aria-hidden="true" />Choose your material and focus</li>
            <li><Check :size="16" aria-hidden="true" />Review your plan before speaking</li>
            <li><Check :size="16" aria-hidden="true" />Practise with your AI study assistant</li>
          </ul>
        </div>
        <div class="study-action">
          <p class="study-label">Your next step</p>
          <p>Choose what you want to study. You will review your session plan before the conversation starts.</p>
          <NuxtLink class="start-study" to="/home/new?mode=study">
            Start a study session <ArrowRight :size="18" aria-hidden="true" />
          </NuxtLink>
          <span class="study-note">Microphone permission comes when you start voice practice.</span>
        </div>
      </section>

      <AirsAgentPresence />

      <section class="upcoming-section" aria-labelledby="upcoming-modes-title">
        <header class="upcoming-heading">
          <h2 id="upcoming-modes-title">More ways to practise</h2>
          <p>Coming soon · Scripted previews are available to explore.</p>
        </header>
        <div class="upcoming-grid">
          <article v-for="mode in upcomingModes" :key="mode.id" class="upcoming-card">
            <div class="upcoming-topline">
              <component :is="mode.icon" :size="24" :stroke-width="1.5" aria-hidden="true" />
              <span class="upcoming-badge">Coming soon</span>
            </div>
            <h3>{{ mode.name }}</h3>
            <p class="upcoming-description">{{ mode.description }}</p>
            <p class="upcoming-context"><span>Planned context</span>{{ mode.context }}</p>
            <div class="upcoming-actions">
              <button type="button" disabled :aria-label="`${mode.name} sessions are coming soon`">
                <LockKeyhole :size="14" aria-hidden="true" />Sessions coming soon
              </button>
              <NuxtLink :to="`/home/modes?mode=${mode.id}`" :aria-label="`Preview ${mode.name.toLowerCase()}`">
                Explore the preview <ArrowUpRight :size="16" aria-hidden="true" />
              </NuxtLink>
            </div>
          </article>
        </div>
      </section>
    </div>
  </AirAppShell>
</template>

<style scoped>
.session-mode-picker {
  max-width: 1160px;
  margin: 0 auto;
  padding: 42px 40px 64px;
  color: #182c3e;
  font-family: "Albert Sans", sans-serif;
}
.mode-eyebrow,
.study-label {
  margin: 0 0 10px;
  color: #43647a;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.mode-heading h1 {
  margin: 0;
  font-size: clamp(27px, 3.3vw, 37px);
  font-weight: 600;
  line-height: 1.18;
  letter-spacing: -0.035em;
}
.mode-heading > p:last-child {
  max-width: 610px;
  margin: 13px 0 0;
  color: #5b6c7b;
  font-size: 15px;
  line-height: 1.6;
}
.study-mode {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 1fr);
  gap: 34px;
  margin-top: 30px;
  padding: 30px;
  border: 1px solid #c9dce7;
  border-radius: 20px;
  background: #f2f8fb;
}
.available-badge,
.upcoming-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}
.available-badge {
  padding: 5px 10px;
  color: #25634c;
  background: #e1f0e9;
}
.available-badge > span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.study-title {
  display: flex;
  align-items: center;
  gap: 13px;
  margin: 19px 0 12px;
}
.study-icon {
  display: grid;
  width: 49px;
  height: 49px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid #c9dce7;
  border-radius: 13px;
  color: #2b5a78;
  background: #fff;
}
.study-title h2 {
  margin: 0;
  font-size: 25px;
  font-weight: 600;
  letter-spacing: -0.03em;
}
.study-description {
  max-width: 420px;
  margin: 0;
  color: #476073;
  font-size: 15px;
  line-height: 1.6;
}
.study-features {
  display: grid;
  gap: 10px;
  margin: 21px 0 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}
.study-features li {
  display: flex;
  align-items: center;
  gap: 9px;
}
.study-features svg {
  flex-shrink: 0;
  color: #497b66;
}
.study-action {
  display: flex;
  flex-direction: column;
  align-self: center;
  padding-left: 30px;
  border-left: 1px solid #d5e3ec;
}
.study-action > p:not(.study-label) {
  margin: 0 0 22px;
  color: #476073;
  font-size: 14px;
  line-height: 1.6;
}
.start-study {
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 17px;
  border: 1px solid #244e69;
  border-radius: 10px;
  color: #fff;
  background: #2c5874;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.start-study:hover {
  background: #21465f;
}
.study-note {
  margin-top: 11px;
  color: #5b6c7b;
  font-size: 11px;
  line-height: 1.5;
}
.upcoming-section {
  margin-top: 37px;
}
.upcoming-heading h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.025em;
}
.upcoming-heading p {
  margin: 8px 0 0;
  color: #637382;
  font-size: 13px;
  line-height: 1.6;
}
.upcoming-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 17px;
  margin-top: 18px;
}
.upcoming-card {
  display: flex;
  flex-direction: column;
  padding: 23px;
  border: 1px solid #e0e6ea;
  border-radius: 16px;
  background: #fff;
}
.upcoming-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #567086;
}
.upcoming-badge {
  padding: 5px 8px;
  color: #66717d;
  background: #f0f2f4;
}
.upcoming-card h3 {
  margin: 23px 0 9px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.upcoming-description,
.upcoming-context {
  color: #5b6c7b;
  font-size: 13px;
  line-height: 1.65;
}
.upcoming-description {
  margin: 0 0 20px;
}
.upcoming-context {
  margin: auto 0 22px;
  padding-top: 17px;
  border-top: 1px solid #edf0f2;
}
.upcoming-context > span {
  display: block;
  margin-bottom: 5px;
  color: #405569;
  font-size: 11px;
  font-weight: 600;
}
.upcoming-actions {
  display: grid;
  gap: 12px;
}
.upcoming-actions button {
  display: flex;
  min-height: 41px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px;
  border: 1px solid #e3e8ec;
  border-radius: 9px;
  color: #697581;
  background: #f6f7f8;
  font: inherit;
  font-size: 12px;
  cursor: not-allowed;
}
.upcoming-actions a {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #2b5a78;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}
.upcoming-actions a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.session-mode-picker a:focus-visible {
  outline: 3px solid #88adc5;
  outline-offset: 4px;
}
@media (max-width: 1100px) {
  .session-mode-picker {
    padding: 32px 24px 48px;
  }
  .upcoming-grid {
    grid-template-columns: 1fr;
  }
  .upcoming-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(180px, 0.7fr);
    column-gap: 28px;
  }
  .upcoming-topline,
  .upcoming-card h3,
  .upcoming-description {
    grid-column: 1;
  }
  .upcoming-card h3 {
    margin-top: 19px;
  }
  .upcoming-description {
    margin-bottom: 0;
  }
  .upcoming-context {
    grid-column: 2;
    grid-row: 1 / 3;
    margin: 0 0 18px;
    padding-top: 0;
    border: 0;
  }
  .upcoming-actions {
    grid-column: 2;
    grid-row: 3;
  }
}
@media (max-width: 700px) {
  .session-mode-picker {
    padding: 27px 18px 44px;
  }
  .study-mode {
    grid-template-columns: 1fr;
    gap: 26px;
    padding: 23px;
  }
  .study-action {
    padding: 22px 0 0;
    border-top: 1px solid #d5e3ec;
    border-left: 0;
  }
  .study-title h2 {
    font-size: 23px;
  }
  .upcoming-card {
    display: flex;
    padding: 23px;
  }
  .upcoming-context {
    margin: 19px 0;
    padding-top: 17px;
    border-top: 1px solid #edf0f2;
  }
  .upcoming-actions {
    gap: 8px;
  }
}
</style>
