<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    stage: "MISU" | "AMINA" | "KAI";
    completed?: number;
    total?: number;
    setupProgress?: number;
    reviewReady?: boolean;
    planReady?: boolean;
    practiceReady?: boolean;
    disabled?: boolean;
  }>(),
  { completed: 0, total: 0, setupProgress: 0, reviewReady: false, planReady: false, practiceReady: false, disabled: false },
);
defineEmits<{ select: [agent: 'MISU' | 'AMINA' | 'KAI'] }>();
const progress = computed(() =>
  props.total ? Math.min(100, (100 * props.completed) / props.total) : 0,
);
</script>
<template>
  <nav class="journey-rail" aria-label="Your learning journey">
    <button
      type="button"
      :disabled="disabled || (!planReady && stage !== 'MISU')"
      :aria-label="planReady ? 'Misu: view your saved plan and progress' : 'Misu: planning'"
      :class="{ active: stage === 'MISU' }"
      :aria-current="stage === 'MISU' ? 'step' : undefined"
      @click="$emit('select', 'MISU')"
    >
      <AgentAvatar agent="MISU" size="compact" /><span
        >Misu<small>Plan</small></span
      >
    </button>
    <span class="journey-link" aria-hidden="true"
      ><i :style="{ width: `${stage === 'MISU' ? setupProgress : 100}%` }"
    /></span>
    <button
      type="button"
      :disabled="disabled || (!practiceReady && stage !== 'AMINA')"
      :aria-label="practiceReady || stage === 'AMINA' ? 'Amina: return to practice' : 'Amina: available after plan preparation'"
      :class="{ active: stage === 'AMINA' }"
      :aria-current="stage === 'AMINA' ? 'step' : undefined"
      @click="$emit('select', 'AMINA')"
    >
      <AgentAvatar agent="AMIRA" size="compact" /><span
        >Amina<small>Practise</small></span
      >
    </button>
    <span
      class="journey-link"
      role="progressbar"
      aria-label="Confirmed objective checkpoints"
      :aria-valuenow="completed"
      :aria-valuemin="0"
      :aria-valuemax="Math.max(1, total)"
      :aria-valuetext="`${completed} of ${total} objective checkpoints confirmed`"
      ><i :style="{ width: `${progress}%` }"
    /></span>
    <button
      type="button"
      :disabled="disabled || !reviewReady"
      :aria-label="reviewReady ? 'Kai: view feedback' : 'Kai: available after confirmed practice checkpoints'"
      :class="{
        active: stage === 'KAI',
        upcoming: reviewReady && stage !== 'KAI',
      }"
      :aria-current="stage === 'KAI' ? 'step' : undefined"
      @click="$emit('select', 'KAI')"
    >
      <AgentAvatar agent="KAI" size="compact" /><span
        >Kai<small>{{ reviewReady ? "Review ready" : "Feedback" }}</small></span
      >
    </button>
  </nav>
</template>
<style scoped>
.journey-rail {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 660px;
  width: 100%;
  margin: 8px auto 16px;
  padding: 8px 0;
  box-sizing: border-box;
}
.journey-rail > button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 16px;
  min-height: 52px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: #49627a;
  flex: none;
  transition: background-color 160ms ease, transform 120ms ease;
}
.journey-rail > button.active {
  background: #e1f1fd;
  color: #174968;
  box-shadow: inset 0 0 0 1px #88badb;
}
.journey-rail > button.upcoming {
  box-shadow: inset 0 0 0 1px #afcde0;
}
.journey-rail > button:disabled { cursor: default; color: #667f91; }
.journey-rail > button:focus-visible { outline: 3px solid #337ba9; outline-offset: 3px; }
.journey-rail > button:active:not(:disabled) { transform: scale(.98); }
@media (hover: hover) and (pointer: fine) {
  .journey-rail > button:hover:not(:disabled) { background: #e7f3fc; }
}
.journey-rail span {
  font-size: 0.8rem;
  font-weight: 600;
}
.journey-rail small {
  display: block;
  font-size: 0.68rem;
  font-weight: 400;
  margin-top: 3px;
}
.journey-link {
  height: 3px;
  background: #d7e6f1;
  flex: 1;
  min-width: 10px;
  border-radius: 4px;
  overflow: hidden;
}
.journey-link i {
  display: block;
  height: 100%;
  background: #5e9ec7;
  transition: width 0.3s ease;
}
@media (max-width: 480px) {
  .journey-rail {
    gap: 3px;
  }
  .journey-rail > button {
    gap: 5px;
    padding: 5px;
  }
  .journey-rail span {
    font-size: 0.72rem;
  }
  .journey-rail small {
    font-size: 0.62rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .journey-link i,
  .journey-rail > button {
    transition: none;
  }
}
</style>
