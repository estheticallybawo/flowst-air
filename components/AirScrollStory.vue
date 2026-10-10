<script setup lang="ts">
import { ArrowLeft, ArrowRight } from "lucide-vue-next";

const props = defineProps<{ count: number; label: string; itemName: string }>();
const root = ref<HTMLElement>();
const stage = ref<HTMLElement>();
const enhanced = ref(false);
const active = ref(0);
let dispose: (() => void) | undefined;
let moveTo: ((index: number, animate: boolean) => void) | undefined;
let disposed = false;

onMounted(async () => {
  // Readable server-rendered content remains the fallback if motion cannot fit.
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([
    import("gsap"), import("gsap/ScrollTrigger"),
  ]);
  if (disposed || !root.value || !stage.value) return;
  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();
  await document.fonts.ready;
  if (disposed) return;
  media.add("(prefers-reduced-motion: no-preference) and (min-height: 650px)", () => {
    const section = root.value!, frame = stage.value!;
    const panels = Array.from(frame.querySelectorAll<HTMLElement>(".air-story-panel"));
    section.style.setProperty("--air-story-distance", props.count * window.innerHeight * .9 + "px");
    section.classList.add("air-story-sequential");
    if (frame.scrollHeight > window.innerHeight + 2) {
      section.classList.remove("air-story-sequential");
      section.style.removeProperty("--air-story-distance");
      return;
    }
    enhanced.value = true;
    active.value = 0;
    gsap.set(panels, { autoAlpha: 0 });
    gsap.set(panels[0]!, { autoAlpha: 1 });
    const show = (index: number, animate = true) => {
      if (index === active.value) return;
      active.value = index;
      gsap.killTweensOf(panels);
      gsap.set(panels, { autoAlpha: 0, y: 0, scale: 1 });
      if (animate) gsap.fromTo(panels[index]!, { autoAlpha: 0, y: 18, scale: .985 }, { autoAlpha: 1, y: 0, scale: 1, duration: .24, ease: "power3.out" });
      else gsap.set(panels[index]!, { autoAlpha: 1 });
    };
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => "+=" + (section.offsetHeight - frame.offsetHeight),
      onRefreshInit: () => section.style.setProperty("--air-story-distance", props.count * window.innerHeight * .9 + "px"),
      invalidateOnRefresh: true,
      onUpdate: self => show(Math.min(props.count - 1, Math.floor(self.progress * props.count))),
    });
    requestAnimationFrame(() => {
      if (disposed) return;
      ScrollTrigger.refresh();
      if (section.id && location.hash === "#" + section.id) section.scrollIntoView({ behavior: "instant", block: "start" });
    });
    moveTo = (index, animate) => {
      show(index, animate);
      const progress = index === 0 ? 0 : (index + .25) / props.count;
      // Native scrolling; buttons also make every panel reachable by keyboard.
      window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * progress, behavior: "instant" });
      ScrollTrigger.update();
    };
    return () => {
      moveTo = undefined;
      trigger.kill();
      gsap.killTweensOf(panels);
      gsap.set(panels, { clearProps: "opacity,visibility,transform" });
      section.classList.remove("air-story-sequential");
      section.style.removeProperty("--air-story-distance");
      enhanced.value = false;
      active.value = 0;
    };
  }, root.value);
  dispose = () => media.revert();
});
onBeforeUnmount(() => { disposed = true; dispose?.(); });
function step(direction: number, event: MouseEvent) {
  moveTo?.(Math.max(0, Math.min(props.count - 1, active.value + direction)), event.detail !== 0);
}
</script>

<template>
  <section ref="root" class="air-scroll-story" :data-story-mode="enhanced ? 'sequential' : 'static'" :data-active-item="active">
    <div ref="stage" class="air-story-stage">
      <div class="air-story-intro"><slot name="intro" /></div>
      <div class="air-story-content">
        <div class="air-story-panels" role="group" :aria-label="label">
          <div v-for="index in count" :key="index" class="air-story-panel" :aria-hidden="enhanced && active !== index - 1 ? true : undefined" :inert="enhanced && active !== index - 1">
            <slot name="item" :index="index - 1" />
          </div>
        </div>
        <div class="air-story-controls" role="group" :aria-label="label + ' controls'">
          <button type="button" :disabled="active === 0" :aria-label="'Previous ' + itemName" @click="step(-1, $event)"><ArrowLeft :size="18" aria-hidden="true" /></button>
          <span aria-live="polite" aria-atomic="true">{{ active + 1 }} <span class="air-story-counter-divider">/</span> {{ count }}</span>
          <button type="button" :disabled="active === count - 1" :aria-label="'Next ' + itemName" @click="step(1, $event)"><ArrowRight :size="18" aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.air-scroll-story.air-scroll-story { display: block; padding: 0; border: 0; }
.air-story-stage { display: grid; grid-template-columns: .9fr 1.1fr; gap: clamp(32px,6vw,88px); align-items: start; min-height: 100svh; padding: 88px 0; box-sizing: border-box; }
.air-story-intro, .air-story-content { min-width: 0; }
.air-story-panels { display: grid; gap: 96px; }
.air-story-controls { display: none; align-items: center; justify-content: center; gap: 24px; margin-top: 28px; color: var(--air-muted); font-variant-numeric: tabular-nums; font-size: .85rem; }
.air-story-controls button { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 1px solid var(--air-line); border-radius: 50%; background: #fff; color: var(--air-ink); cursor: pointer; }
.air-story-controls button:disabled { opacity: .35; cursor: default; }
.air-story-controls button:focus-visible { outline: 3px solid var(--air-accent-strong); outline-offset: 4px; }
.air-story-counter-divider { padding: 0 8px; }
.air-story-sequential { height: calc(100svh + var(--air-story-distance)); }
.air-story-sequential .air-story-stage { position: sticky; top: 0; height: 100svh; min-height: 0; padding: 64px 0; align-items: center; }
.air-story-sequential .air-story-panels { gap: 0; }
.air-story-sequential .air-story-panel { grid-area: 1 / 1; align-self: center; min-width: 0; }
.air-story-sequential .air-story-controls { display: flex; }
@media (max-width: 767px) {
  .air-story-stage { grid-template-columns: minmax(0,1fr); gap: 28px; padding: 56px 0; }
  .air-story-sequential .air-story-stage { align-content: center; padding: 28px 0; gap: 24px; }
  .air-story-controls { margin-top: 18px; }
  .air-story-panels { gap: 64px; }
}
@media (prefers-reduced-motion: reduce) { .air-story-panels { gap: 48px; } }
</style>
