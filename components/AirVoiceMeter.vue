<script setup lang="ts">
defineProps<{ level: number; active: boolean }>();
</script>
<template>
  <div
    class="voice-meter"
    role="img"
    :aria-label="
      active ? 'Microphone level active' : 'Microphone level inactive'
    "
  >
    <span
      v-for="bar in 13"
      :key="bar"
      :style="{
        transform:
          'scaleY(' +
          (active
            ? Math.max(0.12, Math.min(1, level * (0.35 + ((bar * 7) % 9) / 9)))
            : 0.12) +
          ')',
      }"
    />
  </div>
</template>
<style scoped>
.voice-meter {
  height: 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}
.voice-meter span {
  width: 5px;
  height: 25px;
  border-radius: 99px;
  background: var(--air-accent, #0284c7);
  transform-origin: center;
  transition: transform 100ms linear;
}
@media (prefers-reduced-motion: reduce) {
  .voice-meter span {
    transition: none;
  }
}
</style>
