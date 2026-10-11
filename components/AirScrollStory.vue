<script setup lang="ts">
const props = defineProps<{ count: number; label: string; itemName: string }>();
const root = ref<HTMLElement>();
const intro = ref<HTMLElement>();
const ready = ref(false);
const introFits = ref(true);
const active = ref(0);
const storyId = useId();
const panelId = (index: number) => storyId + '-chapter-' + (index + 1);
let dispose: (() => void) | undefined;
let disposed = false;

onMounted(async () => {
  // Layout is native document flow. ScrollTrigger only tracks the reading
  // position; it never pins the cards, hides content, or changes scroll distance.
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([
    import("gsap"), import("gsap/ScrollTrigger"),
  ]);
  await document.fonts.ready;
  if (disposed || !root.value || !intro.value) return;
  gsap.registerPlugin(ScrollTrigger);
  const panels = Array.from(root.value.querySelectorAll<HTMLElement>(".air-story-panel"));
  const measureIntro = () => {
    if (!intro.value) return;
    const top = parseFloat(getComputedStyle(intro.value).top) || 0;
    introFits.value = intro.value.offsetHeight + top + 32 <= window.innerHeight;
  };
  const observer = new ResizeObserver(measureIntro);
  observer.observe(intro.value);
  window.addEventListener("resize", measureIntro);
  measureIntro();
  const triggers = panels.map((panel, index) => ScrollTrigger.create({
    trigger: panel,
    start: "top center",
    end: "bottom center",
    onToggle: self => { if (self.isActive) active.value = index; },
  }));
  ready.value = true;
  dispose = () => {
    observer.disconnect();
    window.removeEventListener("resize", measureIntro);
    triggers.forEach(trigger => trigger.kill());
  };
});
onBeforeUnmount(() => { disposed = true; dispose?.(); });

function jumpTo(index: number) {
  const panel = root.value?.querySelectorAll<HTMLElement>(".air-story-panel")[index];
  if (!panel) return;
  // Keyboard and pointer jumps are immediate; ordinary scrolling stays native.
  panel.scrollIntoView({ block: "center", behavior: "instant" });
  active.value = index;
}
</script>

<template>
  <section ref="root" class="air-scroll-story" data-story-mode="flow" :data-story-ready="ready" :data-intro-fits="introFits" :data-active-item="active">
    <div class="air-story-stage">
      <div ref="intro" class="air-story-intro">
        <slot name="intro" />
        <nav class="air-story-controls" :aria-label="label + ' chapters'">
          <a v-for="index in count" :key="index" :href="'#' + panelId(index - 1)" :aria-label="'Go to ' + itemName + ' ' + index" :aria-current="active === index - 1 ? 'step' : undefined" @click.prevent="jumpTo(index - 1)">{{ String(index).padStart(2, '0') }}</a>
        </nav>
      </div>
      <div class="air-story-panels" role="group" :aria-label="label">
        <div v-for="index in count" :id="panelId(index - 1)" :key="index" class="air-story-panel">
          <slot name="item" :index="index - 1" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.air-scroll-story.air-scroll-story { display: block; padding: 0; border: 0; }
.air-story-stage { display: grid; grid-template-columns: minmax(240px,.4fr) minmax(0,1fr); gap: clamp(40px,6vw,80px); align-items: start; padding: clamp(72px,8vw,112px) 0; }
.air-story-intro { min-width: 0; position: sticky; top: clamp(48px,12vh,128px); }
.air-scroll-story[data-intro-fits="false"] .air-story-intro { position: static; }
.air-story-panels { min-width: 0; border: 1px solid #fff; border-radius: 36px; background: rgb(255 255 255 / 76%); box-shadow: 0 20px 64px rgb(2 80 125 / 6%), inset 0 1px 0 #fff; overflow: clip; }
.air-story-panel { display: grid; align-content: center; min-width: 0; min-height: max(560px,80svh); box-sizing: border-box; padding: clamp(28px,4.5vw,64px); border-bottom: 1px solid var(--air-line); scroll-margin-top: 96px; }
.air-story-panel:nth-child(even) { background: rgb(224 242 254 / 34%); }
.air-story-panel:last-child { border-bottom: 0; }
.air-story-controls { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 28px; }
.air-story-controls a { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--air-line); border-radius: 50%; background: rgb(255 255 255 / 65%); color: var(--air-muted); font-size: .75rem; font-weight: 600; font-variant-numeric: tabular-nums; text-decoration: none; }
.air-story-controls a[aria-current="step"] { border-color: var(--air-accent-strong); background: var(--air-accent-soft); color: var(--air-accent-strong); }
.air-story-controls a:focus-visible { outline: 3px solid var(--air-accent-strong); outline-offset: 4px; }
@media (hover: hover) and (pointer: fine) { .air-story-controls a:hover { border-color: var(--air-accent-strong); color: var(--air-accent-strong); } }
@media (max-width: 899px) {
  .air-story-stage { grid-template-columns: minmax(0,1fr); gap: 36px; padding: 56px 0; }
  .air-story-intro { position: static; }
  .air-story-panels { border-radius: 28px; }
  .air-story-panel { min-height: max(440px,72svh); padding: 36px 24px; }
}
@media (max-height: 649px) { .air-story-intro { position: static; } }
</style>
