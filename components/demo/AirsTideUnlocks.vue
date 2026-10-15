<script setup lang="ts">
import { Check, Coffee, Flower2, LockKeyhole, Moon, Shirt, Sun, Waves } from "lucide-vue-next";
import { FLOWST_AGENTS } from "~/shared/agents";
import AminaDemoAvatar from "~/components/demo/AminaDemoAvatar.vue";

type ExpressionState = "idle" | "listening" | "thinking" | "speaking";
type CosmeticAgentId = "AMIRA" | "MIRO" | "KAI";
const props = defineProps<{ currentTides?: number }>();
const emit = defineEmits<{
  "background-change": [background: string];
  "expression-change": [expression: ExpressionState];
}>();
const sampleTides = ref(0);
const sampleCounts = [0, 1, 3, 5];
const cosmeticAgents = [FLOWST_AGENTS.AMIRA, FLOWST_AGENTS.MIRO, FLOWST_AGENTS.KAI];
const selectedAgentId = ref<CosmeticAgentId>("AMIRA");
const selectedAgent = computed(() => FLOWST_AGENTS[selectedAgentId.value]);
const selectedBackground = ref("studio");
const selectedExpression = ref<ExpressionState>("idle");
const previewMotion = ref(true);
const backgrounds = [
  { id: "studio", label: "Workspace", detail: "A clear, quiet space", threshold: 0, icon: Sun, image: "/environments/amina-workspace-v1.webp" },
  { id: "cafe", label: "Café", detail: "A warmer setting", threshold: 1, icon: Coffee, image: "/environments/amina-cafe-v1.webp" },
  { id: "garden", label: "Garden", detail: "Room to let ideas grow", threshold: 3, icon: Flower2, image: "/environments/amina-garden-v1.webp" },
  { id: "night", label: "Night", detail: "A calm evening palette", threshold: 5, icon: Moon, image: "/environments/amina-workspace-v1.webp" },
];
const activeBackground = computed(() => backgrounds.find(background => background.id === selectedBackground.value) || backgrounds[0]!);
const previewExpression = computed(() => selectedExpression.value === "speaking" ? "celebrate" : "auto");
const expressions: Array<{ id: ExpressionState; label: string; detail: string; threshold: number }> = [
  { id: "idle", label: "At ease", detail: "Idle pose", threshold: 0 },
  { id: "listening", label: "Attentive", detail: "Listening pose", threshold: 0 },
  { id: "thinking", label: "Thoughtful", detail: "Thinking pose", threshold: 1 },
  { id: "speaking", label: "Celebrate", detail: "Celebration pose", threshold: 3 },
];
const earnedTides = computed(() =>
  typeof props.currentTides === "number" && Number.isFinite(props.currentTides)
    ? Math.max(0, Math.floor(props.currentTides))
    : null,
);
function chooseCount(count: number) {
  sampleTides.value = count;
  const background = backgrounds.find((option) => option.id === selectedBackground.value);
  if (background && background.threshold > count) chooseBackground("studio");
  const expression = expressions.find((option) => option.id === selectedExpression.value);
  if (expression && expression.threshold > count) chooseExpression("idle");
}
function chooseBackground(backgroundId: string) {
  const option = backgrounds.find((background) => background.id === backgroundId);
  if (!option || option.threshold > sampleTides.value) return;
  selectedBackground.value = option.id;
  emit("background-change", option.id);
}
function chooseAgent(agentId: CosmeticAgentId) {
  selectedAgentId.value = agentId;
  selectedExpression.value = "idle";
  emit("expression-change", "idle");
}
function chooseExpression(expressionId: ExpressionState) {
  if (selectedAgentId.value !== "AMIRA") return;
  const option = expressions.find((expression) => expression.id === expressionId);
  if (!option || option.threshold > sampleTides.value) return;
  selectedExpression.value = option.id;
  emit("expression-change", option.id);
}
</script>

<template>
  <section class="tide-unlocks" aria-labelledby="tide-unlocks-title">
    <header class="tide-unlocks-heading">
      <div><p class="tide-unlocks-eyebrow">Make the space yours</p><h2 id="tide-unlocks-title">A little more character with every Tide</h2></div>
      <span class="cosmetic-concept-label">Cosmetic concept</span>
    </header>
    <p class="tide-unlocks-intro">Explore how earned Tides could unlock a new look for your companions and their space. Learning and practice stay available regardless of your Tides.</p>
    <div class="cosmetic-agent-picker" role="group" aria-label="Choose a companion for the cosmetic concept">
      <button v-for="agent in cosmeticAgents" :key="agent.id" type="button" :aria-pressed="selectedAgentId === agent.id" @click="chooseAgent(agent.id as CosmeticAgentId)">
        <img v-if="agent.avatar" :src="agent.avatar" alt="" /><span>{{ agent.name }}</span>
      </button>
    </div>
    <div class="cosmetic-preview-scene" :data-background="selectedBackground" :data-agent="selectedAgentId" :aria-label="`${selectedAgent.name} in the ${activeBackground.label.toLowerCase()} cosmetic preview`">
      <img class="cosmetic-preview-environment" :src="activeBackground.image" :alt="`${activeBackground.label} environment illustration`" />
      <div class="cosmetic-preview-shade" aria-hidden="true" />
      <div class="cosmetic-preview-agent"><AminaDemoAvatar v-if="selectedAgentId === 'AMIRA'" :state="selectedExpression" :expression="previewExpression" :active="previewMotion" :dark="selectedBackground === 'night'" compact /><img v-else-if="selectedAgent.portrait" class="cosmetic-static-agent" :src="selectedAgent.portrait" :alt="`${selectedAgent.name} character artwork`" /></div>
      <span class="cosmetic-preview-room-label"><component :is="activeBackground.icon" :size="14" />{{ activeBackground.label }}</span>
      <span class="cosmetic-preview-caption">{{ selectedAgent.name }} · {{ selectedAgentId === 'AMIRA' ? 'illustrated expression sample' : 'static character artwork' }}</span>
    </div>
    <div class="cosmetic-agent-preview">
      <div><strong>{{ selectedAgent.name }} · cosmetic preview</strong><p>{{ selectedAgentId === 'AMIRA' ? 'Room and expression choices update the scene above. Outfit rewards are a future concept.' : 'Room choices update the scene above. Expression and outfit rewards are a future concept; this character stays still.' }}</p></div>
      <label v-if="selectedAgentId === 'AMIRA'" class="cosmetic-motion-control"><input v-model="previewMotion" type="checkbox" /> Animate Amina</label>
    </div>
    <div class="sample-tide-control">
      <div class="sample-tide-label"><Waves :size="20" aria-hidden="true" /><span>Sample Tides</span><strong aria-live="polite">{{ sampleTides }}</strong></div>
      <div class="sample-tide-counts" role="group" aria-label="Choose a sample Tide count">
        <button v-for="count in sampleCounts" :key="count" type="button" :aria-pressed="sampleTides === count" @click="chooseCount(count)">{{ count }}</button>
      </div>
    </div>
    <p class="sample-tide-note">Demo counts only. Changing this number does not award Tides or change saved progress.<template v-if="earnedTides !== null"> Your earned Tides: {{ earnedTides }}.</template></p>

    <fieldset class="cosmetic-options">
      <legend>Room preview · shared backgrounds</legend>
      <div class="background-options">
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
          <span class="background-swatch" aria-hidden="true"><img :src="background.image" alt="" loading="lazy" /><span v-if="background.id === 'night'" class="background-night-shade" /><span class="background-thumbnail-icon"><component :is="background.icon" :size="16" :stroke-width="1.5" /></span><Check v-if="selectedBackground === background.id" class="cosmetic-selected" :size="13" /></span>
          <strong>{{ background.label }}</strong><small>{{ background.detail }}</small>
          <span class="cosmetic-status"><LockKeyhole v-if="sampleTides < background.threshold" :size="11" aria-hidden="true" />{{ background.threshold === 0 ? 'Included' : sampleTides < background.threshold ? `${background.threshold} sample Tides` : 'Unlocked in preview' }}</span>
        </button>
      </div>
    </fieldset>

    <fieldset v-if="selectedAgentId === 'AMIRA'" class="cosmetic-options">
      <legend>Try a presence preset</legend>
      <p class="preset-note">Illustrated expression samples. Live listening and provider animation are separate.</p>
      <div class="expression-options">
        <button
          v-for="expression in expressions"
          :key="expression.id"
          type="button"
          :disabled="sampleTides < expression.threshold"
          :aria-pressed="selectedExpression === expression.id"
          :aria-label="`${expression.label}, ${expression.detail}, ${sampleTides < expression.threshold ? `locked, needs ${expression.threshold} sample Tides` : 'available for preview'}`"
          @click="chooseExpression(expression.id)"
        >
          <span><strong>{{ expression.label }}</strong><small>{{ expression.detail }}</small></span>
          <LockKeyhole v-if="sampleTides < expression.threshold" :size="13" aria-hidden="true" /><Check v-else-if="selectedExpression === expression.id" :size="14" aria-hidden="true" />
          <small v-else>{{ expression.threshold === 0 ? 'Included' : 'Unlocked' }}</small>
        </button>
      </div>
    </fieldset>

    <div class="accessory-concept" :data-unlocked="sampleTides >= 5">
      <Shirt :size="22" :stroke-width="1.5" aria-hidden="true" />
      <div><strong>{{ selectedAgent.name }}’s weekend jacket</strong><p>Planned outfit concept · artwork not available yet</p></div>
      <span><LockKeyhole v-if="sampleTides < 5" :size="12" aria-hidden="true" />{{ sampleTides < 5 ? '5 sample Tides' : 'Concept revealed' }}</span>
    </div>
    <p class="cosmetic-limit-note">These are proposed appearance rewards. They do not unlock new teaching abilities or change Amina’s understanding.</p>
  </section>
</template>

<style scoped>
.tide-unlocks {
  padding: 24px;
  border: 1px solid #dce5e9;
  border-radius: 18px;
  color: #1f3b4d;
  background: #fff;
  font-family: "Albert Sans", sans-serif;
}
.tide-unlocks-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 15px;
}
.tide-unlocks-eyebrow {
  margin: 0 0 7px;
  color: #587082;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.tide-unlocks-heading h2 {
  max-width: 420px;
  margin: 0;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.3;
}
.cosmetic-concept-label {
  flex-shrink: 0;
  padding: 5px 8px;
  border-radius: 6px;
  color: #567082;
  background: #f0f5f7;
  font-size: 10px;
  font-weight: 600;
}
.tide-unlocks-intro {
  max-width: 650px;
  margin: 14px 0 19px;
  color: #607484;
  font-size: 13px;
  line-height: 1.7;
}
.cosmetic-agent-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.cosmetic-agent-picker button {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 7px;
  padding: 6px 12px 6px 7px;
  border: 1px solid #dfe7ec;
  border-radius: 9px;
  color: #48667a;
  background: #fff;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.cosmetic-agent-picker button[aria-pressed="true"] {
  border-color: #6f9ab4;
  background: #f1f7fb;
}
.cosmetic-agent-picker img {
  width: 29px;
  height: 29px;
  object-fit: contain;
}
.cosmetic-agent-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 13px;
  margin: 12px 0 18px;
  padding: 12px 15px;
  border: 1px solid #e4ebef;
  border-radius: 10px;
  background: #fafcfd;
}
.cosmetic-preview-scene {
  position: relative;
  height: clamp(300px, 40vw, 430px);
  overflow: hidden;
  border: 1px solid #d8e4e9;
  border-radius: 14px;
  isolation: isolate;
  background: #eaf1f2;
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
.cosmetic-preview-agent {
  position: absolute;
  inset: 4% 14% 0;
}
.cosmetic-static-agent {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
}
.cosmetic-preview-room-label,
.cosmetic-preview-caption {
  position: absolute;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border: 1px solid rgb(255 255 255 / 60%);
  border-radius: 7px;
  color: #284a60;
  background: rgb(255 255 255 / 91%);
  font-size: 11px;
  line-height: 1.4;
}
.cosmetic-preview-room-label {
  top: 13px;
  left: 13px;
}
.cosmetic-preview-caption {
  right: 12px;
  bottom: 12px;
  left: 12px;
  width: fit-content;
  max-width: calc(100% - 24px);
}
.cosmetic-motion-control {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 7px;
  color: #48667a;
  font-size: 11px;
}
.cosmetic-motion-control input {
  width: 16px;
  height: 16px;
  accent-color: #2d5c78;
}
.cosmetic-agent-preview strong {
  font-size: 12px;
  font-weight: 600;
}
.cosmetic-agent-preview p {
  max-width: 440px;
  margin: 5px 0 0;
  color: #6b7d89;
  font-size: 11px;
  line-height: 1.6;
}
.sample-tide-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 13px 15px;
  border: 1px solid #dce7ed;
  border-radius: 11px;
  background: #f5f9fb;
}
.sample-tide-label {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #456b82;
  font-size: 12px;
}
.sample-tide-label strong {
  margin-left: 4px;
  font-size: 18px;
  font-weight: 600;
}
.sample-tide-counts {
  display: flex;
  gap: 5px;
}
.sample-tide-counts button {
  width: 36px;
  min-height: 36px;
  border: 1px solid #dbe4e9;
  border-radius: 8px;
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
.preset-note,
.cosmetic-limit-note {
  color: #6a7d8b;
  font-size: 11px;
  line-height: 1.65;
}
.sample-tide-note {
  margin: 9px 0 0;
}
.cosmetic-options {
  min-width: 0;
  margin: 23px 0 0;
  padding: 0;
  border: 0;
}
.cosmetic-options legend {
  margin: 0 0 12px;
  padding: 0;
  font-size: 13px;
  font-weight: 600;
}
.background-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.background-option {
  min-width: 0;
  padding: 9px;
  border: 1px solid #dfe7ec;
  border-radius: 12px;
  color: #35556a;
  background: #fff;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.background-option[aria-pressed="true"] {
  border-color: #5f8da9;
  background: #f4f9fc;
}
.background-swatch {
  position: relative;
  display: grid;
  height: 61px;
  margin-bottom: 10px;
  overflow: hidden;
  place-items: center;
  border: 1px solid #dce6ec;
  border-radius: 7px;
  color: #62829a;
  background: #e8f0f5;
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
  border: 1px solid rgb(255 255 255 / 60%);
  border-radius: 50%;
  background: rgb(255 255 255 / 91%);
}
.background-cafe .background-swatch {
  border-color: #e1d2bf;
  color: #8a7254;
  background: #f1e5d3;
}
.background-night .background-swatch {
  border-color: #354b63;
  color: #d5e4f1;
  background: #253b53;
}
.cosmetic-selected {
  position: absolute;
  top: 5px;
  right: 5px;
  padding: 3px;
  border-radius: 50%;
  color: #fff;
  background: #2d5c78;
  box-sizing: content-box;
}
.background-option > strong,
.background-option > small {
  display: block;
}
.background-option > strong {
  font-size: 12px;
  font-weight: 600;
}
.background-option > small {
  margin-top: 4px;
  color: #6b7d89;
  font-size: 10px;
  line-height: 1.5;
}
.cosmetic-status {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  margin-top: 7px;
  color: #5b7487;
  font-size: 9px;
}
.preset-note {
  margin: -3px 0 13px;
}
.expression-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.expression-options button {
  display: flex;
  min-height: 57px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 13px;
  border: 1px solid #e0e7ec;
  border-radius: 9px;
  color: #44657b;
  background: #fff;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.expression-options button[aria-pressed="true"] {
  border-color: #6f9ab4;
  background: #f1f7fb;
}
.expression-options strong,
.expression-options span small {
  display: block;
  line-height: 1.5;
}
.expression-options strong {
  font-size: 11px;
  font-weight: 600;
}
.expression-options small {
  color: #71828f;
  font-size: 9px;
}
.tide-unlocks button:disabled {
  color: #758591;
  background: #f9fafb;
  cursor: not-allowed;
}
.tide-unlocks button:disabled .background-swatch {
  opacity: 0.65;
}
.tide-unlocks button:focus-visible {
  outline: 3px solid #94b6cd;
  outline-offset: 3px;
}
.accessory-concept {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 22px;
  padding: 14px;
  border: 1px dashed #d6e1e7;
  border-radius: 10px;
  color: #6b8090;
  background: #fafcfd;
}
.accessory-concept[data-unlocked="true"] {
  border-color: #98b9aa;
  background: #f5faf7;
}
.accessory-concept strong {
  font-size: 12px;
  font-weight: 600;
}
.accessory-concept p {
  margin: 4px 0 0;
  font-size: 10px;
  line-height: 1.5;
}
.accessory-concept > span {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  font-size: 10px;
}
.cosmetic-limit-note {
  margin: 13px 0 0;
}
@media (max-width: 550px) {
  .tide-unlocks {
    padding: 21px;
  }
  .tide-unlocks-heading,
  .sample-tide-control,
  .cosmetic-agent-preview {
    flex-wrap: wrap;
  }
  .sample-tide-control {
    gap: 12px;
  }
  .sample-tide-counts {
    flex: 1;
    justify-content: flex-end;
  }
  .background-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }
  .background-option {
    padding: 7px;
  }
  .background-option > small {
    display: none;
  }
  .cosmetic-status {
    align-items: flex-start;
    line-height: 1.5;
  }
  .expression-options {
    grid-template-columns: 1fr;
  }
  .accessory-concept {
    flex-wrap: wrap;
  }
}
</style>
