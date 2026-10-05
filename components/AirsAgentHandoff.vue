<script setup lang="ts">
import { computed } from "vue";
import { AIRS_HANDOFF_STEPS, type AirsHandoffKind } from "~/shared/airsHandoff";
const props = withDefaults(defineProps<{ step: number; kind?: AirsHandoffKind }>(), { kind: "AMINA" });
const steps = computed(() => AIRS_HANDOFF_STEPS[props.kind]);
const current = computed(() => steps.value[Math.max(0, Math.min(3, props.step))]!);
</script>
<template>
  <div class="agent-handoff" aria-label="Session handoff">
    <p class="handoff-eyebrow">{{ kind === 'AMINA' ? 'Your plan is approved · Meet your practice team' : 'Your checkpoints are saved · Meet your feedback guide' }}</p>
    <div class="handoff-team" aria-hidden="true"><AgentAvatar agent="MISU" size="large" /><span>→</span><AgentAvatar agent="AMIRA" size="large" /><span>→</span><AgentAvatar agent="KAI" size="large" /></div>
    <Transition name="handoff-step" mode="out-in">
      <div :key="`${kind}-${step}`" class="handoff-message">
        <AgentActivity :agent="current.agent" :state="current.state" :busy="true" :label="current.title" />
        <p>{{ current.description }}</p>
      </div>
    </Transition>
    <div class="handoff-markers" aria-hidden="true"><span v-for="(_, index) in steps" :key="index" :class="{ active: index === step, passed: index < step }" /></div>
    <small>Guided handoff · Your microphone stays off.</small>
  </div>
</template>
<style scoped>
.agent-handoff { padding: clamp(18px, 3vw, 28px); border: 1px solid #bae6fd; border-radius: 22px; background: #f0f9ff; color: #0f172a; }
.handoff-eyebrow { margin: 0 0 18px; font-size: .8rem; font-weight: 650; color: #0369a1; }
.handoff-team { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 24px; color: #7dd3fc; }
.handoff-message { min-height: 145px; }
.handoff-message :deep(.agent-activity) { margin-bottom: 12px; }
.handoff-message > p { margin: 0; font-size: .92rem; line-height: 1.6; color: #475569; }
.handoff-markers { display: flex; gap: 8px; margin: 20px 0 10px; }
.handoff-markers span { flex: 1; height: 4px; border-radius: 5px; background: #dbeafe; }
.handoff-markers .active { background: #0284c7; }
.handoff-markers .passed { background: #7dd3fc; }
small { color: #64748b; font-size: .75rem; }
.handoff-step-enter-active, .handoff-step-leave-active { transition: opacity 160ms ease-out, transform 160ms ease-out; }
.handoff-step-enter-from { opacity: 0; transform: translateY(5px); }
.handoff-step-leave-to { opacity: 0; transform: translateY(-5px); }
@media (prefers-reduced-motion: reduce) { .handoff-step-enter-active, .handoff-step-leave-active { transition: none; } }
</style>
