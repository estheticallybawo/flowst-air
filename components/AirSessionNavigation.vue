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
  <nav v-else class="session-navigation" aria-label="Flowst Air session navigation">
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
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 20px;
  min-width: 0;
  color: #0d0f14;
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
  color: #464a53;
  transition:
    background-color 180ms,
    transform 180ms;
}
button:active {
  transform: scale(0.98);
}
button:focus-visible {
  outline: 3px solid #315d82;
  outline-offset: 3px;
}
.panel-switches {
  display: flex;
  gap: 6px;
}
.panel-switches button {
  border: 1px solid #dbdee5;
}
.panel-switches .selected {
  background: #eef3fb;
  color: #0d0f14;
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
    background: #eef3fb;
  }
}
@media (max-width: 767px) {
  .session-context {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    padding: 0 4px 4px;
  }
  .session-context button {
    font-size: 0.75rem;
    min-height: 36px;
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
    gap: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  button {
    transition: none;
  }
}
</style>
