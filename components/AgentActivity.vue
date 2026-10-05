<script setup lang="ts">
import type { OrbState } from "~/vendor/thinking-orbs/engine";
withDefaults(
  defineProps<{
    agent: "MISU" | "AMIRA" | "KAI";
    state?: OrbState;
    label: string;
    busy?: boolean;
  }>(),
  { state: "working", busy: false },
);
</script>
<template>
  <div class="agent-activity" :aria-busy="busy">
    <AgentAvatar :agent="agent" size="large" />
    <div>
      <strong>{{
        agent === "MISU" ? "Misu" : agent === "AMIRA" ? "Amina" : "Kai"
      }}</strong>
      <p role="status" aria-live="polite">
        <AgentOrb v-if="busy" :state="state" :busy="busy" />{{ label }}
      </p>
    </div>
  </div>
</template>
<style scoped>
.agent-activity {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 0 24px;
}
.agent-activity strong {
  font-size: 1rem;
}
.agent-activity p {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.5;
  margin: 6px 0 0;
  color: #475569;
  font-size: 0.9rem;
}
</style>
