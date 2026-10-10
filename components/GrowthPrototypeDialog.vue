<script setup lang="ts">
import { ArrowLeft, X } from "lucide-vue-next";
const props = defineProps<{
  open: boolean;
  title: string;
  fullScreen?: boolean;
  fallbackFocusId?: string;
}>();
const emit = defineEmits<{ close: [] }>();
const element = ref<HTMLDialogElement>();
const titleId = useId();
let returnFocus: HTMLElement | null = null;
watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (!element.value) return;
    if (open && !element.value.open) {
      returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      element.value.showModal();
      element.value.scrollTop = 0;
    } else if (!open && element.value.open) element.value.close();
  },
  { immediate: true },
);
watch(
  () => props.title,
  async () => {
    await nextTick();
    if (element.value?.open) element.value.scrollTop = 0;
  },
);
function restoreFocus() {
  if (returnFocus?.isConnected && !returnFocus.matches(":disabled"))
    returnFocus.focus();
  else if (props.fallbackFocusId)
    document.getElementById(props.fallbackFocusId)?.focus();
}
function closed() {
  emit("close");
  restoreFocus();
}
onBeforeUnmount(() => {
  element.value?.close();
  restoreFocus();
});
</script>
<template>
  <dialog
    ref="element"
    class="growth-dialog"
    :class="{ 'growth-dialog-full': fullScreen }"
    :aria-labelledby="titleId"
    @close="closed"
    @click="$event.target === element && element?.close()"
  >
    <div class="growth-dialog-toolbar">
      <header class="growth-dialog-head">
        <h2 :id="titleId">{{ title }}</h2>
        <button
          type="button"
          :aria-label="
            fullScreen ? 'Back to growth dashboard' : 'Close preview'
          "
          @click="element?.close()"
        >
          <ArrowLeft v-if="fullScreen" :size="18" /><X
            v-else
            :size="18"
          /><span>{{ fullScreen ? "Back" : "Close" }}</span>
        </button>
      </header>
      <p class="growth-dialog-notice">
        <span aria-hidden="true">◈</span> Prototype · Sample data
      </p>
    </div>
    <div class="growth-dialog-content"><slot /></div>
  </dialog>
</template>
<style scoped>
.growth-dialog-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #ffffff;
  padding-bottom: 12px;
}
.growth-dialog {
  color: #102b3f;
  background: #ffffff;
  border: 1px solid var(--air-line);
  border-radius: 18px;
  padding: 0;
  width: min(640px, calc(100% - 32px));
  max-height: calc(100dvh - 48px);
  box-shadow: 0 30px 90px #143b5c30;
  overflow: auto;
}
.growth-dialog::backdrop {
  background: #12324970;
  backdrop-filter: blur(5px);
}
.growth-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 26px 12px;
}
.growth-dialog-head h2 {
  font-size: 1.02rem;
  line-height: 1.5;
  margin: 0;
}
.growth-dialog-head button {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: #37566e;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.growth-dialog-notice {
  margin: 0 26px;
  padding: 10px 12px;
  border: 1px solid #cadce9;
  border-radius: 10px;
  background: var(--air-accent-soft);
  color: var(--air-accent-strong);
  font-size: 0.75rem;
}
.growth-dialog-notice span {
  margin-right: 5px;
}
.growth-dialog-content {
  padding: 24px 26px 28px;
}
.growth-dialog :deep(button:focus-visible),
.growth-dialog :deep(a:focus-visible) {
  outline: 3px solid #0369a1;
  outline-offset: 3px;
}
@media (max-width: 899px) {
  .growth-dialog-full {
    width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    max-width: none;
    border: 0;
    border-radius: 0;
    margin: 0;
  }
  .growth-dialog-full .growth-dialog-head {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #ffffff;
  }
  .growth-dialog-head {
    padding: 18px 18px 10px;
  }
  .growth-dialog-notice {
    margin-inline: 18px;
  }
  .growth-dialog-content {
    padding: 20px 18px;
  }
}
</style>
