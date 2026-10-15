<script setup lang="ts">
import { ArrowRight, Check, Download, Eye, LockKeyhole, Share2, Waves, X } from "lucide-vue-next";
import {
  airMilestoneDemo,
  buildMilestoneShareSvg,
  DEFAULT_MILESTONE_SAMPLE_TIDES,
  isMilestoneUnlocked,
  MILESTONE_SAMPLE_COUNTS,
  nextMilestoneThreshold,
} from "~/shared/airMilestoneDemo";

const sampleTides = ref<number>(DEFAULT_MILESTONE_SAMPLE_TIDES);
const shareId = ref<string | null>(null);
const shareUrl = ref("");
const shareBusyId = ref<string | null>(null);
const shareError = ref("");
const sharePanel = ref<HTMLElement | null>(null);
const titleId = useId();
const shareTitleId = useId();
const unlockedCount = computed(() => airMilestoneDemo.filter((milestone) => isMilestoneUnlocked(milestone.id, sampleTides.value)).length);
const nextThreshold = computed(() => nextMilestoneThreshold(sampleTides.value));
const selectedMilestone = computed(() => airMilestoneDemo.find((milestone) => milestone.id === shareId.value));
let shareRevision = 0;
let shareTrigger: HTMLElement | null = null;
let assetController: AbortController | null = null;

function clearShare() {
  shareRevision += 1;
  assetController?.abort();
  assetController = null;
  if (shareUrl.value) URL.revokeObjectURL(shareUrl.value);
  shareUrl.value = "";
  shareId.value = null;
  shareBusyId.value = null;
}
function chooseSampleCount(count: number) {
  clearShare();
  shareError.value = "";
  sampleTides.value = count;
}
function closeShare() {
  clearShare();
  shareTrigger?.focus({ preventScroll: true });
}
function pngDataUrl(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Artwork could not be read."));
    reader.onerror = () => reject(new Error("Artwork could not be read."));
    reader.readAsDataURL(new Blob([buffer], { type: "image/png" }));
  });
}
async function previewShare(milestoneId: string, event: MouseEvent) {
  if (!isMilestoneUnlocked(milestoneId, sampleTides.value)) return;
  const milestone = airMilestoneDemo.find((option) => option.id === milestoneId);
  if (!milestone) return;
  clearShare();
  const revision = shareRevision;
  const controller = new AbortController();
  assetController = controller;
  shareTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  shareBusyId.value = milestoneId;
  shareError.value = "";
  try {
    const artworkData = Object.fromEntries(await Promise.all(milestone.artworks.map(async (capability) => {
      if (!capability.artwork.src) throw new Error("Artwork is unavailable.");
      const response = await fetch(capability.artwork.src, { signal: controller.signal });
      if (!response.ok) throw new Error("Artwork is unavailable.");
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("Artwork could not be prepared.");
      return [capability.id, await pngDataUrl(buffer)] as const;
    })));
    if (revision !== shareRevision || !isMilestoneUnlocked(milestoneId, sampleTides.value)) return;
    const svg = buildMilestoneShareSvg(milestoneId, sampleTides.value, artworkData);
    if (!svg) throw new Error("The sample card is unavailable.");
    shareUrl.value = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    shareId.value = milestoneId;
    await nextTick();
    sharePanel.value?.focus({ preventScroll: true });
    sharePanel.value?.scrollIntoView({ block: "nearest", behavior: "instant" });
  } catch {
    if (revision === shareRevision) shareError.value = "The sample share card could not be prepared. Check the artwork has loaded, then try again.";
  } finally {
    if (revision === shareRevision) {
      shareBusyId.value = null;
      assetController = null;
    }
  }
}
onBeforeUnmount(clearShare);
</script>

<template>
  <section class="milestone-unlocks" :aria-labelledby="titleId">
    <header class="milestone-heading">
      <div><p class="milestone-eyebrow"><Waves :size="15" aria-hidden="true" /> A collection of small milestones</p><h2 :id="titleId">Something to keep.<br />Something to share.</h2></div>
      <span class="milestone-concept">Appearance concept</span>
    </header>
    <p class="milestone-intro">A proposed collection of keepsakes at 5, 10, 25, 50, and 100 Tides. Explore the artwork and preview a sample card you can download.</p>

    <div class="milestone-sample-controls">
      <div class="milestone-sample-label"><span>Sample Tide count</span><strong>{{ sampleTides }}</strong></div>
      <div class="milestone-count-options" role="group" aria-label="Choose a sample Tide count">
        <button v-for="count in MILESTONE_SAMPLE_COUNTS" :key="count" type="button" :aria-pressed="sampleTides === count" @click="chooseSampleCount(count)">{{ count }}</button>
      </div>
      <p class="milestone-sample-summary" role="status"><strong>{{ unlockedCount }} of {{ airMilestoneDemo.length }}</strong> unlocked in this sample<span>{{ nextThreshold === null ? 'All sample milestones are visible.' : `Next appearance milestone: ${nextThreshold} Tides.` }}</span></p>
    </div>
    <p class="milestone-demo-note">These controls change this demonstration only. They do not award Tides, update your account, or measure your learning.</p>

    <ol class="milestone-grid" aria-label="Sample Tide milestones">
      <li
        v-for="(milestone, index) in airMilestoneDemo"
        :key="milestone.id"
        class="milestone-card"
        :data-unlocked="isMilestoneUnlocked(milestone.id, sampleTides)"
        :style="{ '--milestone-accent': milestone.artworks[0]?.color || '#426f8b', '--milestone-tint': milestone.artworks[0]?.tint || '#edf5fa' }"
      >
        <div class="milestone-card-top"><span>Phase {{ String(index + 1).padStart(2, '0') }}</span><span class="milestone-lock-status"><Check v-if="isMilestoneUnlocked(milestone.id, sampleTides)" :size="12" aria-hidden="true" /><LockKeyhole v-else :size="12" aria-hidden="true" />{{ isMilestoneUnlocked(milestone.id, sampleTides) ? 'Sample unlocked' : 'Locked' }}</span></div>
        <div class="milestone-artwork" :class="{ 'milestone-artwork-pair': milestone.artworks.length > 1 }" aria-hidden="true">
          <div v-for="capability in milestone.artworks" :key="capability.id" class="milestone-artwork-piece">
            <img v-if="capability.artwork.src" :src="capability.artwork.src" alt="" loading="lazy" decoding="async" />
          </div>
        </div>
        <p class="milestone-threshold"><strong>{{ milestone.threshold }}</strong><span>Tides</span></p>
        <h3>{{ milestone.title }}</h3>
        <p class="milestone-description">{{ milestone.description }}</p>
        <p class="milestone-reward">{{ milestone.reward }}</p>
        <button type="button" class="milestone-preview-button" :disabled="!isMilestoneUnlocked(milestone.id, sampleTides) || shareBusyId !== null" :aria-label="isMilestoneUnlocked(milestone.id, sampleTides) ? `Preview ${milestone.title} sample share card` : `${milestone.title} is locked until ${milestone.threshold} sample Tides`" @click="previewShare(milestone.id, $event)">
          <Eye v-if="isMilestoneUnlocked(milestone.id, sampleTides)" :size="14" aria-hidden="true" /><LockKeyhole v-else :size="13" aria-hidden="true" />{{ shareBusyId === milestone.id ? 'Preparing card…' : isMilestoneUnlocked(milestone.id, sampleTides) ? 'Preview share card' : `${milestone.threshold} Tides to unlock` }}
        </button>
      </li>
    </ol>

    <p v-if="shareError" class="milestone-share-error" role="alert">{{ shareError }}</p>
    <section v-if="shareUrl && selectedMilestone" ref="sharePanel" class="milestone-share-panel" tabindex="-1" :aria-labelledby="shareTitleId">
      <header class="milestone-share-heading"><div><p class="milestone-eyebrow"><Share2 :size="14" aria-hidden="true" /> Sample share card</p><h3 :id="shareTitleId">{{ selectedMilestone.title }}</h3></div><button type="button" class="milestone-close" aria-label="Close sample share card" @click="closeShare"><X :size="17" aria-hidden="true" /></button></header>
      <img class="milestone-share-image" :src="shareUrl" :alt="`Sample appearance concept card for the ${selectedMilestone.threshold}-Tide ${selectedMilestone.title} milestone. This is not an earned achievement.`" />
      <div class="milestone-share-actions"><p>Watermarked sample · no name, account details, or learning claims. The download matches this preview.</p><a :href="shareUrl" :download="`flowst-airs-${selectedMilestone.id}-sample.svg`"><Download :size="16" aria-hidden="true" />Download SVG <ArrowRight :size="14" aria-hidden="true" /></a></div>
    </section>
    <p class="milestone-footer-note">The seven artworks come from Airs’ existing capability collection. These proposed milestones celebrate a collection; they do not unlock teaching abilities or imply mastery.</p>
  </section>
</template>

<style scoped>
.milestone-unlocks {
  padding: 24px;
  border: 1px solid #d3e2ed;
  border-radius: 16px;
  color: #17364d;
  background: #fff;
  font-family: "Albert Sans", system-ui, sans-serif;
}
.milestone-unlocks :is(h2, h3) {
  font-family: "Unbounded", system-ui, sans-serif;
}
.milestone-heading,
.milestone-share-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.milestone-eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 10px;
  color: #4c7189;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
}
.milestone-heading h2 {
  margin: 0;
  font-size: clamp(20px, 2.4vw, 28px);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.4;
}
.milestone-concept {
  flex-shrink: 0;
  padding: 7px 10px;
  border: 1px solid #ccdeea;
  border-radius: 7px;
  color: #365d79;
  background: #edf6fc;
  font-size: 10px;
  font-weight: 600;
}
.milestone-intro {
  max-width: 660px;
  margin: 14px 0 21px;
  color: #536d80;
  font-size: 13px;
  line-height: 1.7;
}
.milestone-sample-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px 24px;
  padding: 16px 18px;
  border: 1px solid #d3e2ed;
  border-radius: 12px;
  background: #f4f9fd;
}
.milestone-sample-label {
  display: flex;
  align-items: center;
  gap: 13px;
  color: #4c6d84;
  font-size: 12px;
}
.milestone-sample-label strong {
  color: #234b67;
  font-size: 25px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.milestone-count-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.milestone-count-options button {
  min-width: 36px;
  min-height: 36px;
  padding: 7px 9px;
  border: 1px solid #d0deea;
  border-bottom-width: 3px;
  border-radius: 7px;
  color: #385c78;
  background: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.milestone-count-options button[aria-pressed="true"] {
  border-color: #23506d;
  color: #fff;
  background: #315e7d;
}
.milestone-sample-summary {
  display: grid;
  gap: 4px;
  margin: 0 0 0 auto;
  color: #45677e;
  font-size: 11px;
  line-height: 1.5;
}
.milestone-sample-summary strong {
  font-weight: 700;
}
.milestone-sample-summary > span {
  color: #5b7486;
  font-size: 10px;
}
.milestone-demo-note,
.milestone-footer-note {
  color: #61798b;
  font-size: 11px;
  line-height: 1.65;
}
.milestone-demo-note {
  margin: 10px 0 22px;
}
.milestone-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(174px, 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.milestone-card {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 16px 13px 14px;
  border: 1px solid #cedee9;
  border-bottom: 4px solid #c4d6e3;
  border-radius: 15px;
  background: linear-gradient(160deg, #fff 45%, #f0f7fc);
  box-shadow: 0 5px 0 #e6eff6, 0 13px 19px #244f6c0d, inset 0 1px 0 #fff;
  text-align: center;
  backdrop-filter: blur(12px);
}
.milestone-card[data-unlocked="true"] {
  border-color: color-mix(in srgb, var(--milestone-accent) 38%, #d7e4ed);
  border-bottom-color: color-mix(in srgb, var(--milestone-accent) 45%, #bdcfdf);
}
.milestone-card-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  color: #668093;
  font-size: 9px;
  font-weight: 600;
}
.milestone-lock-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 5px;
  border-radius: 5px;
  color: #536b7c;
  background: #eaf0f5;
  font-size: 9px;
}
.milestone-card[data-unlocked="true"] .milestone-lock-status {
  color: #295c4e;
  background: #e3f2eb;
}
.milestone-artwork {
  display: grid;
  height: 124px;
  place-items: center;
  margin: 15px 0 11px;
  border: 1px solid #fff;
  border-radius: 12px;
  background: linear-gradient(150deg, #fff, var(--milestone-tint));
  box-shadow: inset 0 1px 9px #35536b07;
}
.milestone-artwork-piece {
  width: 110px;
  height: 110px;
}
.milestone-artwork-piece img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.milestone-card[data-unlocked="false"] .milestone-artwork-piece {
  filter: saturate(0.55);
}
.milestone-artwork-pair {
  display: flex;
  justify-content: center;
  gap: 0;
}
.milestone-artwork-pair .milestone-artwork-piece {
  width: 83px;
  height: 100px;
}
.milestone-artwork-pair .milestone-artwork-piece + .milestone-artwork-piece {
  margin-left: -14px;
  transform: translateY(9px);
}
.milestone-threshold {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 7px;
  margin: 3px 0 14px;
  color: #476a83;
  font-size: 11px;
}
.milestone-threshold strong {
  color: #214e6b;
  font-family: "Unbounded", system-ui, sans-serif;
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.055em;
}
.milestone-card h3 {
  display: grid;
  min-height: 2.9em;
  align-items: center;
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.45;
}
.milestone-description {
  margin: 0 0 14px;
  color: #567085;
  font-size: 11px;
  line-height: 1.65;
}
.milestone-reward {
  margin: auto 0 16px;
  padding-top: 11px;
  border-top: 1px solid #dde8ef;
  color: #43647b;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.6;
}
.milestone-preview-button {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 5px;
  border: 1px solid #a8c4d6;
  border-bottom-width: 3px;
  border-radius: 8px;
  color: #295774;
  background: #edf6fc;
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.5;
  cursor: pointer;
  transition: background-color 150ms, transform 150ms;
}
.milestone-preview-button:not(:disabled):hover {
  background: #dfedf7;
  transform: translateY(-1px);
}
.milestone-unlocks .milestone-preview-button:disabled {
  border-color: #d5e0e8;
  color: #5f7586;
  background: #f0f4f7;
  opacity: 1;
  cursor: not-allowed;
}
.milestone-share-panel {
  margin-top: 25px;
  padding: 22px;
  border: 1px solid #bdd7e9;
  border-radius: 15px;
  background: #f3f9fe;
}
.milestone-share-heading {
  margin-bottom: 17px;
}
.milestone-share-heading h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.5;
}
.milestone-close {
  display: grid;
  width: 36px;
  min-height: 36px;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid #c7dcea;
  border-radius: 8px;
  color: #456f8a;
  background: #fff;
  cursor: pointer;
}
.milestone-share-image {
  display: block;
  width: min(100%, 720px);
  height: auto;
  margin: 0 auto;
  border: 1px solid #cadce9;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 9px 22px #1d486014;
}
.milestone-share-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-top: 17px;
}
.milestone-share-actions p {
  max-width: 360px;
  margin: 0;
  color: #5a7488;
  font-size: 11px;
  line-height: 1.65;
}
.milestone-share-actions a {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 13px;
  border: 1px solid #244c6b;
  border-bottom-width: 3px;
  border-radius: 8px;
  color: #fff;
  background: #315e7d;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}
.milestone-footer-note {
  margin: 22px 0 0;
}
.milestone-share-error {
  margin: 19px 0 0;
  padding: 12px 14px;
  border: 1px solid #e4cbbf;
  border-radius: 9px;
  color: #8b4c35;
  background: #fff7f0;
  font-size: 12px;
  line-height: 1.6;
}
.milestone-unlocks :is(button, a, [tabindex]):focus-visible {
  outline: 3px solid #2386bf;
  outline-offset: 4px;
}
@media (max-width: 700px) {
  .milestone-unlocks {
    padding: 18px;
  }
  .milestone-heading {
    flex-wrap: wrap;
    gap: 12px;
  }
  .milestone-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 13px 10px;
  }
  .milestone-sample-controls {
    gap: 14px;
    padding: 14px;
  }
  .milestone-sample-summary {
    width: 100%;
    margin-left: 0;
  }
  .milestone-share-panel {
    padding: 16px;
  }
  .milestone-share-actions a {
    width: 100%;
  }
}
@media (max-width: 380px) {
  .milestone-grid {
    grid-template-columns: 1fr;
  }
  .milestone-card {
    padding: 17px;
  }
  .milestone-card h3 {
    min-height: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .milestone-preview-button {
    transition: none;
  }
  .milestone-preview-button:not(:disabled):hover {
    transform: none;
  }
}
</style>
