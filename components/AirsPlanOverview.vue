<script setup lang="ts">
import type { StudyPlan, StudyPreferences } from "~/shared/study";
import { STUDY_PURPOSE_LABELS } from "~/shared/study";
defineProps<{ plan: StudyPlan; preferences: StudyPreferences }>();
</script>
<template>
  <div class="plan-overview">
    <p>
      {{ STUDY_PURPOSE_LABELS[preferences.purpose] }}
      <span v-if="plan.pacing"
        >· {{ plan.pacing.practiceMinutes }} min per topic · optional
        {{ plan.pacing.breakMinutes }} min breaks</span
      >
    </p>
    <ol>
      <li
        v-for="objective in plan.objectives"
        :key="objective.id"
        :aria-current="
          objective.id === plan.activeObjectiveId ? 'step' : undefined
        "
      >
        <strong>{{ objective.title }}</strong>
        <details>
          <summary>Outcome and source</summary>
          <p>{{ objective.outcome }}</p>
          <p v-if="objective.planningNote">{{ objective.planningNote }}</p>
          <AirCitation
            v-for="source in objective.sources"
            :key="source.id"
            :source="source"
          />
        </details>
      </li>
    </ol>
  </div>
</template>
<style scoped>
.plan-overview > p {
  font-size: 0.85rem;
  color: #4b6658;
  line-height: 1.5;
}
.plan-overview ol {
  padding-left: 22px;
}
.plan-overview li {
  padding: 12px 0 12px 6px;
}
.plan-overview li[aria-current] {
  color: #245d42;
}
.plan-overview strong {
  font-size: 0.95rem;
}
.plan-overview details {
  margin-top: 8px;
  font-size: 0.85rem;
}
.plan-overview summary {
  cursor: pointer;
  min-height: 32px;
  line-height: 32px;
}
.plan-overview p {
  line-height: 1.6;
}
</style>
