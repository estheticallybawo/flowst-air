<script setup lang="ts">
import { Play, Square, UserRound } from "lucide-vue-next";
import type { StudyTurn } from "~/shared/study";
const props = defineProps<{
  turns: StudyTurn[];
  liveRunning: boolean;
  playingId: string;
  preparingId: string;
  audioPromptId: string;
  canStudy: boolean;
  cachedIds: string[];
  allowPlayback?: boolean;
}>();
defineEmits<{ play: [id: string] }>();
const list = ref<HTMLElement>();
function time(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
}
watch(
  () => props.turns.at(-1)?.id,
  async () => {
    const nearBottom =
      !list.value ||
      list.value.scrollHeight - list.value.scrollTop - list.value.clientHeight <
        100;
    await nextTick();
    if (nearBottom) list.value?.scrollTo({ top: list.value.scrollHeight });
  },
  { immediate: true },
);
</script>
<template>
  <div
    ref="list"
    class="saved-turns"
    tabindex="0"
    aria-label="Saved transcript and sources"
  >
    <p v-if="!turns.length" class="empty-conversation">
      Your confirmed conversation will appear here. Live captions are shown
      separately until saving is confirmed.
    </p>
    <article
      v-for="turn in turns"
      :key="turn.id"
      class="saved-turn"
      :class="{ 'is-user': turn.role === 'USER' }"
    >
      <div class="speaker-avatar">
        <UserRound v-if="turn.role === 'USER'" :size="21" /><img
          v-else
          src="/optimized/v1/mascots/amina/avatar.webp"
          width="36"
          height="36"
          alt=""
        />
      </div>
      <div class="saved-turn-body">
        <header>
          <strong>{{ turn.role === "USER" ? "You" : "Amina" }}</strong
          ><time v-if="time(turn.createdAt)" :datetime="turn.createdAt">{{
            time(turn.createdAt)
          }}</time
          ><span class="saved-indicator">Saved</span>
        </header>
        <p class="saved-bubble">{{ turn.text }}</p>
        <div v-if="turn.role === 'AMIRA'" class="turn-support">
          <details v-if="turn.sources.length || turn.provenance">
            <summary>Sources</summary>
            <small v-if="turn.provenance === 'GENERAL'"
              >General knowledge · no document match</small
            ><small v-else-if="turn.provenance === 'MIXED'"
              >Document + general knowledge</small
            >
            <p v-for="source in turn.sources" :key="source.id">
              <strong>{{ source.label }}</strong> {{ source.excerpt }}
            </p>
          </details>
          <button
            v-if="allowPlayback !== false"
            type="button"
            :disabled="
              liveRunning ||
              preparingId === turn.id ||
              (!canStudy && !cachedIds.includes(turn.id))
            "
            :aria-label="
              preparingId === turn.id
                ? 'Preparing Amina audio'
                : playingId === turn.id
                  ? 'Pause Amina'
                  : 'Listen to Amina'
            "
            @click="$emit('play', turn.id)"
          >
            <Square v-if="playingId === turn.id" :size="13" />
            <Play v-else :size="13" />{{
              preparingId === turn.id
                ? "Preparing…"
                : playingId === turn.id
                  ? "Pause"
                  : "Listen"
            }}
          </button>
        </div>
        <p v-if="audioPromptId === turn.id" class="audio-notice" role="status">
          Your browser paused voice playback. Tap Listen to hear Amina.
        </p>
      </div>
    </article>
  </div>
</template>
<style scoped>
.saved-turns {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 4px 16px;
  scrollbar-width: thin;
}

.saved-turn {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.speaker-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e0ecfc;
  display: grid;
  place-items: center;
  color: #315d82;
  overflow: hidden;
}

.speaker-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.saved-turn-body {
  min-width: 0;
  max-width: 65ch;
}

.saved-turn header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 28px;
  margin-bottom: 5px;
  font-size: 0.85rem;
}

.saved-turn header strong {
  font-size: 0.95rem;
}

.saved-turn time {
  color: #464a53;
  font-size: 0.75rem;
}

.saved-indicator {
  margin-left: auto;
  color: #38615c;
  font-size: 0.7rem;
}

.saved-bubble {
  margin: 0;
  padding: 14px 16px;
  border-radius: 4px 18px 18px 18px;
  color: #30343e;
  background: rgba(245, 197, 142, 0.18);
  font-size: 1.05rem;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.is-user {
  grid-template-columns: minmax(0, 1fr) 36px;
  margin-left: 30px;
}

.is-user .speaker-avatar {
  grid-column: 2;
  grid-row: 1;
}

.is-user .saved-turn-body {
  grid-column: 1;
  grid-row: 1;
  justify-self: end;
  width: 100%;
  text-align: right;
}

.is-user header {
  justify-content: flex-end;
}

.is-user .saved-indicator {
  margin-left: 0;
  order: -1;
  margin-right: auto;
}

.is-user .saved-bubble {
  background: #eaf1fc;
  border-radius: 18px 4px 18px 18px;
  text-align: right;
}

.turn-support {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
}

.turn-support details {
  font-size: 0.75rem;
  max-width: 80%;
}

.turn-support summary {
  min-height: 40px;
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #464a53;
}

.turn-support details p {
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.turn-support button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 40px;
  padding: 5px 8px;
  background: transparent;
  color: #464a53;
  font-size: 0.75rem;
  border-radius: 8px;
}

.turn-support button:hover {
  background: #eef3fb;
}

.turn-support button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-conversation,
.audio-notice {
  font-size: 0.85rem;
  line-height: 1.6;
  color: #464a53;
}

:is(button, summary, .saved-turns):focus-visible {
  outline: 3px solid #315d82;
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .saved-bubble {
    font-size: 0.9rem;
    padding: 12px;
  }

  .saved-turn {
    gap: 8px;
    margin-bottom: 18px;
  }

  .is-user {
    margin-left: 8px;
  }

  .saved-turn header {
    gap: 6px;
  }
}
</style>
