<script setup lang="ts">
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  FlaskConical,
  RotateCcw,
} from "lucide-vue-next";
import type { GrowthDimensionId, GrowthScenario } from "~/shared/airGrowth";
import { growthDate } from "~/shared/airGrowthPrototype";

const prototype = useAirGrowthPrototype();
const { state, selected, capabilities } = prototype;
const selectedCapability = computed(
  () => capabilities.find((c) => c.id === state.value.selectedDimension)!,
);
const dialog = ref<
  "detail" | "session" | "completion" | "flowmark" | "share" | null
>(null);
const markId = ref("");
const mark = computed(() =>
  state.value.flowmarks.find((m) => m.id === markId.value),
);
const markCapability = computed(() =>
  capabilities.find((c) => c.id === mark.value?.dimensionId),
);
const recentMarks = computed(() =>
  [...state.value.flowmarks]
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, 3),
);
const mobile = ref(false);
const ready = ref(false);
const totalCycles = computed(() =>
  state.value.dimensions.reduce((sum, d) => sum + d.completedCycles, 0),
);
const canWalkThrough = computed(() => state.value.scenario === "returning");
const changedDimensions = computed(() =>
  state.value.sessionChanges.filter(
    (change) => change.next !== change.previous,
  ),
);
const unchangedDimensions = computed(() =>
  state.value.sessionChanges.filter(
    (change) => change.next === change.previous,
  ),
);
const completedCapability = computed(() =>
  capabilities.find((c) => c.id === state.value.completion?.dimensionId),
);
let media: MediaQueryList | undefined;
function viewportChanged() {
  mobile.value = media?.matches ?? false;
  if (!mobile.value && dialog.value === "detail") dialog.value = null;
}
onMounted(() => {
  media = window.matchMedia("(max-width: 899px)");
  viewportChanged();
  media.addEventListener("change", viewportChanged);
  ready.value = true;
});
onBeforeUnmount(() => media?.removeEventListener("change", viewportChanged));
function selectDimension(id: GrowthDimensionId) {
  prototype.select(id);
  if (mobile.value) dialog.value = "detail";
}
function changeScenario(event: Event) {
  dialog.value = null;
  prototype.setScenario(
    (event.target as HTMLSelectElement).value as GrowthScenario,
  );
}
function reset() {
  dialog.value = null;
  prototype.reset();
}
function previewSession() {
  prototype.applySession();
  dialog.value = "session";
}
function previewCompletion() {
  prototype.completeCycle();
  markId.value = state.value.completion?.flowmarkId || "";
  dialog.value = "completion";
}
function showFlowmark(id: string) {
  markId.value = id;
  dialog.value = "flowmark";
}
const dialogTitle = computed(
  () =>
    ({
      detail: selectedCapability.value.title,
      session: "Your sample session reflection",
      completion: "Your sample cycle is complete",
      flowmark: "Your sample Flowmark",
      share: "Local share-card preview",
    })[dialog.value || "detail"],
);
</script>

<template>
  <AirAppShell>
    <div class="growth-home" :data-prototype-ready="ready">
      <div class="prototype-bar">
        <div>
          <FlaskConical :size="16" /><strong>Prototype · Sample data</strong
          ><span
            >Explore the experience. Your learning records are unchanged.</span
          >
        </div>
        <button type="button" @click="reset">
          <RotateCcw :size="14" /> Reset preview
        </button>
      </div>
      <header class="growth-heading">
        <div>
          <p class="growth-eyebrow">Your verbal growth</p>
          <h1>Your growth</h1>
          <p class="growth-subtitle">
            See what your learning conversations are building over time.
          </p>
        </div>
        <NuxtLink class="air-button growth-primary" to="/airs/new"
          >Start a new session <ArrowUpRight :size="17" :stroke-width="1.5"
        /></NuxtLink>
      </header>

      <section class="growth-toolbar" aria-label="Prototype scenarios">
        <div>
          <span class="toolbar-dot" />
          <p>Every capability is available from day one.</p>
        </div>
        <label for="growth-scenario"
          >Preview scenario<select
            id="growth-scenario"
            :value="state.scenario"
            @change="changeScenario"
          >
            <option value="returning">Returning learner</option>
            <option value="new">New learner</option>
            <option value="pending">Review pending</option>
            <option value="failed">Review failed</option>
          </select></label
        >
      </section>

      <section
        v-if="state.scenario === 'pending' || state.scenario === 'failed'"
        class="review-status"
        :class="{ 'review-failed': state.scenario === 'failed' }"
        role="status"
      >
        <div>
          <strong>{{
            state.scenario === "pending"
              ? "Sample growth review pending"
              : "Sample growth review could not be completed"
          }}</strong>
          <p>
            {{
              state.scenario === "pending"
                ? "The preview keeps earlier progress visible while a review is pending."
                : "Earlier progress stays visible. Retry this preview without submitting another answer."
            }}
          </p>
        </div>
        <button type="button" @click="prototype.retry()">
          {{
            state.scenario === "failed" ? "Retry preview" : "Show ready preview"
          }}
          <ArrowRight :size="16" />
        </button>
      </section>

      <div class="growth-layout">
        <div class="growth-main">
          <section class="growth-path" aria-labelledby="growth-path-title">
            <header class="section-heading">
              <div>
                <h2 id="growth-path-title">Your growth path</h2>
                <p>
                  {{
                    state.scenario === "new"
                      ? "All seven capabilities are ready. Your first evidence begins with a conversation."
                      : "Choose a capability to explore its evidence."
                  }}
                </p>
              </div>
              <span class="cycle-total"
                >{{ totalCycles }} cycles completed</span
              >
            </header>
            <div class="capability-grid">
              <button
                v-for="(dimension, index) in state.dimensions"
                :key="dimension.dimensionId"
                type="button"
                class="capability-card"
                :class="{
                  selected: dimension.dimensionId === state.selectedDimension,
                }"
                :aria-pressed="
                  dimension.dimensionId === state.selectedDimension
                "
                :aria-label="`Explore ${capabilities.find((c) => c.id === dimension.dimensionId)!.title}`"
                :style="{
                  '--card-color': capabilities.find(
                    (c) => c.id === dimension.dimensionId,
                  )!.color,
                  '--card-tint': capabilities.find(
                    (c) => c.id === dimension.dimensionId,
                  )!.tint,
                }"
                @click="selectDimension(dimension.dimensionId)"
              >
                <span class="card-topline"
                  ><span class="card-number">0{{ index + 1 }}</span
                  ><span
                    v-if="dimension.dimensionId === state.selectedDimension"
                    class="card-selected"
                    >Selected</span
                  ><ArrowUpRight v-else :size="15" :stroke-width="1.5" /></span
                ><GrowthProgressRing
                  class="card-ring"
                  :capability="
                    capabilities.find((c) => c.id === dimension.dimensionId)!
                  "
                  :cycles="dimension.completedCycles"
                  :progress="dimension.progress"
                />
                <h3>
                  {{
                    capabilities.find((c) => c.id === dimension.dimensionId)!
                      .title
                  }}
                </h3>
                <span class="card-cycle"
                  >{{ dimension.completedCycles }}
                  {{
                    dimension.completedCycles === 1 ? "cycle" : "cycles"
                  }}
                  completed</span
                >
                <p class="card-progress">
                  <strong>{{ dimension.progress }}%</strong>
                  <span>toward cycle {{ dimension.completedCycles + 1 }}</span>
                </p>
                <span
                  v-if="!dimension.evidence.length"
                  class="card-evidence-label"
                  >{{
                    dimension.completedCycles
                      ? "New cycle · awaiting evidence"
                      : "No evidence collected yet"
                  }}</span
                >
              </button>
            </div>
          </section>

          <section class="walkthrough" aria-labelledby="walkthrough-title">
            <div class="walkthrough-top">
              <AgentAvatar agent="AMIRA" size="standard" />
              <div>
                <p class="growth-eyebrow">Try the sample journey</p>
                <h2 id="walkthrough-title">From conversation to Flowmark</h2>
              </div>
            </div>
            <p>
              Preview how a conversation can contribute evidence, then see a
              completed cycle become a Flowmark.
            </p>
            <div class="walkthrough-steps">
              <span :class="{ done: state.sessionApplied }"
                ><Check v-if="state.sessionApplied" :size="14" /><span v-else
                  >1</span
                >
                Session reflection</span
              ><ChevronRight :size="15" /><span
                :class="{ done: state.completionApplied }"
                ><Check v-if="state.completionApplied" :size="14" /><span v-else
                  >2</span
                >
                Completed cycle</span
              >
            </div>
            <div class="walkthrough-actions">
              <button
                id="growth-session-preview"
                type="button"
                class="air-button growth-primary"
                :disabled="!canWalkThrough"
                @click="previewSession"
              >
                {{
                  state.sessionApplied
                    ? "View sample reflection"
                    : "Preview a session update"
                }}
                <ArrowRight :size="16" /></button
              ><button
                type="button"
                class="air-button air-button-secondary growth-secondary"
                :disabled="
                  !canWalkThrough ||
                  !state.sessionApplied ||
                  state.completionApplied
                "
                @click="previewCompletion"
              >
                Preview cycle completion <ArrowUpRight :size="16" />
              </button>
            </div>
            <p v-if="!canWalkThrough" class="walkthrough-help">
              Choose Returning learner to explore the full walkthrough.
            </p>
            <p v-else-if="state.completionApplied" class="walkthrough-help">
              Sample cycle complete. Reset preview to walk through it again.
            </p>
          </section>

          <section class="recent-flowmarks" aria-labelledby="flowmarks-title">
            <header class="section-heading">
              <div>
                <h2 id="flowmarks-title">Your Flowmarks</h2>
                <p>
                  Your sample Flowmarks. A record of completed evidence cycles.
                </p>
              </div>
              <span class="sample-tag">Sample collection</span>
            </header>
            <div v-if="recentMarks.length" class="flowmark-grid">
              <button
                v-for="item in recentMarks"
                :key="item.id"
                type="button"
                class="flowmark-tile"
                :aria-label="`View ${capabilities.find((c) => c.id === item.dimensionId)!.title} cycle ${item.cycle} sample Flowmark`"
                @click="showFlowmark(item.id)"
              >
                <GrowthCapabilityArt
                  :dimension="item.dimensionId"
                  :cycles="item.cycle"
                  :color="
                    capabilities.find((c) => c.id === item.dimensionId)!.color
                  "
                  :tint="
                    capabilities.find((c) => c.id === item.dimensionId)!.tint
                  "
                /><span
                  ><strong>{{
                    capabilities.find((c) => c.id === item.dimensionId)!.title
                  }}</strong
                  ><small
                    >Cycle {{ item.cycle }} ·
                    {{ growthDate(item.completedAt) }}</small
                  ></span
                ><ArrowUpRight :size="17" />
              </button>
            </div>
            <div v-else class="flowmarks-empty">
              <span class="empty-mark" aria-hidden="true">F</span>
              <p>
                Your first Flowmark will appear after a completed evidence
                cycle.
              </p>
            </div>
          </section>
          <footer class="growth-footer">
            <span
              >Every capability grows through fresh evidence. Move at your own
              pace.</span
            >
          </footer>
        </div>
        <aside class="desktop-detail">
          <GrowthDimensionDetail
            :capability="selectedCapability"
            :dimension="selected"
            @flowmark="showFlowmark"
          />
        </aside>
      </div>

      <GrowthPrototypeDialog
        fallback-focus-id="growth-session-preview"
        :open="!!dialog"
        :title="dialogTitle"
        :full-screen="dialog === 'detail'"
        @close="dialog = null"
      >
        <GrowthDimensionDetail
          v-if="dialog === 'detail'"
          :capability="selectedCapability"
          :dimension="selected"
          @flowmark="showFlowmark"
        />
        <section v-else-if="dialog === 'session'" class="session-reflection">
          <p class="modal-intro">
            In this scripted example, one conversation contributes to three
            capabilities.
          </p>
          <article
            v-for="change in changedDimensions"
            :key="change.dimensionId"
            class="session-change"
          >
            <div>
              <strong>{{
                capabilities.find((c) => c.id === change.dimensionId)!.title
              }}</strong
              ><span>{{ change.previous }}% → {{ change.next }}%</span>
            </div>
            <b
              >+{{ change.next - change.previous
              }}<small>percentage points</small></b
            >
            <p>{{ change.reason }}</p>
          </article>
          <div
            v-for="change in unchangedDimensions"
            :key="change.dimensionId"
            class="unchanged-note"
          >
            <strong
              >{{
                capabilities.find((c) => c.id === change.dimensionId)!.title
              }}
              · unchanged at {{ change.next }}%</strong
            >
            <p>{{ change.reason }}</p>
          </div>
          <p class="modal-note">
            These are scripted cycle-progress changes, not assessment scores.
            Reopening this reflection will not apply them again.
          </p>
          <button
            type="button"
            class="air-button growth-primary"
            @click="dialog = null"
          >
            Back to growth <ArrowRight :size="16" />
          </button>
        </section>
        <section
          v-else-if="
            dialog === 'completion' && state.completion && completedCapability
          "
          class="cycle-celebration"
        >
          <GrowthProgressRing
            :capability="completedCapability"
            :cycles="state.completion.completedCycle"
            :progress="state.completion.progress"
            :label="`${completedCapability.title}: cycle ${state.completion.completedCycle} complete`"
          />
          <p class="growth-eyebrow">Sample cycle complete</p>
          <h3>{{ completedCapability.title }}</h3>
          <strong class="celebration-count"
            >{{ state.completion.completedCycle }} cycles completed</strong
          >
          <p>
            A fresh independent example completed this sample cycle. Your badge
            has evolved, and a Flowmark is ready.
          </p>
          <p class="modal-note">
            The next ring begins at 0% toward cycle
            {{ state.completion.completedCycle + 1 }}. Your
            {{ state.completion.completedCycle }} completed cycles stay visible.
          </p>
          <button
            type="button"
            class="air-button growth-primary"
            @click="dialog = null"
          >
            Continue to the next cycle <ArrowRight :size="16" /></button
          ><button
            type="button"
            class="air-button air-button-secondary growth-secondary"
            @click="dialog = 'flowmark'"
          >
            View sample Flowmark <ArrowUpRight :size="16" />
          </button>
        </section>
        <section v-else-if="mark && markCapability" class="flowmark-preview">
          <div
            class="share-card"
            :style="{
              '--flowmark-color': markCapability.color,
              '--flowmark-tint': markCapability.tint,
            }"
            :class="{ 'share-card-expanded': dialog === 'share' }"
          >
            <div class="share-brand">
              <img
                src="/brand/flowst-mark-blue.png"
                alt=""
                width="28"
                height="28"
              /><strong>Flowst <span>Airs</span></strong
              ><span class="specimen">Sample</span>
            </div>
            <GrowthCapabilityArt
              class="share-art"
              :dimension="mark.dimensionId"
              :cycles="mark.cycle"
              :color="markCapability.color"
              :tint="markCapability.tint"
            />
            <p class="growth-eyebrow">A completed evidence cycle</p>
            <h3>{{ markCapability.title }}</h3>
            <span class="share-cycle">Cycle {{ mark.cycle }}</span>
            <p class="share-message">Learning, made visible.</p>
            <div class="share-stats">
              <span
                ><strong>{{ mark.conversations }}</strong> sample
                conversations</span
              ><span
                ><strong>{{ mark.contexts }}</strong> sample contexts</span
              >
            </div>
            <p class="share-date">
              {{ growthDate(mark.completedAt) }} · Prototype specimen
            </p>
          </div>
          <template v-if="dialog === 'flowmark'"
            ><h4>Sample evidence behind this Flowmark</h4>
            <ul class="flowmark-evidence">
              <li v-for="text in mark.evidence" :key="text">
                <Check :size="17" />{{ text }}
              </li>
            </ul>
            <p class="modal-note">
              This sample represents a completed evidence cycle, not a formal
              certification.
            </p>
            <button
              type="button"
              class="air-button growth-primary"
              @click="dialog = 'share'"
            >
              Preview share card <ArrowUpRight :size="16" /></button></template
          ><template v-else
            ><p class="modal-note">
              Local preview only. Nothing has been published or shared.
            </p>
            <button
              type="button"
              class="air-button air-button-secondary growth-secondary"
              @click="dialog = 'flowmark'"
            >
              Back to sample Flowmark
            </button></template
          >
        </section>
      </GrowthPrototypeDialog>
    </div>
  </AirAppShell>
</template>

<style scoped>
.growth-home {
  max-width: 1440px;
  margin: 0 auto;
  color: var(--air-ink);
}
.growth-home button,
.growth-home select {
  font-family: inherit;
}
.prototype-bar {
  position: sticky;
  top: 12px;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--air-line);
  background: #e0f2fe;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 0.75rem;
  color: var(--air-accent-strong);
}
.prototype-bar > div {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.prototype-bar strong {
  font-weight: 700;
}
.prototype-bar > div > span {
  margin-left: 8px;
  color: var(--air-muted);
}
.prototype-bar button {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0;
  color: var(--air-accent-strong);
  font-size: 0.75rem;
  min-height: 32px;
  cursor: pointer;
  flex: none;
}
.growth-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 32px 0;
}
.growth-eyebrow {
  font-size: 0.69rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--air-accent-strong);
  margin: 0 0 12px;
}
.growth-heading h1 {
  font-size: 2rem;
  line-height: 1.3;
  letter-spacing: -0.035em;
  margin: 0;
}
.growth-subtitle {
  font-size: 0.94rem;
  line-height: 1.65;
  color: var(--air-muted);
  margin: 12px 0 0;
  max-width: 48ch;
}
.growth-primary,
.growth-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 46px;
  padding: 12px 18px;
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.18s,
    transform 0.18s;
}
.growth-primary {
  background: var(--air-accent-strong);
  color: #fff;
  border: 1px solid var(--air-accent-strong);
}
.growth-primary:hover {
  background: #075985;
}
.growth-secondary {
  background: #fff;
  color: var(--air-ink);
  border: 1px solid var(--air-line);
}
.growth-secondary:hover {
  background: #f0f9ff;
}
.growth-home button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
.growth-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-block: 1px solid var(--air-line);
  padding: 16px 0;
  margin-bottom: 28px;
}
.growth-toolbar > div {
  display: flex;
  align-items: center;
  gap: 9px;
}
.growth-toolbar p {
  font-size: 0.82rem;
  color: var(--air-muted);
  margin: 0;
}
.toolbar-dot {
  width: 6px;
  height: 6px;
  background: var(--air-accent);
  border-radius: 50%;
  flex: none;
}
.growth-toolbar label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.75rem;
  color: var(--air-muted);
}
.growth-toolbar select {
  min-height: 44px;
  border: 1px solid var(--air-line);
  border-radius: 10px;
  padding: 8px 28px 8px 12px;
  color: var(--air-ink);
  background: #fff;
  font-size: 0.8rem;
}
.growth-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
}
.growth-main {
  min-width: 0;
}
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}
.section-heading h2 {
  font-size: 1.05rem;
  line-height: 1.5;
  margin: 0;
}
.section-heading p {
  font-size: 0.8rem;
  color: var(--air-muted);
  line-height: 1.6;
  margin: 6px 0 0;
}
.cycle-total {
  font-size: 0.73rem;
  color: var(--air-muted);
  white-space: nowrap;
}
.capability-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.capability-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border: 1px solid var(--air-line);
  background: #fff;
  border-radius: 14px;
  padding: 14px 12px 18px;
  color: var(--air-ink);
  cursor: pointer;
  min-width: 0;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}
.capability-card:hover {
  border-color: var(--card-color);
  transform: translateY(-2px);
}
.capability-card.selected {
  border-color: var(--card-color);
  background: color-mix(in srgb, var(--card-tint) 32%, white);
  box-shadow:
    0 0 0 1px var(--card-color),
    0 6px 20px #0284c70a;
}
.card-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 20px;
  color: var(--air-muted);
  margin-bottom: 12px;
}
.card-number {
  font-size: 0.66rem;
  font-variant-numeric: tabular-nums;
}
.card-selected {
  color: var(--air-ink);
  font-size: 0.65rem;
  font-weight: 700;
}
.card-ring {
  width: min(118px, 100%);
  margin: 0 auto 14px;
}
.capability-card h3 {
  font-family: "Albert Sans", sans-serif;
  letter-spacing: -0.01em;
  font-size: 0.93rem;
  font-weight: 700;
  line-height: 1.35;
  min-height: 2.7em;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 140px;
  margin: 0 auto 9px;
}
.card-cycle {
  font-size: 0.72rem;
  color: var(--air-muted);
  line-height: 1.5;
}
.card-progress {
  font-size: 0.72rem;
  line-height: 1.6;
  margin: 8px 0 0;
  color: var(--air-muted);
}
.card-progress strong {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--air-ink);
}
.card-evidence-label {
  font-size: 0.68rem;
  color: var(--air-muted);
  line-height: 1.5;
  display: block;
  margin-top: 8px;
}
.desktop-detail {
  border: 1px solid var(--air-line);
  background: #fff;
  border-radius: 18px;
  padding: 26px 22px;
  min-width: 0;
  box-shadow: var(--shadow);
}
.walkthrough {
  margin-top: 24px;
  padding: 24px;
  border: 1px solid var(--air-line);
  border-radius: 18px;
  background: #fff;
}
.walkthrough-top {
  display: flex;
  align-items: center;
  gap: 14px;
}
.walkthrough .growth-eyebrow {
  font-size: 0.65rem;
  margin: 0 0 7px;
}
.walkthrough h2 {
  font-size: 1rem;
  line-height: 1.5;
  margin: 0;
}
.walkthrough > p {
  font-size: 0.84rem;
  color: var(--air-muted);
  line-height: 1.7;
  margin: 16px 0;
}
.walkthrough-steps {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.75rem;
  color: var(--air-muted);
  margin: 20px 0;
}
.walkthrough-steps > span {
  display: flex;
  align-items: center;
  gap: 7px;
}
.walkthrough-steps > span > span {
  display: grid;
  place-items: center;
  border: 1px solid var(--air-line);
  background: var(--air-canvas);
  color: var(--air-accent-strong);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 0.7rem;
}
.walkthrough-steps .done {
  color: var(--air-accent-strong);
}
.walkthrough-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.walkthrough-help {
  font-size: 0.75rem !important;
  margin-bottom: 0 !important;
}
.recent-flowmarks {
  margin-top: 32px;
}
.sample-tag {
  font-size: 0.7rem;
  color: var(--air-muted);
  white-space: nowrap;
}
.flowmark-grid {
  display: grid;
  gap: 10px;
}
.flowmark-tile {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  padding: 10px 16px;
  border: 1px solid var(--air-line);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  color: var(--air-ink);
}
.flowmark-tile > .growth-art {
  width: 58px;
  height: 58px;
  flex: none;
}
.flowmark-tile > svg:last-child {
  margin-left: auto;
  flex: none;
  color: var(--air-accent-strong);
}
.flowmark-tile strong {
  display: block;
  font-size: 0.84rem;
  font-weight: 700;
}
.flowmark-tile small {
  display: block;
  color: var(--air-muted);
  font-size: 0.73rem;
  margin-top: 5px;
}
.flowmark-tile:hover {
  border-color: var(--air-accent);
  background: #f8fcff;
}
.flowmarks-empty {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px;
  border: 1px dashed var(--air-line);
  border-radius: 12px;
  color: var(--air-muted);
  font-size: 0.84rem;
  line-height: 1.6;
}
.empty-mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  color: var(--air-accent-strong);
  background: var(--air-accent-soft);
  border-radius: 10px;
  font:
    600 1rem "Unbounded",
    sans-serif;
}
.growth-footer {
  color: var(--air-muted);
  margin-top: 28px;
  font-size: 0.75rem;
  line-height: 1.7;
}
.review-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border: 1px solid var(--air-line);
  border-radius: 12px;
  padding: 18px 22px;
  background: var(--air-accent-soft);
  margin-bottom: 24px;
}
.review-status strong {
  font-size: 0.9rem;
}
.review-status p {
  font-size: 0.8rem;
  line-height: 1.6;
  margin: 6px 0 0;
  color: var(--air-muted);
}
.review-status button {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  min-height: 44px;
  border: 1px solid var(--air-line);
  border-radius: 10px;
  background: #fff;
  padding: 9px 14px;
  color: var(--air-accent-strong);
  font-size: 0.8rem;
  cursor: pointer;
}
.review-failed {
  background: #fff7ed;
  border-color: #e4c9ab;
}
.modal-intro,
.modal-note {
  font-size: 0.85rem;
  line-height: 1.75;
  color: var(--air-muted);
}
.modal-intro {
  margin-top: 0;
}
.modal-note {
  font-size: 0.78rem;
  margin: 18px 0;
}
.session-change {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  border-bottom: 1px solid var(--air-line);
  padding: 18px 0;
}
.session-change strong {
  font-size: 0.9rem;
}
.session-change span {
  display: block;
  font-size: 0.8rem;
  color: var(--air-muted);
  margin-top: 6px;
}
.session-change > b {
  font-size: 1.5rem;
  color: var(--air-accent-strong);
  text-align: right;
}
.session-change b small {
  display: block;
  font-size: 0.65rem;
  font-weight: 400;
  color: var(--air-muted);
  margin-top: 3px;
}
.session-change > p {
  grid-column: 1/-1;
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.65;
  color: var(--air-muted);
}
.unchanged-note {
  margin-top: 20px;
  background: var(--air-canvas);
  padding: 16px;
  border-radius: 12px;
}
.unchanged-note strong {
  font-size: 0.84rem;
}
.unchanged-note p {
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--air-muted);
  margin: 8px 0 0;
}
.cycle-celebration {
  text-align: center;
}
.cycle-celebration > .growth-ring {
  width: 200px;
  margin: 0 auto 24px;
}
.cycle-celebration h3 {
  font-size: 1.3rem;
  margin: 12px 0;
}
.celebration-count {
  display: inline-block;
  background: var(--air-accent-soft);
  border-radius: 8px;
  padding: 8px 14px;
  color: var(--air-accent-strong);
  font-size: 0.85rem;
}
.cycle-celebration > p:not(.growth-eyebrow) {
  font-size: 0.87rem;
  line-height: 1.8;
  max-width: 410px;
  margin: 18px auto;
  color: var(--air-muted);
}
.cycle-celebration > button {
  display: flex;
  margin: 10px auto;
  width: 100%;
  max-width: 320px;
}
.flowmark-preview h4 {
  font-size: 0.9rem;
  margin: 24px 0 16px;
}
.share-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--air-line);
  border-radius: 16px;
  padding: 24px 26px;
  text-align: center;
  background: color-mix(in srgb, var(--flowmark-tint) 65%, white);
}
.share-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
}
.share-brand img {
  object-fit: contain;
}
.share-brand strong {
  font-family: "Unbounded", sans-serif;
  font-size: 0.85rem;
  color: var(--air-ink);
  letter-spacing: -0.04em;
}
.share-brand strong span {
  color: var(--air-accent-strong);
}
.specimen {
  margin-left: auto;
  border: 1px solid var(--air-line);
  padding: 4px 9px;
  border-radius: 6px;
  font-size: 0.7rem;
  color: var(--air-muted);
  background: #fff;
}
.share-art {
  width: 185px;
  height: 185px;
  margin: 16px auto 12px;
}
.share-card .growth-eyebrow {
  font-size: 0.65rem;
  margin: 8px 0 12px;
}
.share-card h3 {
  font-size: 1.3rem;
  line-height: 1.5;
  margin: 0;
}
.share-cycle {
  display: inline-block;
  border: 1px solid var(--air-line);
  border-radius: 8px;
  background: #fff;
  padding: 7px 14px;
  font-size: 0.8rem;
  color: var(--air-ink);
  margin: 12px 0;
}
.share-message {
  font-size: 0.95rem;
  color: var(--air-muted);
  margin: 8px 0 24px;
}
.share-stats {
  display: flex;
  justify-content: center;
  gap: 28px;
  color: var(--air-muted);
  font-size: 0.75rem;
}
.share-stats strong {
  display: block;
  font-size: 1.35rem;
  color: var(--air-ink);
  margin-bottom: 6px;
}
.share-date {
  font-size: 0.7rem;
  color: var(--air-muted);
  margin: 22px 0 0;
}
.flowmark-evidence {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.flowmark-evidence li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.84rem;
  line-height: 1.7;
  color: var(--air-muted);
}
.flowmark-evidence svg {
  flex: none;
  margin-top: 3px;
  color: var(--air-accent-strong);
}
.growth-home :is(button, select, a):focus-visible {
  outline: 3px solid var(--air-accent-strong);
  outline-offset: 3px;
}
@media (min-width: 1240px) {
  .capability-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 1099px) {
  .growth-layout {
    gap: 18px;
    grid-template-columns: minmax(0, 1fr) 290px;
  }
  .desktop-detail {
    padding: 22px 18px;
  }
  .cycle-total {
    display: none;
  }
  .capability-card {
    padding-inline: 10px;
  }
  .walkthrough {
    padding: 22px;
  }
  .growth-subtitle {
    max-width: 38ch;
  }
}
@media (max-width: 899px) {
  .growth-layout {
    grid-template-columns: 1fr;
  }
  .desktop-detail {
    display: none;
  }
  .growth-heading {
    gap: 20px;
  }
  .growth-heading > a {
    flex: none;
  }
  .prototype-bar > div > span {
    display: none;
  }
  .card-ring {
    width: 135px;
  }
  .cycle-total {
    display: block;
  }
}
@media (max-width: 599px) {
  .prototype-bar {
    padding: 8px 10px;
    gap: 8px;
    font-size: 0.68rem;
  }
  .prototype-bar > div {
    gap: 6px;
  }
  .prototype-bar button {
    font-size: 0.68rem;
  }
  .growth-heading {
    flex-direction: column;
    align-items: flex-start;
    padding: 28px 0 24px;
    gap: 18px;
  }
  .growth-heading h1 {
    font-size: 1.7rem;
  }
  .growth-subtitle {
    font-size: 0.88rem;
  }
  .growth-eyebrow {
    font-size: 0.65rem;
  }
  .growth-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 24px;
  }
  .growth-toolbar p {
    font-size: 0.78rem;
  }
  .growth-toolbar label {
    justify-content: space-between;
    width: 100%;
  }
  .growth-toolbar select {
    min-width: 175px;
  }
  .capability-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .capability-card {
    padding: 12px 12px 16px;
  }
  .card-ring {
    width: 125px;
  }
  .card-progress > span {
    display: block;
  }
  .section-heading h2 {
    font-size: 0.96rem;
  }
  .section-heading p {
    font-size: 0.78rem;
  }
  .cycle-total {
    display: none;
  }
  .sample-tag {
    font-size: 0.65rem;
  }
  .walkthrough {
    padding: 22px 18px;
  }
  .walkthrough h2 {
    font-size: 0.9rem;
  }
  .walkthrough-actions {
    flex-direction: column;
  }
  .walkthrough-actions > button {
    width: 100%;
  }
  .walkthrough-steps {
    font-size: 0.7rem;
    gap: 8px;
  }
  .growth-footer {
    font-size: 0.72rem;
  }
  .review-status {
    align-items: flex-start;
    flex-direction: column;
    padding: 18px;
  }
  .review-status button {
    width: 100%;
    justify-content: center;
  }
  .share-card {
    padding: 22px 16px;
  }
  .share-card h3 {
    font-size: 1.1rem;
  }
  .share-art {
    width: 160px;
    height: 160px;
  }
}
@media (max-width: 359px) {
  .card-ring {
    width: 105px;
  }
  .capability-card {
    padding-inline: 9px;
  }
  .prototype-bar > div > svg {
    display: none;
  }
  .walkthrough-steps {
    gap: 5px;
    font-size: 0.63rem;
  }
  .growth-toolbar select {
    min-width: 160px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .capability-card,
  .growth-primary,
  .growth-secondary {
    transition: none;
  }
  .capability-card:hover,
  .growth-primary:hover,
  .growth-secondary:hover {
    transform: none;
  }
}
</style>
