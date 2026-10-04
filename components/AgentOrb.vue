<script setup lang="ts">
import {
  MODE_DRAWS,
  resolvePreset,
  type OrbState,
} from "~/vendor/thinking-orbs/engine";
const props = withDefaults(
  defineProps<{ state?: OrbState; busy?: boolean }>(),
  { state: "working", busy: false },
);
const canvas = ref<HTMLCanvasElement | null>(null);
let frame = 0,
  observer: IntersectionObserver | undefined,
  media: MediaQueryList | undefined,
  visible = true;
function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
}
function render() {
  stop();
  const el = canvas.value,
    ctx = el?.getContext("2d");
  if (!el || !ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1),
    size = 20;
  el.width = size * dpr;
  el.height = size * dpr;
  const preset = resolvePreset(props.state, 20);
  const paint = (seconds: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    MODE_DRAWS[preset.mode](ctx, size, seconds, false, preset.opts);
  };
  paint(0.6);
  if (
    !props.busy ||
    media?.matches ||
    !visible ||
    document.visibilityState === "hidden"
  )
    return;
  const tick = () => {
    paint((performance.now() / 1000) * preset.speed);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
onMounted(() => {
  media = matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", render);
  document.addEventListener("visibilitychange", render);
  observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting === true;
    render();
  });
  if (canvas.value) observer.observe(canvas.value);
  render();
});
watch(
  () => [props.state, props.busy],
  () => {
    if (import.meta.client) render();
  },
);
onBeforeUnmount(() => {
  stop();
  observer?.disconnect();
  media?.removeEventListener("change", render);
  document.removeEventListener("visibilitychange", render);
});
</script>
<template>
  <canvas ref="canvas" width="20" height="20" aria-hidden="true" />
</template>
<style scoped>
canvas {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
</style>
