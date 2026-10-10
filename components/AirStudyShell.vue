<script setup lang="ts">
import AirAppShell from "./AirAppShell.vue";
const props = defineProps<{ session?: boolean; workspace?: boolean }>();
const viewportHeight = ref<number>();
const viewportOffset = ref(0);
const keyboardOpen = ref(false);
let viewportFrame = 0;
let baselineHeight = 0;
let baselineWidth = 0;

async function updateViewport() {
  if (!props.workspace) return;
  const viewport = window.visualViewport;
  // Leave pinch zoom to the browser rather than reflowing the form while zoomed.
  if (viewport && Math.abs(viewport.scale - 1) > 0.01) {
    viewportHeight.value = undefined;
    viewportOffset.value = 0;
    keyboardOpen.value = false;
    return;
  }
  if (baselineWidth !== window.innerWidth) {
    baselineWidth = window.innerWidth;
    baselineHeight = window.innerHeight;
  }
  baselineHeight = Math.max(baselineHeight, window.innerHeight);
  const height = viewport?.height || window.innerHeight;
  const focused = document.activeElement;
  const editing = focused instanceof HTMLElement && focused.matches(
    'input:not([type="radio"]):not([type="checkbox"]):not([type="file"]), textarea, select, [contenteditable="true"]',
  );
  viewportHeight.value = height;
  keyboardOpen.value = (editing || keyboardOpen.value) && (baselineHeight - height > 120 || height < 460);
  viewportOffset.value = keyboardOpen.value ? viewport?.offsetTop || 0 : 0;
  await nextTick();
  if (!editing || !keyboardOpen.value || !(focused instanceof HTMLElement) || focused !== document.activeElement) return;
  const bounds = focused.getBoundingClientRect();
  if (bounds.top < viewportOffset.value + 16 || bounds.bottom > viewportOffset.value + height - 16) {
    focused.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
  }
}
function scheduleViewport() {
  cancelAnimationFrame(viewportFrame);
  viewportFrame = requestAnimationFrame(() => void updateViewport());
}
onMounted(() => {
  if (!props.workspace) return;
  scheduleViewport();
  window.visualViewport?.addEventListener("resize", scheduleViewport);
  window.visualViewport?.addEventListener("scroll", scheduleViewport);
  window.addEventListener("resize", scheduleViewport);
  document.addEventListener("focusin", scheduleViewport);
  document.addEventListener("focusout", scheduleViewport);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(viewportFrame);
  window.visualViewport?.removeEventListener("resize", scheduleViewport);
  window.visualViewport?.removeEventListener("scroll", scheduleViewport);
  window.removeEventListener("resize", scheduleViewport);
  document.removeEventListener("focusin", scheduleViewport);
  document.removeEventListener("focusout", scheduleViewport);
});
</script>
<template>
  <div
    class="air-study-frame"
    :class="{ 'is-session': session || workspace, 'is-workspace': workspace, 'is-keyboard-open': workspace && keyboardOpen }"
    :style="workspace ? {
      '--study-viewport-height': viewportHeight ? viewportHeight + 'px' : undefined,
      '--study-viewport-offset': viewportOffset + 'px',
    } : undefined"
  >
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
.is-workspace {
  height: var(--study-viewport-height, 100dvh);
}
@media (max-width: 767px) {
  .is-workspace :deep(input:not([type="radio"]):not([type="checkbox"])),
  .is-workspace :deep(textarea),
  .is-workspace :deep(select) {
    font-size: 16px;
  }
  .is-workspace.is-keyboard-open {
    position: fixed;
    top: var(--study-viewport-offset, 0px);
    inset-inline: 0;
    width: 100%;
  }
  .is-workspace.is-keyboard-open :deep(.air-app-content),
  .is-workspace.is-keyboard-open :deep(.flowst-content) {
    overflow-y: auto;
    overflow-x: hidden;
    scroll-padding-block: 16px;
  }
  .is-workspace.is-keyboard-open :deep(.misu-setup) {
    height: auto;
    min-height: 100%;
  }
  .is-workspace.is-keyboard-open :deep(.setup-dialog),
  .is-workspace.is-keyboard-open :deep(.context-card) {
    flex: none;
  }
  .is-workspace.is-keyboard-open :deep(.setup-body),
  .is-workspace.is-keyboard-open :deep(.context-body) {
    flex: none;
    overflow: visible;
  }
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
