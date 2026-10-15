<script setup lang="ts">
import { Check, ChevronDown, Circle, Coffee, Flower2, LockKeyhole, Moon, Play, Sun, Waves } from "lucide-vue-next";
import CompanionMotionAvatar from "~/components/demo/CompanionMotionAvatar.vue";
import {
  companionMotionAgents,
  companionMotionCatalog,
  COMPANION_MOTION_SAMPLE_COUNTS,
  getCompanionMotion,
  getCompanionMotionAgent,
  isCompanionMotionUnlocked,
  normalizeCompanionSampleTides,
  reconcileCompanionMotion,
  type CompanionMotionAgentId,
  type CompanionMotionStateId,
} from "~/shared/companionMotion";

type LegacyExpressionState = "idle" | "listening" | "thinking" | "speaking";
const props = defineProps<{ currentTides?: number }>();
const emit = defineEmits<{
  "background-change": [background: string];
  "expression-change": [expression: LegacyExpressionState];
  "motion-change": [state: CompanionMotionStateId];
  "agent-change": [agent: CompanionMotionAgentId];
}>();
const sampleTides = ref(0);
const selectedAgentId = ref<CompanionMotionAgentId>("AMIRA");
const selectedMotionId = ref<CompanionMotionStateId>("idle");
const selectedBackground = ref("neutral");
const previewMotion = ref(true);
const selectedAgent = computed(() => getCompanionMotionAgent(selectedAgentId.value));
const selectedMotion = computed(() => getCompanionMotion(selectedMotionId.value));
const backgrounds = [
  { id: "neutral", label: "Neutral stage", threshold: 0, icon: Circle, image: "" },
  { id: "studio", label: "Workspace", threshold: 0, icon: Sun, image: "/environments/amina-workspace-v1.webp" },
  { id: "cafe", label: "Café", threshold: 1, icon: Coffee, image: "/environments/amina-cafe-v1.webp" },
  { id: "garden", label: "Garden", threshold: 3, icon: Flower2, image: "/environments/amina-garden-v1.webp" },
  { id: "night", label: "Night", threshold: 5, icon: Moon, image: "/environments/amina-workspace-v1.webp" },
];
const activeBackground = computed(() => backgrounds.find((background) => background.id === selectedBackground.value) || backgrounds[0]!);
const earnedTides = computed(() =>
  typeof props.currentTides === "number" && Number.isFinite(props.currentTides)
    ? Math.max(0, Math.floor(props.currentTides))
    : null,
);
function emitMotion(state: CompanionMotionStateId) {
  emit("motion-change", state);
  emit("expression-change", state === "listening" || state === "thinking" ? state : state === "idle" ? "idle" : "speaking");
}
function chooseCount(count: number) {
  sampleTides.value = normalizeCompanionSampleTides(count);
  const nextMotion = reconcileCompanionMotion(selectedMotionId.value, sampleTides.value);
  if (nextMotion !== selectedMotionId.value) {
    selectedMotionId.value = nextMotion;
    emitMotion(nextMotion);
  }
  if (activeBackground.value.threshold > sampleTides.value) chooseBackground("neutral");
}
function chooseAgent(agentId: CompanionMotionAgentId) {
  selectedAgentId.value = agentId;
  emit("agent-change", agentId);
  emitMotion(selectedMotionId.value);
}
function chooseMotion(state: CompanionMotionStateId) {
  if (!isCompanionMotionUnlocked(state, sampleTides.value)) return;
  selectedMotionId.value = state;
  emitMotion(state);
}
function chooseBackground(backgroundId: string) {
  const option = backgrounds.find((background) => background.id === backgroundId);
  if (!option || option.threshold > sampleTides.value) return;
  selectedBackground.value = option.id;
  emit("background-change", option.id);
}
</script>

<template>
  <section class="tide-unlocks companion-motion-library" aria-labelledby="tide-unlocks-title">
    <header class="tide-unlocks-heading">
      <div><p class="tide-unlocks-eyebrow">A little more character</p><h2 id="tide-unlocks-title">Expressive faces. Familiar companions.</h2></div>
      <span class="cosmetic-concept-label">Animated appearance samples</span>
    </header>
    <p class="tide-unlocks-intro">Unlock expressive avatar faces, not new teaching abilities. Explore illustrated facial expressions for Amina, Misu, and Kai.</p>

    <div class="cosmetic-agent-picker" role="group" aria-label="Choose a companion for the motion preview">
      <button v-for="agent in companionMotionAgents" :key="agent.id" type="button" :aria-pressed="selectedAgentId === agent.id" @click="chooseAgent(agent.id)">
        <AgentPortrait class="cosmetic-agent-thumbnail" :agent="agent.id" avatar fit="cover" alt="" /><span>{{ agent.name }}</span><Check v-if="selectedAgentId === agent.id" :size="13" aria-hidden="true" />
      </button>
    </div>

    <div class="sample-tide-control">
      <div class="sample-tide-label"><Waves :size="19" aria-hidden="true" /><span>Sample Tides</span><strong aria-live="polite">{{ sampleTides }}</strong></div>
      <div class="sample-tide-counts" role="group" aria-label="Choose a sample Tide count">
        <button v-for="count in COMPANION_MOTION_SAMPLE_COUNTS" :key="count" type="button" :aria-pressed="sampleTides === count" @click="chooseCount(count)">{{ count }}</button>
      </div>
    </div>
    <p class="sample-tide-note">Demo counts only. They do not award Tides or change saved progress.<template v-if="earnedTides !== null"> Your earned Tides: {{ earnedTides }}.</template></p>

    <div class="motion-library-layout">
      <div class="motion-stage-column">
        <div class="cosmetic-preview-scene" :data-background="selectedBackground" :data-agent="selectedAgentId" :data-state="selectedMotionId" :aria-label="`${selectedAgent.name} ${selectedMotion.label.toLowerCase()} animation preview`">
          <img v-if="activeBackground.image" class="cosmetic-preview-environment" :src="activeBackground.image" :alt="`${activeBackground.label} environment illustration`" />
          <div v-if="activeBackground.image" class="cosmetic-preview-shade" aria-hidden="true" />
          <div class="motion-stage-platform" aria-hidden="true" />
          <div class="cosmetic-preview-agent"><CompanionMotionAvatar :agent="selectedAgentId" :state="selectedMotionId" :active="previewMotion" /></div>
          <span class="cosmetic-preview-room-label"><component :is="activeBackground.icon" :size="13" aria-hidden="true" />{{ activeBackground.label }}</span>
          <span class="cosmetic-preview-caption">{{ selectedAgent.name }} · {{ selectedMotion.label }} sample</span>
        </div>
        <div class="cosmetic-agent-preview">
          <div><strong>{{ selectedMotion.label }}</strong><p>{{ selectedMotion.description }}</p></div>
          <label class="cosmetic-motion-control"><input v-model="previewMotion" type="checkbox" />Animate {{ selectedAgent.name }}</label>
        </div>
        <p class="motion-preview-note">Illustrated animation sample · respects reduced motion. This preview does not listen or start a live call.</p>
      </div>

      <div class="motion-library-choices">
        <div class="motion-library-heading"><h3>Choose a little expression</h3><span>6 animation samples</span></div>
        <div class="companion-motion-options" role="group" aria-label="Choose an illustrated motion">
          <button
            v-for="motion in companionMotionCatalog"
            :key="motion.id"
            type="button"
            class="companion-motion-option"
            :data-state="motion.id"
            :disabled="!isCompanionMotionUnlocked(motion.id, sampleTides)"
            :aria-pressed="selectedMotionId === motion.id"
            :aria-label="`${motion.label}, ${isCompanionMotionUnlocked(motion.id, sampleTides) ? 'available for preview' : `locked, needs ${motion.threshold} sample Tides`}`"
            @click="chooseMotion(motion.id)"
          >
            <span class="motion-thumbnail" aria-hidden="true"><CompanionMotionAvatar :agent="selectedAgentId" :state="motion.id" :active="false" thumbnail /><span class="motion-thumbnail-status"><LockKeyhole v-if="!isCompanionMotionUnlocked(motion.id, sampleTides)" :size="12" /><Check v-else-if="selectedMotionId === motion.id" :size="13" /><Play v-else :size="12" /></span></span>
            <strong>{{ motion.label }}</strong>
            <small>{{ motion.threshold === 0 ? 'Included' : `${motion.threshold} sample ${motion.threshold === 1 ? 'Tide' : 'Tides'}` }}</small>
            <span class="motion-option-status">{{ !isCompanionMotionUnlocked(motion.id, sampleTides) ? 'Locked' : selectedMotionId === motion.id ? 'Selected' : 'Try animation' }}</span>
          </button>
        </div>
        <p class="cosmetic-limit-note">These unlocks are optional animated looks. Live listening, thinking, and learning remain available without cosmetic unlocks.</p>
      </div>
    </div>

    <details class="optional-room-settings">
      <summary>Optional room settings <ChevronDown :size="16" aria-hidden="true" /></summary>
      <p>Keep the neutral stage, or try an illustrated room behind your companion.</p>
      <div class="background-options" role="group" aria-label="Choose an optional room">
        <button
          v-for="background in backgrounds"
          :key="background.id"
          type="button"
          class="background-option"
          :class="`background-${background.id}`"
          :disabled="sampleTides < background.threshold"
          :aria-pressed="selectedBackground === background.id"
          :aria-label="`${background.label}, ${sampleTides < background.threshold ? `locked, needs ${background.threshold} sample Tides` : 'available for preview'}`"
          @click="chooseBackground(background.id)"
        >
          <span class="background-swatch" aria-hidden="true"><img v-if="background.image" :src="background.image" alt="" loading="lazy" /><span v-if="background.id === 'night'" class="background-night-shade" /><span class="background-thumbnail-icon"><component :is="background.icon" :size="17" :stroke-width="1.5" /></span><Check v-if="selectedBackground === background.id" class="cosmetic-selected" :size="13" /></span>
          <strong>{{ background.label }}</strong><small>{{ background.threshold === 0 ? 'Included' : `${background.threshold} sample ${background.threshold === 1 ? 'Tide' : 'Tides'}` }}</small>
        </button>
      </div>
    </details>
  </section>
</template>

<style scoped>
.tide-unlocks {
  padding: 24px;
  border: 1px solid #d3e2ed;
  border-radius: 16px;
  color: #1f3b4d;
  background: #fff;
  font-family: "Albert Sans", system-ui, sans-serif;
}
.tide-unlocks :is(h2, h3) {
  font-family: "Unbounded", system-ui, sans-serif;
}
.tide-unlocks-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.tide-unlocks-eyebrow {
  margin: 0 0 8px;
  color: #587082;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.tide-unlocks-heading h2 {
  max-width: 500px;
  margin: 0;
  font-size: clamp(20px, 2.2vw, 25px);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.4;
}
.cosmetic-concept-label {
  flex-shrink: 0;
  padding: 6px 9px;
  border: 1px solid #d3e2ec;
  border-radius: 6px;
  color: #4e6b81;
  background: #f2f7fb;
  font-size: 10px;
  font-weight: 600;
}
.tide-unlocks-intro {
  max-width: 630px;
  margin: 13px 0 18px;
  color: #577084;
  font-size: 13px;
  line-height: 1.7;
}
.cosmetic-agent-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-bottom: 19px;
}
.cosmetic-agent-picker button {
  display: flex;
  min-width: 110px;
  min-height: 45px;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 7px;
  border: 1px solid #d6e2ec;
  border-bottom-width: 3px;
  border-radius: 10px;
  color: #45637b;
  background: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.cosmetic-agent-picker button[aria-pressed="true"] {
  border-color: #7eabc5;
  background: #edf6fc;
}
.cosmetic-agent-picker :is(img, .cosmetic-agent-thumbnail) {
  width: 31px;
  height: 31px;
  flex-shrink: 0;
  object-fit: contain;
}
.cosmetic-agent-picker svg {
  margin-left: auto;
}
.sample-tide-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 15px;
  border: 1px solid #dce7ef;
  border-radius: 10px;
  background: #f5f9fc;
}
.sample-tide-label {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #456b82;
  font-size: 12px;
}
.sample-tide-label strong {
  min-width: 26px;
  margin-left: 4px;
  font-size: 21px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.sample-tide-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sample-tide-counts button {
  min-width: 35px;
  min-height: 35px;
  padding: 6px 9px;
  border: 1px solid #d4e1eb;
  border-bottom-width: 3px;
  border-radius: 7px;
  color: #4f6b7e;
  background: #fff;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.sample-tide-counts button[aria-pressed="true"] {
  border-color: #2d5c78;
  color: #fff;
  background: #2d5c78;
}
.sample-tide-note,
.motion-preview-note,
.cosmetic-limit-note {
  color: #61788a;
  font-size: 11px;
  line-height: 1.65;
}
.sample-tide-note {
  margin: 9px 0 21px;
}
.motion-library-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.motion-stage-column,
.motion-library-choices {
  min-width: 0;
}
.cosmetic-preview-scene {
  position: relative;
  height: clamp(310px, 34vw, 430px);
  overflow: hidden;
  border: 1px solid #d7e5ee;
  border-radius: 13px;
  isolation: isolate;
  background: linear-gradient(165deg, #f9fcff 5%, #edf5fc 70%, #e1edf7);
  box-shadow: inset 0 1px 0 #fff;
}
.cosmetic-preview-environment,
.cosmetic-preview-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cosmetic-preview-shade {
  background: rgb(18 37 52 / 5%);
  pointer-events: none;
}
.cosmetic-preview-scene[data-background="night"] .cosmetic-preview-shade {
  background: rgb(11 24 49 / 67%);
}
.motion-stage-platform {
  position: absolute;
  right: 17%;
  bottom: 10%;
  left: 17%;
  height: 13%;
  border: 1px solid #d1e0eb;
  border-bottom: 5px solid #c5d6e4;
  border-radius: 50%;
  background: linear-gradient(#fff, #e3edf6);
  box-shadow: 0 13px 20px #486b8514;
}
.cosmetic-preview-scene:not([data-background="neutral"]) .motion-stage-platform {
  opacity: 0.75;
}
.cosmetic-preview-agent {
  position: absolute;
  inset: 8% 17% 12%;
}
.cosmetic-preview-room-label,
.cosmetic-preview-caption {
  position: absolute;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: calc(100% - 24px);
  padding: 7px 9px;
  border: 1px solid #d4e3ee;
  border-radius: 7px;
  color: #355a73;
  background: rgb(255 255 255 / 94%);
  font-size: 10px;
  line-height: 1.5;
}
.cosmetic-preview-room-label {
  top: 12px;
  left: 12px;
}
.cosmetic-preview-caption {
  bottom: 12px;
  left: 12px;
}
.cosmetic-agent-preview {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 15px 0 0;
}
.cosmetic-agent-preview strong {
  font-size: 13px;
  font-weight: 600;
}
.cosmetic-agent-preview p {
  max-width: 320px;
  margin: 5px 0 0;
  color: #5f778b;
  font-size: 11px;
  line-height: 1.6;
}
.cosmetic-motion-control {
  display: flex;
  min-height: 32px;
  flex-shrink: 0;
  align-items: center;
  gap: 7px;
  color: #42647d;
  font-size: 11px;
}
.cosmetic-motion-control input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #2d5c78;
}
.motion-preview-note {
  margin: 12px 0 0;
}
.motion-library-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 14px;
}
.motion-library-heading h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.6;
}
.motion-library-heading > span {
  color: #678095;
  font-size: 10px;
}
.companion-motion-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.companion-motion-option {
  min-width: 0;
  padding: 7px 7px 10px;
  border: 1px solid #d5e2ec;
  border-bottom: 3px solid #cbdce8;
  border-radius: 11px;
  color: #365870;
  background: #fff;
  box-shadow: 0 3px 6px #294e6c06;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.companion-motion-option[aria-pressed="true"] {
  border-color: #7aa8c3;
  background: #f0f8fd;
  box-shadow: 0 0 0 1px #a7c5d9;
}
.motion-thumbnail {
  position: relative;
  display: block;
  height: 99px;
  margin-bottom: 9px;
  overflow: hidden;
  border: 1px solid #e0eaf2;
  border-radius: 7px;
  background: linear-gradient(145deg, #fafcfe, #eaf2f9);
}
.motion-thumbnail-status {
  position: absolute;
  top: 5px;
  right: 5px;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid #d1e0eb;
  border-radius: 50%;
  color: #55768e;
  background: rgb(255 255 255 / 95%);
}
.companion-motion-option > strong,
.companion-motion-option > small,
.motion-option-status {
  display: block;
  padding: 0 3px;
  line-height: 1.5;
}
.companion-motion-option > strong {
  font-size: 12px;
  font-weight: 600;
}
.companion-motion-option > small {
  margin-top: 4px;
  color: #627a8e;
  font-size: 10px;
}
.motion-option-status {
  margin-top: 6px;
  color: #456a83;
  font-size: 9px;
  font-weight: 600;
}
.tide-unlocks .companion-motion-option:disabled,
.tide-unlocks .background-option:disabled {
  color: #536d80;
  background: #f9fbfd;
  opacity: 1;
  cursor: not-allowed;
}
.companion-motion-option:disabled .motion-thumbnail {
  filter: saturate(0.4);
}
.cosmetic-limit-note {
  margin: 15px 0 0;
  padding: 11px 13px;
  border: 1px solid #dce8f0;
  border-radius: 8px;
  background: #f7fbfd;
}
.optional-room-settings {
  margin-top: 25px;
  padding-top: 16px;
  border-top: 1px solid #e1e9f0;
}
.optional-room-settings summary {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  border-radius: 6px;
  color: #4a6a82;
  font-size: 12px;
  font-weight: 600;
  list-style: none;
  cursor: pointer;
}
.optional-room-settings summary::-webkit-details-marker {
  display: none;
}
.optional-room-settings[open] summary svg {
  transform: rotate(180deg);
}
.optional-room-settings > p {
  margin: 6px 0 15px;
  color: #667e91;
  font-size: 11px;
  line-height: 1.6;
}
.background-options {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 9px;
}
.background-option {
  min-width: 0;
  padding: 7px 7px 10px;
  border: 1px solid #d7e4ed;
  border-radius: 10px;
  color: #45677f;
  background: #fff;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.background-option[aria-pressed="true"] {
  border-color: #83abc4;
  background: #f0f8fd;
}
.background-swatch {
  position: relative;
  display: grid;
  height: 65px;
  margin-bottom: 9px;
  overflow: hidden;
  place-items: center;
  border: 1px solid #dce7ef;
  border-radius: 6px;
  background: linear-gradient(150deg, #f8fbfe, #e5eff8);
}
.background-swatch > img,
.background-night-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.background-night-shade {
  background: rgb(11 24 49 / 67%);
}
.background-thumbnail-icon {
  position: relative;
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border: 1px solid #d8e4ed;
  border-radius: 50%;
  color: #53768e;
  background: rgb(255 255 255 / 94%);
}
.cosmetic-selected {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 3px;
  border-radius: 50%;
  color: #fff;
  background: #2d5c78;
  box-sizing: content-box;
}
.background-option > strong,
.background-option > small {
  display: block;
  padding: 0 2px;
  line-height: 1.5;
}
.background-option > strong {
  font-size: 11px;
  font-weight: 600;
}
.background-option > small {
  margin-top: 4px;
  color: #617b8e;
  font-size: 9px;
}
.tide-unlocks :is(button, input, summary):focus-visible {
  outline: 3px solid #2386bf;
  outline-offset: 4px;
}
@media (max-width: 1000px) {
  .motion-library-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .cosmetic-preview-scene {
    height: 370px;
  }
  .motion-thumbnail {
    height: 118px;
  }
}
@media (max-width: 600px) {
  .tide-unlocks {
    padding: 18px;
  }
  .tide-unlocks-heading {
    flex-wrap: wrap;
    gap: 12px;
  }
  .cosmetic-agent-picker {
    gap: 7px;
  }
  .cosmetic-agent-picker button {
    min-width: 0;
    flex: 1;
    gap: 6px;
    padding-right: 8px;
    font-size: 12px;
  }
  .cosmetic-agent-picker img {
    width: 27px;
    height: 27px;
  }
  .cosmetic-preview-scene {
    height: 320px;
  }
  .cosmetic-preview-agent {
    inset: 8% 10% 12%;
  }
  .cosmetic-agent-preview {
    flex-wrap: wrap;
    gap: 10px;
  }
  .companion-motion-options {
    gap: 8px;
  }
  .companion-motion-option {
    padding: 6px 5px 9px;
  }
  .motion-thumbnail {
    height: 94px;
  }
  .companion-motion-option > strong {
    font-size: 11px;
  }
  .companion-motion-option > small,
  .motion-option-status {
    font-size: 9px;
  }
  .background-options {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 360px) {
  .companion-motion-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .cosmetic-agent-picker svg {
    display: none;
  }
}
</style>
