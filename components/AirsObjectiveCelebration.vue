<script setup lang="ts">
import { ArrowRight, Coffee, Check } from 'lucide-vue-next';

withDefaults(defineProps<{
  /** Render only for a newly confirmed, server-owned objective checkpoint. */
  objectiveTitle: string;
  completed: number;
  total: number;
  breakMinutes?: 3 | 5;
  canBreak?: boolean;
  continueLabel?: string;
}>(), { breakMinutes: 3, canBreak: true, continueLabel: 'Continue' });
defineEmits<{ continue: []; break: [] }>();

const surface = ref<HTMLElement>();
const paused = ref(false);
let observer: IntersectionObserver | undefined;
let onscreen = true;
function visibilityChanged() { paused.value = document.hidden || !onscreen; }
onMounted(() => {
  visibilityChanged();
  document.addEventListener('visibilitychange', visibilityChanged);
  observer = new IntersectionObserver(entries => {
    onscreen = Boolean(entries[0]?.isIntersecting);
    visibilityChanged();
  });
  if (surface.value) observer.observe(surface.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener('visibilitychange', visibilityChanged);
});

// Fixed positions avoid hydration differences. One short burst; no timers or animation loop.
const particles = Array.from({ length: 42 }, (_, i) => ({
  left: `${(i * 37 + 7) % 100}%`,
  delay: `${(i % 7) * 0.07}s`,
  duration: `${2.4 + (i % 6) * 0.18}s`,
  drift: `${((i * 23) % 140) - 70}px`,
  rotation: `${((i * 47) % 660) - 330}deg`,
  color: ['#78b8e0', '#a9d8f4', '#397dab', '#d9edfb'][i % 4],
}));
</script>

<template>
  <section ref="surface" class="objective-celebration" :class="{ paused }" aria-labelledby="objective-celebration-title">
    <div class="confetti" aria-hidden="true">
      <i v-for="(particle, i) in particles" :key="i" :style="{
        left: particle.left, animationDelay: particle.delay, animationDuration: particle.duration,
        '--drift': particle.drift, '--rotation': particle.rotation, backgroundColor: particle.color,
      }" />
    </div>
    <div class="celebration-agents" aria-label="Your learning team">
      <div><AgentAvatar agent="MISU" size="large" /><strong>Misu</strong><span>Keep going, one objective at a time.</span></div>
      <div><AgentAvatar agent="AMIRA" size="large" /><strong>Amina</strong><span>Congratulations on finishing this practice.</span></div>
      <div><AgentAvatar agent="KAI" size="large" /><strong>Kai</strong><span>Notice what you’d like to try next.</span></div>
    </div>
    <div class="celebration-content">
      <span class="checkpoint-saved"><Check :size="15" /> Practice checkpoint saved</span>
      <h2 id="objective-celebration-title">You finished this objective</h2>
      <p class="objective-title">{{ objectiveTitle }}</p>
      <p class="celebration-progress">{{ completed }} of {{ total }} checkpoints completed</p>
      <p class="celebration-choice">Take a breather, or continue when you’re ready.</p>
      <div class="celebration-actions">
        <button v-if="canBreak" type="button" class="break-action" @click="$emit('break')"><Coffee :size="17" /> Take a break</button>
        <button type="button" class="continue-action" @click="$emit('continue')">{{ continueLabel }} <ArrowRight :size="17" /></button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.objective-celebration { position: relative; isolation: isolate; overflow: hidden; padding: 28px 22px 24px; border: 1px solid #c8e0f0; border-radius: 24px; background: #f1f9ff; color: #21475f; }
.celebration-agents { display: flex; justify-content: center; gap: 24px; position: relative; }
.celebration-agents > div { display: flex; flex-direction: column; align-items: center; gap: 7px; flex: 1; max-width: 150px; text-align: center; }
.celebration-agents strong { font-size: .85rem; }
.celebration-agents span { font-size: .72rem; line-height: 1.5; color: #527084; }
.celebration-content { position: relative; max-width: 540px; margin: 24px auto 0; text-align: center; }
.checkpoint-saved { display: inline-flex; align-items: center; gap: 6px; color: #2f709a; font-size: .75rem; }
.celebration-content h2 { font-size: clamp(1.3rem, 3vw, 1.75rem); line-height: 1.3; margin: 12px 0; }
.objective-title { font-weight: 600; line-height: 1.55; overflow-wrap: anywhere; }
.celebration-progress { margin-top: 12px; font-size: .8rem; color: #527084; font-variant-numeric: tabular-nums; }
.celebration-choice { margin: 18px 0; font-size: .88rem; }
.celebration-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.celebration-actions button { display: inline-flex; justify-content: center; align-items: center; gap: 8px; min-height: 48px; padding: 10px 17px; border-radius: 12px; font-size: .85rem; font-weight: 600; transition: transform 120ms ease, background-color 160ms ease; cursor: pointer; }
.break-action { background: #fff; border: 1px solid #b2d2e8; color: #285e81; }
.continue-action { background: #337faa; border: 1px solid #337faa; color: #fff; }
.celebration-actions button:active { transform: scale(.98); }
.celebration-actions button:focus-visible { outline: 3px solid #2d709b; outline-offset: 3px; }
.confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.confetti i { position: absolute; top: -12px; width: 7px; height: 12px; opacity: 0; border-radius: 2px; animation: confetti-fall 3s cubic-bezier(.2,.55,.6,1) both; }
.confetti i:nth-child(3n) { width: 6px; height: 6px; border-radius: 50%; }
.paused .confetti i { animation-play-state: paused; }
@keyframes confetti-fall {
  0% { transform: translate3d(0, -8px, 0) rotate(0); opacity: 0; }
  8% { opacity: .8; }
  75% { opacity: .65; }
  100% { transform: translate3d(var(--drift), 420px, 0) rotate(var(--rotation)); opacity: 0; }
}
@media (max-width: 480px) {
  .objective-celebration { padding: 20px 14px; }
  .celebration-agents { gap: 10px; }
  .celebration-agents span { font-size: .66rem; }
  .celebration-content { margin-top: 18px; }
  .celebration-actions { flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) {
  .confetti i { animation: none; opacity: .5; top: 14px; transform: rotate(var(--rotation)); }
  .celebration-actions button { transition: none; }
  .celebration-actions button:active { transform: none; }
}
</style>
