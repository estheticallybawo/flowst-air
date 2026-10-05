<script setup lang="ts">
import { ArrowLeft, ListChecks, MessageCircleMore } from "lucide-vue-next";
defineProps<{
  title: string;
  planOpen: boolean;
  conversationOpen: boolean;
  controlsOnly?: boolean;
  contextOnly?: boolean;
}>();
defineEmits<{ leave: []; plan: []; conversation: [] }>();
</script>
<template>
  <div v-if="contextOnly" class="session-context">
    <button type="button" aria-label="Leave session" @click="$emit('leave')">
      <ArrowLeft :size="17" /><span>Back to library</span>
    </button>
    <h1 :title="title">{{ title }}</h1>
  </div>
  <nav
    v-else
    class="session-navigation"
    aria-label="Flowst Airs session navigation"
  >
    <button
      v-if="!controlsOnly"
      type="button"
      class="library-return"
      aria-label="Leave session"
      @click="$emit('leave')"
    >
      <ArrowLeft :size="17" /><span>Back to library</span>
    </button>
    <h1 v-if="!controlsOnly" :title="title">{{ title }}</h1>
    <div class="panel-switches">
      <button
        type="button"
        aria-label="Plan"
        :aria-expanded="planOpen"
        aria-controls="amina-session-plan"
        @click="$emit('plan')"
      >
        <ListChecks :size="17" /><span>Plan</span></button
      ><button
        type="button"
        aria-label="Conversation"
        :aria-expanded="conversationOpen"
        aria-controls="amina-saved-conversation"
        :class="{ selected: conversationOpen }"
        @click="$emit('conversation')"
      >
        <MessageCircleMore :size="17" /><span>Conversation</span>
      </button>
    </div>
  </nav>
</template>
<style scoped>
.session-navigation {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  min-width: 0;
  color: #102b3f;
}
.session-navigation:has(> .panel-switches:only-child) {
  display: flex;
  justify-content: flex-end;
}
.session-navigation h1 {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: clamp(0.95rem, 1.3vw, 1.15rem);
  font-family: "Unbounded", sans-serif;
  font-weight: 500;
  line-height: 1.5;
}
.library-return {
  padding-left: 0;
  white-space: nowrap;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  padding: 8px 14px;
  font-size: 0.85rem;
  border-radius: 999px;
  background: transparent;
  color: #475569;
  transition:
    background-color 180ms,
    transform 180ms;
}
button:active {
  transform: scale(0.98);
}
button:focus-visible {
  outline: 3px solid #0369a1;
  outline-offset: 3px;
}
.panel-switches {
  display: flex;
  gap: 6px;
}
.panel-switches button {
  border: 1px solid #c7e4f5;
}
.panel-switches .selected {
  background: #e0f2fe;
  color: #102b3f;
}
.session-context {
  display: flex;
  align-items: center;
  gap: 28px;
  min-width: 0;
  flex: none;
  padding: 2px 12px 8px;
}
.session-context button {
  padding-left: 0;
  flex: none;
}
.session-context h1 {
  margin: 0;
  font-size: clamp(0.95rem, 1.3vw, 1.2rem);
  line-height: 1.4;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: "Unbounded", sans-serif;
  font-weight: 500;
}
@media (hover: hover) and (pointer: fine) {
  button:hover {
    background: #e0f2fe;
  }
}
@media (max-width: 767px) {
  .session-context {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 0 4px 4px;
  }
  .session-context button {
    font-size: 0.75rem;
    min-height: 44px;
    width: 44px;
    padding: 8px;
  }
  .session-context button span {
    display: none;
  }
  .session-context h1 {
    font-size: 0.9rem;
    max-width: 100%;
  }
  .panel-switches button {
    padding: 8px 10px;
  }
  .panel-switches span {
    display: none;
  }
  .session-navigation {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }
  .session-navigation h1 {
    grid-row: 2;
    grid-column: 1 / -1;
    font-size: 0.85rem;
  }
  .session-navigation .panel-switches {
    grid-row: 1;
    grid-column: 2;
  }
}
@media (prefers-reduced-motion: reduce) {
  button {
    transition: none;
  }
}
</style>
