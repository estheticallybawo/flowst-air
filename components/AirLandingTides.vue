<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";
import { growthCapabilities } from "~/shared/airGrowthCapabilities";
defineProps<{ authenticated: boolean }>();
const tides = [
  ...growthCapabilities.filter(capability => capability.id === "clear_explanation"),
  ...growthCapabilities.filter(capability => capability.id !== "clear_explanation"),
];
</script>

<template>
  <AirScrollStory id="growth" class="landing-growth" aria-labelledby="landing-growth-title" :count="tides.length" label="Seven Tides to earn through growth" item-name="Tide">
    <template #intro>
      <div class="landing-growth-intro"><p class="air-eyebrow">Your Growth Path</p><h2 id="landing-growth-title">You earn <em>Tides</em><br /> as you progress.</h2><p>Follow your progress across seven capabilities. Complete a growth cycle to earn a Tide, then keep building with fresh evidence and new contexts.</p><NuxtLink class="air-button" :to="authenticated ? '/airs' : '/auth/sign-in?redirect=/airs'">Explore your growth <ArrowRight :size="17" :stroke-width="1.5" aria-hidden="true" /></NuxtLink></div>
    </template>
    <template #item="{ index }">
      <figure class="landing-tide-card" :aria-label="tides[index]!.title + ' Tide'">
        <div class="landing-tide-art" :style="{ backgroundColor: tides[index]!.tint }"><img :src="tides[index]!.artwork.src" :style="{ transform: 'scale(' + (tides[index]!.artwork.scale || 1) + ')' }" alt="" width="280" height="280" loading="lazy" decoding="async" /></div>
        <figcaption><span>Tide</span><h3>{{ tides[index]!.title }}</h3><p>{{ tides[index]!.meaning }}</p></figcaption>
      </figure>
    </template>
  </AirScrollStory>
</template>

<style scoped>
.landing-growth h2 { font-size: clamp(1.7rem,2.8vw,2.4rem); line-height: 1.3; margin: 14px 0 22px; text-wrap: balance; }
.landing-growth h2 em { font-style: normal; color: var(--air-accent-strong); }
.landing-growth-intro > p:not(.air-eyebrow) { margin: 0 0 24px; max-width: 42ch; color: var(--air-muted); line-height: 1.75; }
.landing-growth .air-button { gap: 12px; }
.landing-tide-card { margin: 0; min-width: 0; }
.landing-tide-art { display: grid; place-items: center; height: 320px; border-radius: 32px; overflow: hidden; box-shadow: inset 0 1px 0 rgb(255 255 255 / 90%); }
.landing-tide-art img { display: block; width: 240px; height: 240px; object-fit: contain; }
.landing-tide-card figcaption { padding: 24px 12px 0; }
.landing-tide-card figcaption > span { display: block; font-size: .7rem; letter-spacing: .1em; text-transform: uppercase; color: var(--air-muted); font-weight: 700; }
.landing-tide-card h3 { margin: 10px 0; color: var(--air-ink); font-size: 1.35rem; line-height: 1.5; }
.landing-tide-card figcaption p { margin: 0; max-width: 45ch; color: var(--air-muted); font-size: .94rem; line-height: 1.65; }
@media (max-width: 767px) {
  .landing-growth h2 { margin: 12px 0 16px; }
  .landing-growth-intro > p:not(.air-eyebrow) { font-size: .94rem; line-height: 1.65; margin-bottom: 18px; }
  .landing-tide-art { height: 180px; border-radius: 24px; }
  .landing-tide-art img { width: 160px; height: 160px; }
  .landing-tide-card figcaption { padding: 16px 4px 0; }
  .landing-tide-card h3 { margin: 8px 0; font-size: 1.1rem; }
  .landing-tide-card figcaption p { font-size: .88rem; }
}
</style>
