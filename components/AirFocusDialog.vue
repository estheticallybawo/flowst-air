<script setup lang="ts">
import { X } from "lucide-vue-next";
const props = withDefaults(defineProps<{ open: boolean; title: string; id?: string; dismissible?: boolean }>(), { dismissible: true }),
  emit = defineEmits<{ close: [] }>(),
  dialog = ref<HTMLDialogElement | null>(null);
watch(
  [() => props.open, dialog],
  async () => {
    await nextTick();
    const el = dialog.value;
    if (!el) return;
    if (props.open && !el.open) el.showModal();
    else if (!props.open && el.open) el.close();
  },
  { flush: "post" },
);
onBeforeUnmount(() => dialog.value?.close());
</script>
<template>
  <Teleport to="body"
    ><dialog
      ref="dialog"
      :id="id"
      class="air-focus-dialog"
      :aria-label="title"
      @cancel.prevent="dismissible && emit('close')"
    >
      <header>
        <h2>{{ title }}</h2>
        <button
          v-if="dismissible"
          type="button"
          :aria-label="`Close ${title.toLowerCase()}`"
          @click="emit('close')"
        >
          <X :size="20" />
        </button>
      </header>
      <div class="dialog-content"><slot /></div></dialog
  ></Teleport>
</template>
<style scoped>
.air-focus-dialog {
  border: 1px solid #cbddeb;
  border-radius: 24px;
  background: #f8fcff;
  color: #0f172a;
  width: min(580px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  padding: 0;
  box-sizing: border-box;
  box-shadow: 0 24px 70px #0f172a2e;
}
.air-focus-dialog::backdrop {
  background: #0f172a70;
}
.air-focus-dialog[open] {
  animation: dialog-entry 0.2s ease-out;
}
.air-focus-dialog header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid #cbddeb;
  position: sticky;
  top: 0;
  background: #f8fcff;
  z-index: 1;
}
.air-focus-dialog h2 {
  font-size: 1.15rem;
  line-height: 1.3;
  margin: 0;
}
.air-focus-dialog header button {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid #cbddeb;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
}
.dialog-content {
  padding: 24px;
}
.air-focus-dialog :deep(button) {
  min-height: 44px;
  cursor: pointer;
}
.air-focus-dialog :deep(button:focus-visible),
.air-focus-dialog :deep(summary:focus-visible) {
  outline: 3px solid #0284c7;
  outline-offset: 3px;
}
.air-focus-dialog :deep(p) {
  line-height: 1.6;
}
.air-focus-dialog :deep(.dialog-actions) {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 24px;
}
.air-focus-dialog :deep(.dialog-actions button) {
  padding: 10px 16px;
  border: 1px solid #bae6fd;
  border-radius: 12px;
  background: #e0f2fe;
  color: #0369a1;
}
.air-focus-dialog :deep(.dialog-actions button:disabled) {
  opacity: 0.5;
  cursor: default;
}
@keyframes dialog-entry {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .air-focus-dialog[open] {
    animation: none;
  }
}
</style>
