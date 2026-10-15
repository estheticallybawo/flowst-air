<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";
import { FLOWST_AGENTS } from "~/shared/agents";

const studyAgents = [
  { ...FLOWST_AGENTS.MIRO, action: "Plans", description: "Turns your material and goal into a plan you can review." },
  { ...FLOWST_AGENTS.AMIRA, action: "Practises", description: "Guides your spoken practice using the plan you approve." },
  { ...FLOWST_AGENTS.KAI, action: "Reflects", description: "Reviews saved session evidence and suggests what to revisit." },
];
</script>

<template>
  <section class="agent-presence" aria-labelledby="agent-presence-title">
    <header class="agent-presence-heading">
      <div>
        <p class="agent-presence-eyebrow">Your study companions</p>
        <h2 id="agent-presence-title">A little guidance at each step</h2>
      </div>
      <span class="study-journey-label">Study journey</span>
    </header>
    <ol class="agent-presence-journey" aria-label="Study session roles">
      <li v-for="(agent, index) in studyAgents" :key="agent.id" class="agent-presence-step">
        <div class="agent-presence-identity">
          <img v-if="agent.avatar" :src="agent.avatar" alt="" loading="lazy" />
          <div><h3>{{ agent.name }}</h3><span>{{ agent.action }}</span></div>
          <ArrowRight v-if="index < studyAgents.length - 1" class="agent-presence-arrow" :size="17" aria-hidden="true" />
        </div>
        <p>{{ agent.description }}</p>
      </li>
    </ol>
    <p class="agent-presence-note">These are the roles in a Study session. This preview does not start a session or contact an agent.</p>
  </section>
</template>

<style scoped>
.agent-presence {
  padding: 24px;
  border: 1px solid #dce5e9;
  border-radius: 18px;
  color: #1f3b4d;
  background: #fff;
  font-family: "Albert Sans", sans-serif;
}
.agent-presence-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 15px;
}
.agent-presence-eyebrow {
  margin: 0 0 7px;
  color: #587082;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.agent-presence-heading h2 {
  margin: 0;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.3;
}
.study-journey-label {
  flex-shrink: 0;
  padding: 5px 8px;
  border-radius: 6px;
  color: #567082;
  background: #f0f5f7;
  font-size: 10px;
  font-weight: 600;
}
.agent-presence-journey {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
  margin: 25px 0 0;
  padding: 0;
  list-style: none;
}
.agent-presence-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}
.agent-presence-identity img {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 12px;
  object-fit: contain;
  background: #f4f7f8;
}
.agent-presence-identity h3 {
  margin: 0 0 3px;
  font-size: 15px;
  font-weight: 650;
}
.agent-presence-identity span {
  color: #637789;
  font-size: 11px;
}
.agent-presence-arrow {
  margin-left: auto;
  color: #9aabb7;
}
.agent-presence-step > p {
  margin: 12px 0 0;
  color: #5c7080;
  font-size: 12px;
  line-height: 1.65;
}
.agent-presence-note {
  margin: 20px 0 0;
  padding-top: 15px;
  border-top: 1px solid #e8edf0;
  color: #526b7a;
  font-size: 11px;
  line-height: 1.6;
}
@media (max-width: 700px) {
  .agent-presence {
    padding: 21px;
  }
  .agent-presence-heading {
    flex-wrap: wrap;
  }
  .agent-presence-journey {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .agent-presence-arrow {
    transform: rotate(90deg);
  }
  .agent-presence-step > p {
    margin-top: 8px;
  }
}
</style>
