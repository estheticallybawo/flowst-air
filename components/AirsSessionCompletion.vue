<script setup lang="ts">
import { ArrowRight, RotateCcw } from 'lucide-vue-next'
import type { KaiReview } from '~/shared/airsOrchestration'
import { studyCompletionInvitation } from '~/shared/studyCompletionInvitation'
const props = defineProps<{ review: KaiReview; busy?: boolean; error?: string }>()
defineEmits<{ repeat: []; newSession: []; dismiss: [] }>()
const invitation = computed(() => studyCompletionInvitation(props.review))
const particles = Array.from({ length: 30 }, (_, i) => ({
  left: `${(i * 37 + 7) % 100}%`, delay: `${(i % 6) * .06}s`,
  drift: `${((i * 23) % 100) - 50}px`, rotation: `${((i * 47) % 540) - 270}deg`,
  color: ['#6daee3', '#88cfbe', '#b0a2e2', '#f3cf86'][i % 4],
}))
</script>
<template>
  <section class="session-completion" aria-labelledby="session-completion-heading">
    <div v-if="invitation.celebrate" class="completion-confetti" aria-hidden="true">
      <i v-for="(particle, index) in particles" :key="index" :style="{ left: particle.left, animationDelay: particle.delay, '--drift': particle.drift, '--rotation': particle.rotation, backgroundColor: particle.color }" />
    </div>
    <div class="misu-invitation"><AgentAvatar agent="MISU" size="large" /><span>Misu · Your next session</span></div>
    <h3 id="session-completion-heading">{{ invitation.title }}</h3>
    <p>{{ invitation.message }}</p>
    <p class="fresh-session-note">Practising again creates a fresh plan for you to review. This session’s evidence and feedback stay saved.</p>
    <p v-if="error" class="completion-error" role="alert">{{ error }}</p>
    <div class="completion-actions">
      <button type="button" class="repeat-action" :disabled="busy" @click="$emit('repeat')"><RotateCcw :size="17" />{{ busy ? 'Preparing your session…' : 'Practise again' }}</button>
      <button type="button" class="new-action" :disabled="busy" @click="$emit('newSession')">New session <ArrowRight :size="17" /></button>
      <button type="button" class="stay-action" :disabled="busy" @click="$emit('dismiss')">Stay here for now</button>
    </div>
  </section>
</template>
<style scoped>
.session-completion { position: relative; isolation: isolate; overflow: hidden; padding: 6px 0; text-align: center; color: #21475f; }
.misu-invitation { position: relative; display: flex; align-items: center; flex-direction: column; gap: 10px; margin: 6px 0 18px; }
.misu-invitation span { font-size: .8rem; color: #49677e; }
h3 { position: relative; margin: 0 0 14px; font-size: clamp(1.35rem, 4vw, 1.75rem); line-height: 1.3; }
p { position: relative; margin: 12px auto; max-width: 440px; font-size: .94rem; line-height: 1.65; }
.fresh-session-note { font-size: .8rem; color: #49677e; }
.completion-actions { position: relative; display: flex; flex-direction: column; gap: 10px; margin: 22px auto 2px; max-width: 340px; }
.completion-actions button { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; border-radius: 12px; padding: 11px 16px; font-size: .9rem; font-weight: 600; cursor: pointer; }
.repeat-action { background: #2d739e; border: 1px solid #2d739e; color: #fff; }
.new-action { background: #fff; border: 1px solid #a5cbe5; color: #285e81; }
.stay-action { background: transparent; border: 0; color: #49677e; font-weight: 400 !important; }
.completion-actions button:disabled { opacity: .55; cursor: default; }
.completion-actions button:focus-visible { outline: 3px solid #2d709b; outline-offset: 3px; }
.completion-error { color: #ad3c20; font-size: .85rem; }
.completion-confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.completion-confetti i { position: absolute; top: -12px; width: 7px; height: 11px; border-radius: 2px; opacity: 0; animation: completion-confetti-fall 2.8s ease-out both; }
.completion-confetti i:nth-child(3n) { width: 6px; height: 6px; border-radius: 50%; }
@keyframes completion-confetti-fall { 0% { transform: translateY(-8px); opacity: 0; } 10% { opacity: .85; } 80% { opacity: .6; } 100% { transform: translate(var(--drift), 420px) rotate(var(--rotation)); opacity: 0; } }
@media (max-width: 480px) { p { font-size: .88rem; } .completion-actions { max-width: none; } }
@media (prefers-reduced-motion: reduce) { .completion-confetti { display: none; } }
</style>
