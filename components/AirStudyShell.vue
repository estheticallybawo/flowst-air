<script setup lang="ts">
defineProps<{ session?: boolean }>();
</script>
<template>
  <div class="air-study-frame" :class="{ 'is-session': session }">
    <AirAppShell
      :session="session"
      ><template #session-navigation
        ><slot name="session-navigation" /></template
      ><slot
    /></AirAppShell>
  </div>
</template>
<style scoped>
.is-session {
  height: 100dvh;
  min-width: 0;
  overflow: hidden;
}
.is-session :deep(.air-app),
.is-session :deep(.flowst-shell) {
  height: 100%;
  min-height: 0;
  max-width: none;
  padding: 14px clamp(12px, 4vw, 48px);
  background: #f7faff;
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
  padding: 12px 0 0;
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
    padding: 6px 10px;
  }
  .is-session :deep(.air-app-content),
  .is-session :deep(.flowst-content) {
    padding-top: 8px;
  }
}
</style>
