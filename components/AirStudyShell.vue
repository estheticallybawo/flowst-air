<script setup lang="ts">
import AirAppShell from "./AirAppShell.vue";
defineProps<{ session?: boolean; workspace?: boolean }>();
</script>
<template>
  <div class="air-study-frame" :class="{ 'is-session': session || workspace }">
    <AirAppShell :session="session" :focus-mode="session || workspace"
      ><template #session-navigation
        ><slot name="session-navigation" /></template
      ><slot
    /></AirAppShell>
  </div>
</template>
<style scoped>
.air-study-frame {
  background: var(--air-canvas, #eef8ff);
}
.air-study-frame :deep(.agent-avatar-image) {
  color: var(--air-ink, #102b3f);
  background: var(--air-accent-soft, #e0f2fe);
  box-shadow: 0 6px 18px rgb(2 132 199 / 10%);
}
.is-session {
  height: 100dvh;
  min-width: 0;
  overflow: hidden;
}
.is-session :deep(.air-app),
.is-session :deep(.flowst-shell) {
  height: 100%;
  box-sizing: border-box;
  min-height: 0;
  max-width: none;
  padding: 20px clamp(20px, 4vw, 48px);
  background: var(--air-canvas, #eef8ff);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.is-session :deep(.air-app-header),
.is-session :deep(.flowst-topbar) {
  min-height: 64px;
  height: 64px;
  flex: 0 0 auto;
  top: 0;
  position: relative;
}
.is-session :deep(.air-sidebar) {
  display: none;
}
.is-session :deep(.air-app-layout) {
  display: block;
  flex: 1;
  min-height: 0;
}
.is-session :deep(.air-app-content),
.is-session :deep(.flowst-content) {
  height: 100%;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: none;
  padding: 0;
  margin: 0;
  overflow: hidden;
}
.is-session :deep(.flowst-content) {
  flex: 1;
  height: auto;
  display: block;
}
@media (max-width: 767px) {
  .is-session :deep(.air-app),
  .is-session :deep(.flowst-shell) {
    padding: max(12px, env(safe-area-inset-top)) 16px max(12px, env(safe-area-inset-bottom));
  }
  .is-session :deep(.air-app-content),
  .is-session :deep(.flowst-content) {
    padding-top: 0;
  }
  .is-session :deep(.flowst-content) {
    padding-bottom: 0;
    box-sizing: border-box;
  }
}
</style>
