<script setup lang="ts">
withDefaults(defineProps<{
  state: 'idle' | 'listening' | 'thinking' | 'speaking'
  active?: boolean
  compact?: boolean
  dark?: boolean
  expression?: 'auto' | 'celebrate' | 'wave'
}>(), {
  active: true,
  compact: false,
  dark: false,
  expression: 'auto'
})
</script>

<template>
  <div
    class="amina-demo-avatar"
    :data-state="state"
    :data-active="active"
    :data-compact="compact"
    :data-dark="dark"
    :data-expression="expression"
  >
    <div class="amina-demo-avatar__presence" aria-hidden="true" />
    <div class="amina-demo-avatar__shadow" aria-hidden="true" />
    <div class="amina-demo-avatar__character">
      <div class="amina-demo-avatar__artwork" role="img" aria-label="Amina, your animated AI practice companion" />
    </div>
    <div
      v-if="state === 'speaking' && active && !compact"
      class="amina-demo-avatar__waveform"
      aria-hidden="true"
    >
      <span v-for="bar in 7" :key="bar" :style="{ '--amina-bar': bar }" />
    </div>
    <div
      v-else-if="state === 'thinking' && active && !compact"
      class="amina-demo-avatar__thoughts"
      aria-hidden="true"
    >
      <span v-for="dot in 3" :key="dot" :style="{ '--amina-dot': dot }" />
    </div>
  </div>
</template>

<style scoped>
.amina-demo-avatar {
  --amina-presence-color: rgb(87 145 168 / 12%);
  --amina-indicator-color: #376d88;
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  isolation: isolate;
  overflow: hidden;
  pointer-events: none;
}

.amina-demo-avatar[data-dark="true"] {
  --amina-presence-color: rgb(151 208 229 / 12%);
  --amina-indicator-color: #c1e5f5;
}

.amina-demo-avatar__presence {
  position: absolute;
  inset: 17% 12% 6%;
  border: 1px solid var(--amina-presence-color);
  border-radius: 50%;
  opacity: .7;
  transform: scale(.97);
  transition: opacity 240ms ease, transform 240ms cubic-bezier(.645, .045, .355, 1);
}

.amina-demo-avatar[data-state="listening"] .amina-demo-avatar__presence {
  opacity: 1;
  transform: scale(1.03);
}

.amina-demo-avatar__shadow {
  position: absolute;
  right: 22%;
  bottom: 1%;
  left: 22%;
  height: 5%;
  border-radius: 50%;
  background: rgb(30 48 58 / 9%);
  filter: blur(8px);
}

.amina-demo-avatar__character {
  position: absolute;
  inset: 3% 5% 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  container-type: size;
  transform-origin: bottom center;
  animation: amina-demo-avatar-breathe 5.6s ease-in-out infinite;
}

.amina-demo-avatar__artwork {
  display: block;
  width: min(100cqw, calc(100cqh * 2 / 3));
  height: min(100cqh, calc(100cqw * 1.5));
  aspect-ratio: 2 / 3;
  background-image: url('/mascots/amina-expression-atlas-v1.png');
  background-repeat: no-repeat;
  background-size: 400% 200%;
  background-position: 0% 0%;
  user-select: none;
}
.amina-demo-avatar[data-state="speaking"][data-active="true"] .amina-demo-avatar__artwork { animation: amina-demo-mouth 780ms steps(1, end) infinite; }
.amina-demo-avatar[data-state="listening"] .amina-demo-avatar__artwork { background-position: 0% 100%; }
.amina-demo-avatar[data-state="thinking"] .amina-demo-avatar__artwork { background-position: 33.333333% 100%; }
.amina-demo-avatar[data-expression="celebrate"] .amina-demo-avatar__artwork { animation: none !important; background-position: 66.666667% 100%; }
.amina-demo-avatar[data-expression="wave"] .amina-demo-avatar__artwork { animation: none !important; background-position: 100% 100%; }
@keyframes amina-demo-mouth {
  0%, 100% { background-position: 0% 0%; }
  20%, 80% { background-position: 33.333333% 0%; }
  40% { background-position: 66.666667% 0%; }
  60% { background-position: 100% 0%; }
}

.amina-demo-avatar[data-state="listening"] .amina-demo-avatar__character {
  animation: amina-demo-avatar-listen 4.8s ease-in-out infinite;
}

.amina-demo-avatar[data-state="thinking"] .amina-demo-avatar__character {
  animation: amina-demo-avatar-think 5s ease-in-out infinite;
}

.amina-demo-avatar[data-state="speaking"] .amina-demo-avatar__character {
  animation: amina-demo-avatar-speak 2.4s ease-in-out infinite;
}

.amina-demo-avatar__waveform,
.amina-demo-avatar__thoughts {
  position: absolute;
  right: 8%;
  bottom: 17%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 58px;
  height: 36px;
  color: var(--amina-indicator-color);
}

.amina-demo-avatar__waveform span {
  width: 3px;
  height: 22px;
  border-radius: 4px;
  background: currentColor;
  transform: scaleY(.3);
  animation: amina-demo-avatar-wave 920ms ease-in-out infinite;
  animation-delay: calc(var(--amina-bar) * -130ms);
}

.amina-demo-avatar__waveform span:nth-child(2n) {
  height: 15px;
  animation-duration: 760ms;
}

.amina-demo-avatar__thoughts span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: amina-demo-avatar-thought 1.4s ease-in-out infinite;
  animation-delay: calc(var(--amina-dot) * 160ms);
}

.amina-demo-avatar[data-compact="true"] .amina-demo-avatar__presence,
.amina-demo-avatar[data-compact="true"] .amina-demo-avatar__shadow {
  display: none;
}

.amina-demo-avatar[data-compact="true"] .amina-demo-avatar__character {
  inset: 1% 2% 0;
}

.amina-demo-avatar[data-active="false"] .amina-demo-avatar__character {
  animation: none;
}
.amina-demo-avatar[data-active="false"] .amina-demo-avatar__artwork { animation: none; }

.amina-demo-avatar[data-active="false"] .amina-demo-avatar__presence {
  opacity: .35;
  transform: none;
}

@keyframes amina-demo-avatar-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-2px) scale(1.008); }
}

@keyframes amina-demo-avatar-listen {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  35% { transform: rotate(-.8deg) translateY(1px); }
  55% { transform: rotate(-.5deg) translateY(-1px); }
  75% { transform: rotate(.3deg) translateY(0); }
}

@keyframes amina-demo-avatar-think {
  0%, 100% { transform: rotate(0deg); }
  40%, 65% { transform: rotate(1deg) translateY(-1px); }
}

@keyframes amina-demo-avatar-speak {
  0%, 100% { transform: rotate(-.35deg) translateY(0) scale(1); }
  30% { transform: rotate(.4deg) translateY(-2px) scale(1.006); }
  65% { transform: rotate(-.2deg) translateY(-1px) scale(1.002); }
}

@keyframes amina-demo-avatar-wave {
  0%, 100% { transform: scaleY(.3); opacity: .55; }
  50% { transform: scaleY(1); opacity: 1; }
}

@keyframes amina-demo-avatar-thought {
  0%, 70%, 100% { transform: translateY(0); opacity: .4; }
  35% { transform: translateY(-3px); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .amina-demo-avatar *,
  .amina-demo-avatar *::before,
  .amina-demo-avatar *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
