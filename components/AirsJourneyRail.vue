<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    stage: "MISU" | "AMINA" | "KAI";
    completed?: number;
    total?: number;
    setupProgress?: number;
    reviewReady?: boolean;
  }>(),
  { completed: 0, total: 0, setupProgress: 0, reviewReady: false },
);
const progress = computed(() =>
  props.total ? Math.min(100, (100 * props.completed) / props.total) : 0,
);
</script>
<template>
  <nav class="journey-rail" aria-label="Your learning journey">
    <div
      :class="{ active: stage === 'MISU' }"
      :aria-current="stage === 'MISU' ? 'step' : undefined"
    >
      <AgentAvatar agent="MISU" size="compact" /><span
        >Misu<small>Plan</small></span
      >
    </div>
    <span class="journey-link" aria-hidden="true"
      ><i :style="{ width: `${stage === 'MISU' ? setupProgress : 100}%` }"
    /></span>
    <div
      :class="{ active: stage === 'AMINA' }"
      :aria-current="stage === 'AMINA' ? 'step' : undefined"
    >
      <AgentAvatar agent="AMIRA" size="compact" /><span
        >Amina<small>Practise</small></span
      >
    </div>
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
    <div
      :class="{
        active: stage === 'KAI',
        upcoming: reviewReady && stage !== 'KAI',
      }"
      :aria-current="stage === 'KAI' ? 'step' : undefined"
    >
      <AgentAvatar agent="KAI" size="compact" /><span
        >Kai<small>{{ reviewReady ? "Review ready" : "Feedback" }}</small></span
      >
    </div>
  </nav>
</template>
<style scoped>
.journey-rail {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 660px;
  width: 100%;
  margin: 12px auto 24px;
  padding: 8px 0;
  box-sizing: border-box;
}
.journey-rail > div {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 16px;
  color: #68756e;
  flex: none;
  transition: background-color 0.2s ease;
}
.journey-rail > div.active {
  background: #e8f2ec;
  color: #173d2e;
  box-shadow: inset 0 0 0 1px #7eac93;
}
.journey-rail > div.upcoming {
  box-shadow: inset 0 0 0 1px #a5bda9;
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
  background: #dce4de;
  flex: 1;
  min-width: 10px;
  border-radius: 4px;
  overflow: hidden;
}
.journey-link i {
  display: block;
  height: 100%;
  background: #559777;
  transition: width 0.3s ease;
}
@media (max-width: 480px) {
  .journey-rail {
    gap: 3px;
  }
  .journey-rail > div {
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
  .journey-rail > div {
    transition: none;
  }
}
</style>
