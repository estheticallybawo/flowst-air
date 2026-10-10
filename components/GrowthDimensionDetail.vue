<script setup lang="ts">
import { ArrowUpRight, Check, Circle } from "lucide-vue-next";
import type {
  GrowthCapability,
  GrowthDimensionProgress,
} from "~/shared/airGrowth";
import { growthDate } from "~/shared/airGrowthPrototype";
defineProps<{
  capability: GrowthCapability;
  dimension: GrowthDimensionProgress;
}>();
defineEmits<{ flowmark: [id: string] }>();
</script>
<template>
  <section
    class="growth-detail"
    :style="{
      '--dimension-color': capability.color,
      '--dimension-tint': capability.tint,
    }"
    :aria-label="`${capability.title} details`"
  >
    <div class="detail-intro">
      <span class="detail-eyebrow">Selected capability</span>
      <h2>{{ capability.title }}</h2>
      <p>{{ capability.meaning }}</p>
    </div>
    <div class="detail-ring">
      <GrowthProgressRing
        :capability="capability"
        :cycles="dimension.completedCycles"
        :progress="dimension.progress"
      /><span class="cycle-count"
        >{{ dimension.completedCycles }}
        {{
          dimension.completedCycles === 1 ? "cycle" : "cycles"
        }}
        completed</span
      >
    </div>
    <div class="detail-progress">
      <strong>{{ dimension.progress }}<span>%</span></strong>
      <p>
        {{
          dimension.progress
            ? `${dimension.progress}% toward cycle ${dimension.completedCycles + 1}`
            : `Toward cycle ${dimension.completedCycles + 1}`
        }}<small>{{
          dimension.completedCycles && !dimension.progress
            ? "A fresh cycle. New evidence starts here."
            : "Evidence-cycle progress"
        }}</small>
      </p>
    </div>
    <div class="detail-section">
      <h3>Evidence this cycle <span>Sample</span></h3>
      <p v-if="!dimension.evidence.length" class="detail-empty">
        {{
          dimension.completedCycles
            ? "No evidence collected in this new cycle yet."
            : "No evidence collected yet."
        }}
      </p>
      <ul v-else class="evidence-list">
        <li v-for="item in dimension.evidence" :key="item.id">
          <Check
            v-if="item.met"
            :size="18"
            class="evidence-check"
            aria-label="Observed in sample"
          /><Circle
            v-else
            :size="18"
            class="evidence-needed"
            aria-label="Still needed"
          />
          <div>
            <span>{{ item.text }}</span>
            <details v-if="item.quote">
              <summary>View sample evidence</summary>
              <p>{{ item.topic }}</p>
              <blockquote>{{ item.quote }}</blockquote>
            </details>
          </div>
        </li>
      </ul>
    </div>
    <div class="detail-section">
      <h3>Cycle history</h3>
      <p v-if="!dimension.history.length" class="detail-empty">
        Your first completed cycle will appear here.
      </p>
      <ol v-else class="cycle-history">
        <li v-for="cycle in dimension.history" :key="cycle.number">
          <button
            type="button"
            :aria-label="`View ${capability.title} cycle ${cycle.number} sample Flowmark`"
            @click="$emit('flowmark', cycle.flowmarkId)"
          >
            <span class="history-icon">{{ cycle.number }}</span
            ><strong>Cycle {{ cycle.number }}</strong
            ><small>{{ growthDate(cycle.completedAt) }}</small>
          </button>
        </li>
        <li class="next-cycle">
          <span class="history-icon">{{ dimension.completedCycles + 1 }}</span
          ><strong>Next cycle</strong><small>In progress</small>
        </li>
      </ol>
    </div>
    <div class="next-opportunity">
      <ArrowUpRight :size="19" :stroke-width="1.5" />
      <div>
        <strong>A useful next opportunity</strong>
        <p>{{ capability.suggestion }}</p>
      </div>
    </div>
    <button
      v-if="dimension.history.length"
      type="button"
      class="latest-flowmark"
      @click="$emit('flowmark', dimension.history.at(-1)!.flowmarkId)"
    >
      View latest sample Flowmark <ArrowUpRight :size="17" />
    </button>
    <p class="detail-footnote">
      Each completed cycle records fresh evidence across learning conversations.
    </p>
  </section>
</template>
<style scoped>
.growth-detail {
  color: var(--air-ink);
}
.detail-intro {
  text-align: center;
}
.detail-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.65rem;
  color: var(--air-accent-strong);
  font-weight: 700;
}
.detail-intro h2 {
  font-size: 1.05rem;
  line-height: 1.5;
  margin: 12px 0;
}
.detail-intro p {
  font-size: 0.85rem;
  line-height: 1.65;
  color: var(--air-muted);
  max-width: 300px;
  margin: 0 auto;
}
.detail-ring {
  position: relative;
  max-width: 180px;
  margin: 24px auto 20px;
}
.cycle-count {
  display: block;
  position: relative;
  width: max-content;
  max-width: 100%;
  margin: 12px auto 0;
  padding: 6px 10px;
  border: 1px solid var(--air-line);
  border-radius: 8px;
  background: var(--dimension-tint);
  color: var(--air-ink);
  font-size: 0.75rem;
  font-weight: 700;
}
.detail-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 22px 0 28px;
}
.detail-progress > strong {
  font-size: 2.3rem;
  letter-spacing: -0.05em;
  line-height: 1;
  color: var(--dimension-color);
  font-variant-numeric: tabular-nums;
}
.detail-progress > strong span {
  font-size: 1.25rem;
}
.detail-progress p {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
}
.detail-progress small {
  display: block;
  font-size: 0.72rem;
  font-weight: 400;
  color: var(--air-muted);
  margin-top: 6px;
  line-height: 1.5;
}
.detail-section {
  border-top: 1px solid var(--air-line);
  padding-top: 20px;
  margin-top: 20px;
}
.detail-section h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: "Albert Sans", sans-serif;
  font-size: 0.88rem;
  letter-spacing: 0;
  margin: 0 0 16px;
}
.detail-section h3 > span {
  font-weight: 400;
  font-size: 0.72rem;
  color: var(--air-muted);
}
.evidence-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 16px;
}
.evidence-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.82rem;
  line-height: 1.65;
}
.evidence-list svg {
  flex: none;
  margin-top: 2px;
}
.evidence-check {
  color: var(--dimension-color);
}
.evidence-needed {
  color: #64748b;
}
.evidence-list details {
  margin-top: 6px;
  color: var(--air-muted);
}
.evidence-list summary {
  cursor: pointer;
  font-size: 0.75rem;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.evidence-list details p {
  font-size: 0.75rem;
}
.evidence-list blockquote {
  margin: 8px 0;
  border-left: 2px solid var(--dimension-color);
  padding-left: 10px;
  font-size: 0.8rem;
}
.cycle-history {
  display: flex;
  gap: 12px;
  list-style: none;
  padding: 0 0 8px;
  margin: 0;
  overflow-x: auto;
}
.cycle-history li {
  flex: none;
  min-width: 80px;
  text-align: center;
}
.cycle-history button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 2px;
  border-radius: 8px;
}
.history-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  margin: 0 auto 10px;
  border: 1px solid var(--air-line);
  border-radius: 10px;
  background: var(--dimension-tint);
  color: var(--air-ink);
  font-weight: 700;
  font-size: 0.85rem;
}
.cycle-history strong {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
}
.cycle-history small {
  display: block;
  color: var(--air-muted);
  font-size: 0.65rem;
  margin-top: 5px;
}
.next-cycle .history-icon {
  background: #fff;
  border-style: dashed;
  color: var(--air-muted);
}
.next-opportunity {
  display: flex;
  gap: 10px;
  border-radius: 12px;
  padding: 16px;
  background: var(--air-canvas);
  margin-top: 20px;
  color: var(--air-ink);
}
.next-opportunity svg {
  flex: none;
  margin-top: 2px;
  color: var(--air-accent-strong);
}
.next-opportunity strong {
  font-size: 0.8rem;
}
.next-opportunity p {
  font-size: 0.8rem;
  line-height: 1.65;
  margin: 7px 0 0;
  color: var(--air-muted);
}
.latest-flowmark {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  border: 1px solid var(--air-line);
  border-radius: 12px;
  min-height: 46px;
  background: #fff;
  color: var(--air-accent-strong);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  margin-top: 16px;
  cursor: pointer;
}
.latest-flowmark:hover {
  background: var(--air-accent-soft);
}
.detail-footnote,
.detail-empty {
  color: var(--air-muted);
  font-size: 0.76rem;
  line-height: 1.7;
}
.detail-footnote {
  margin: 16px 0 0;
  text-align: center;
}
.growth-detail :is(button, summary):focus-visible {
  outline: 3px solid var(--air-accent-strong);
  outline-offset: 2px;
}
</style>
