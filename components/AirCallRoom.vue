<script setup lang="ts">
import { X, ChevronRight, Mic2, MicOff } from "lucide-vue-next";
const props = defineProps<{
  goal: string;
  objective: string;
  activity: { phase: string; label: string; detail: string };
  level: number;
  microphoneActive: boolean;
  liveStatus: string;
  muted: boolean;
  elapsed: number;
  caption: string;
  captionSaved: boolean;
  captionsVisible: boolean;
  liveRunning: boolean;
  planOpen: boolean;
  conversationOpen: boolean;
  loading?: boolean;
  recordedMode?: boolean;
  studyMinutes?: number;
  conversationClock?: string;
}>();
defineEmits<{ closePlan: []; closeConversation: [] }>();
const clock = computed(
  () =>
    `${Math.floor(props.elapsed / 60)
      .toString()
      .padStart(2, "0")}:${(props.elapsed % 60).toString().padStart(2, "0")}`,
);
const shortStatus = computed(() =>
  props.liveStatus === "SPEAKING"
    ? "Speaking"
    : props.liveStatus === "LISTENING"
      ? props.muted
        ? "Muted"
        : "Listening"
      : props.liveStatus === "CONNECTING"
        ? "Connecting"
        : props.activity.label,
);
</script>
<template>
  <div
    class="air-call-room"
    :class="{
      'conversation-open': conversationOpen,
      'recorded-mode': recordedMode,
    }"
  >
    <section class="call-stage" aria-label="Amina voice room">
      <details class="study-goal">
        <summary>
          <span
            ><small class="misu-handoff"
              ><AgentAvatar agent="MIRO" size="compact" /> Planned by
              Misu</small
            ><strong>{{ objective || goal }}</strong></span
          ><ChevronRight :size="18" />
        </summary>
        <p>{{ goal }}</p>
        <small v-if="studyMinutes"
          >{{ studyMinutes }} minutes available<span v-if="conversationClock">
            · {{ conversationClock }} conversation time this visit</span
          ></small
        ><small
          >Your plan is approved. Amina guides your practice; Misu’s plan is
          available in the plan panel.</small
        >
      </details>
      <AirSkeleton
        v-if="loading"
        variant="room"
        label="Checking voice access"
      />
      <div v-else class="call-presence">
        <div class="call-portrait">
          <img
            src="/optimized/v1/mascots/amina/avatar.webp"
            alt="Amina, your AI study assistant"
            width="400"
            height="400"
          />
        </div>
        <AirVoiceMeter :level="level" :active="microphoneActive" />
        <div
          class="call-state"
          role="status"
          aria-label="Current study activity"
          aria-live="polite"
        >
          <AgentOrb
            v-if="
              liveRunning &&
              (liveStatus === 'SPEAKING' ||
                (liveStatus === 'LISTENING' && !muted && microphoneActive) ||
                liveStatus === 'CONNECTING')
            "
            :busy="true"
            :state="
              liveStatus === 'SPEAKING'
                ? 'composing'
                : liveStatus === 'LISTENING'
                  ? 'listening'
                  : 'connecting'
            "
          />
          <h2>{{ shortStatus }}</h2>
          <p>
            <Mic2 v-if="microphoneActive" :size="15" /><MicOff
              v-else
              :size="15"
            />{{
              microphoneActive
                ? "Microphone on"
                : muted && liveRunning
                  ? "Microphone muted"
                  : "Microphone off"
            }}<span
              v-if="(liveRunning && liveStatus !== 'CONNECTING') || elapsed > 0"
            >
              · {{ clock }} elapsed</span
            >
          </p>
          <p class="call-detail">{{ activity.detail }}</p>
        </div>
      </div>
      <div v-if="!loading" class="call-control-area">
        <slot name="controls" /><small v-if="liveRunning" class="call-limit"
          >60-second pilot call</small
        >
      </div>
      <div class="stage-caption-slot">
        <div
          v-if="!conversationOpen && liveRunning && captionsVisible && caption"
          class="stage-caption"
        >
          <small>{{
            captionSaved
              ? "Saved transcript"
              : "Live caption · not confirmed saved"
          }}</small>
          <p>{{ caption }}</p>
        </div>
      </div>
    </section>
    <section
      v-if="conversationOpen"
      id="amina-saved-conversation"
      class="call-conversation"
      aria-label="Saved conversation"
    >
      <header>
        <h2>Saved conversation</h2>
        <button
          class="conversation-close"
          type="button"
          aria-label="Close conversation"
          @click="$emit('closeConversation')"
        >
          <X :size="19" />
        </button>
      </header>
      <slot name="conversation" />
      <div
        v-if="liveRunning && captionsVisible && caption"
        class="latest-caption"
      >
        <small>{{
          captionSaved
            ? "Saved transcript"
            : "Live caption · not confirmed saved"
        }}</small>
        <p>{{ caption }}</p>
      </div>
    </section>
    <section
      v-if="planOpen"
      id="amina-session-plan"
      class="call-plan"
      aria-label="Your session plan"
      @keydown.esc="$emit('closePlan')"
    >
      <header>
        <h2>Your session plan</h2>
        <button
          type="button"
          aria-label="Close plan"
          @click="$emit('closePlan')"
        >
          <X :size="20" />
        </button>
      </header>
      <slot name="plan" />
    </section>
  </div>
</template>
<style scoped src="~/assets/css/air-call-room.css"></style>
