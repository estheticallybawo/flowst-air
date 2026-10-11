<script setup lang="ts">
const props = defineProps<{ count: number; label: string; itemName: string }>();
const root = ref<HTMLElement>();
const stage = ref<HTMLElement>();
const intro = ref<HTMLElement>();
const viewport = ref<HTMLElement>();
const track = ref<HTMLElement>();
const ready = ref(false);
const pinned = ref(false);
const active = ref(0);
const storyId = useId();
const panelId = (index: number) => storyId + '-chapter-' + (index + 1);
let dispose: (() => void) | undefined;
let moveTo: ((index: number) => void) | undefined;
let disposed = false;

onMounted(async () => {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([
    import("gsap"), import("gsap/ScrollTrigger"),
  ]);
  await document.fonts.ready;
  if (disposed || !root.value || !stage.value || !intro.value || !viewport.value || !track.value) return;
  gsap.registerPlugin(ScrollTrigger);
  const section = root.value, frame = stage.value, rail = intro.value, windowElement = viewport.value, cards = track.value;
  const panels = Array.from(cards.querySelectorAll<HTMLElement>(".air-story-panel"));
  const media = window.matchMedia("(min-width: 900px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)");
  let stopLayout = () => {};
  let layoutFrame = 0, refreshFrame = 0;

  const buildLayout = () => {
    stopLayout();
    moveTo = undefined;
    section.classList.remove("air-story-pinned");
    section.style.removeProperty("--air-story-distance");
    section.style.removeProperty("--air-story-window-height");
    gsap.set(cards, { clearProps: "transform" });
    pinned.value = false;
    active.value = 0;
    const height = window.innerHeight - 96;
    const hold = height * .25;
    const distance = (props.count - 1) * height + hold * 2;
    if (media.matches) {
      section.style.setProperty("--air-story-window-height", height + "px");
      section.style.setProperty("--air-story-distance", distance + "px");
      section.classList.add("air-story-pinned");
      // Never crop text to force the pinned composition onto a smaller screen.
      if (rail.scrollHeight > height || panels.some(panel => panel.scrollHeight > height + 2)) {
        section.classList.remove("air-story-pinned");
        section.style.removeProperty("--air-story-window-height");
        section.style.removeProperty("--air-story-distance");
      } else {
        pinned.value = true;
        const setY = gsap.quickSetter(cards, "y", "px");
        const position = (index: number) => {
          const bounded = Math.max(0, Math.min(props.count - 1, index));
          setY(-bounded * height);
          active.value = Math.round(bounded);
        };
        const trigger = ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: () => "+=" + distance,
          onUpdate: self => position((self.progress * distance - hold) / height),
          onRefresh: self => position((self.progress * distance - hold) / height),
        });
        moveTo = index => {
          window.scrollTo({ top: trigger.start + hold + index * height, behavior: "instant" });
          ScrollTrigger.update();
          position(index);
        };
        stopLayout = () => trigger.kill();
      }
    }
    if (!pinned.value) {
      const triggers = panels.map((panel, index) => ScrollTrigger.create({
        trigger: panel, start: "top center", end: "bottom center",
        onToggle: self => { if (self.isActive) active.value = index; },
      }));
      stopLayout = () => triggers.forEach(trigger => trigger.kill());
    }
    ready.value = true;
    cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(() => {
      if (disposed) return;
      ScrollTrigger.refresh();
      const hash = location.hash.slice(1);
      const index = panels.findIndex(panel => panel.id === hash);
      if (index >= 0) jumpTo(index);
      else if (section.id && hash === section.id) section.scrollIntoView({ block: "start", behavior: "instant" });
    });
  };
  const requestLayout = () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(buildLayout);
  };
  window.addEventListener("resize", requestLayout);
  media.addEventListener("change", requestLayout);
  const onHash = () => {
    const index = panels.findIndex(panel => "#" + panel.id === location.hash);
    if (index >= 0) jumpTo(index);
  };
  window.addEventListener("hashchange", onHash);
  buildLayout();
  dispose = () => {
    cancelAnimationFrame(layoutFrame); cancelAnimationFrame(refreshFrame);
    window.removeEventListener("resize", requestLayout);
    window.removeEventListener("hashchange", onHash);
    media.removeEventListener("change", requestLayout);
    stopLayout(); moveTo = undefined;
    gsap.set(cards, { clearProps: "transform" });
    section.classList.remove("air-story-pinned");
    section.style.removeProperty("--air-story-distance");
    section.style.removeProperty("--air-story-window-height");
  };
});
onBeforeUnmount(() => { disposed = true; dispose?.(); });

function jumpTo(index: number) {
  if (moveTo) moveTo(index);
  else root.value?.querySelectorAll<HTMLElement>(".air-story-panel")[index]?.scrollIntoView({ block: "center", behavior: "instant" });
  active.value = index;
}
</script>

<template>
  <section ref="root" class="air-scroll-story" :data-story-mode="pinned ? 'pinned' : 'flow'" :data-story-ready="ready" :data-active-item="active">
    <div ref="stage" class="air-story-stage">
      <div ref="intro" class="air-story-intro">
        <slot name="intro" />
        <nav class="air-story-controls" :aria-label="label + ' chapters'">
          <a v-for="index in count" :key="index" :href="'#' + panelId(index - 1)" :aria-label="'Go to ' + itemName + ' ' + index" :aria-current="active === index - 1 ? 'step' : undefined" @click.prevent="jumpTo(index - 1)">{{ String(index).padStart(2, '0') }}</a>
        </nav>
      </div>
      <div ref="viewport" class="air-story-window">
        <div ref="track" class="air-story-panels" role="group" :aria-label="label">
          <div v-for="index in count" :id="panelId(index - 1)" :key="index" class="air-story-panel" @focusin="pinned && jumpTo(index - 1)">
            <slot name="item" :index="index - 1" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.air-scroll-story.air-scroll-story { display: block; padding: 0; border: 0; }
.air-story-stage { display: grid; grid-template-columns: minmax(240px,.4fr) minmax(0,1fr); gap: clamp(40px,6vw,80px); align-items: start; padding: clamp(72px,8vw,112px) 0; box-sizing: border-box; }
.air-story-intro { min-width: 0; }
.air-story-window { min-width: 0; border: 1px solid #fff; border-radius: 36px; background: rgb(255 255 255 / 76%); box-shadow: 0 20px 64px rgb(2 80 125 / 6%), inset 0 1px 0 #fff; overflow: clip; box-sizing: border-box; }
.air-story-panels { min-width: 0; }
.air-story-panel { display: grid; align-content: center; min-width: 0; min-height: max(560px,80svh); box-sizing: border-box; padding: clamp(28px,4.5vw,64px); border-bottom: 1px solid var(--air-line); scroll-margin-top: 96px; }
.air-story-panel:nth-child(even) { background: rgb(224 242 254 / 34%); }
.air-story-panel:last-child { border-bottom: 0; }
.air-story-controls { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 28px; }
.air-story-controls a { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--air-line); border-radius: 50%; background: rgb(255 255 255 / 65%); color: var(--air-muted); font-size: .75rem; font-weight: 600; font-variant-numeric: tabular-nums; text-decoration: none; }
.air-story-controls a[aria-current="step"] { border-color: var(--air-accent-strong); background: var(--air-accent-soft); color: var(--air-accent-strong); }
.air-story-controls a:focus-visible { outline: 3px solid var(--air-accent-strong); outline-offset: 4px; }
.air-story-pinned { height: calc(100svh + var(--air-story-distance)); }
.air-story-pinned .air-story-stage { position: sticky; top: 0; height: 100svh; padding: 48px 0; align-items: center; }
.air-story-pinned .air-story-window { height: var(--air-story-window-height); }
.air-story-pinned .air-story-panel { height: var(--air-story-window-height); min-height: 0; padding: clamp(24px,3vw,40px); }
@media (hover: hover) and (pointer: fine) { .air-story-controls a:hover { border-color: var(--air-accent-strong); color: var(--air-accent-strong); } }
@media (max-width: 899px) {
  .air-story-stage { grid-template-columns: minmax(0,1fr); gap: 36px; padding: 56px 0; }
  .air-story-window { border-radius: 28px; }
  .air-story-panel { min-height: max(440px,72svh); padding: 36px 24px; }
}
</style>
