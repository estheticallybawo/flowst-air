<script setup lang="ts">
import type { GrowthCapability } from "~/shared/airGrowth";
defineProps<{
  capability: GrowthCapability;
  cycles: number;
  progress: number;
  label?: string;
}>();
</script>
<template>
  <div
    class="growth-ring"
    role="progressbar"
    :aria-label="
      label || `${capability.title}: progress toward cycle ${cycles + 1}`
    "
    :aria-valuenow="progress"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :style="{ '--capability-color': capability.color }"
  >
    <svg
      class="growth-ring-track"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="60"
        cy="60"
        r="55"
        stroke="currentColor"
        opacity=".14"
        stroke-width="4"
      />
      <circle
        class="growth-ring-fill"
        cx="60"
        cy="60"
        r="55"
        stroke="currentColor"
        stroke-width="4"
        stroke-linecap="round"
        :stroke-dasharray="`${(345.575 * progress) / 100} 345.575`"
        transform="rotate(-90 60 60)"
      />
    </svg>
    <GrowthCapabilityArt
      class="growth-ring-art"
      :dimension="capability.id"
      :cycles="cycles"
      :color="capability.color"
      :tint="capability.tint"
    />
  </div>
</template>
<style scoped>
.growth-ring {
  position: relative;
  aspect-ratio: 1;
  color: var(--capability-color);
}
.growth-ring-track {
  width: 100%;
  height: 100%;
  display: block;
}
.growth-ring-art {
  position: absolute;
  inset: 10%;
  width: 80%;
  height: 80%;
}
.growth-ring-fill {
  transition: stroke-dasharray 0.65s ease;
}
@media (prefers-reduced-motion: reduce) {
  .growth-ring-fill {
    transition: none;
  }
}
</style>
