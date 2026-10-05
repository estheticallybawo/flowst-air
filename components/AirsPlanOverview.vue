<script setup lang="ts">
import type { StudyPlan, StudyPreferences } from "~/shared/study";
import { STUDY_PURPOSE_LABELS } from "~/shared/study";
import { Check, Circle } from 'lucide-vue-next';
const props = withDefaults(defineProps<{
  plan: StudyPlan;
  preferences: StudyPreferences;
  /** Server-derived journey checkpoints; model prose and timers never fill this list. */
  completedObjectiveIds?: string[];
  activeObjectiveId?: string;
}>(), { completedObjectiveIds: () => [] });
const completedIds = computed(() => new Set(props.completedObjectiveIds.filter(id => props.plan.objectives.some(o => o.id === id))));
const currentId = computed(() => props.activeObjectiveId || props.plan.activeObjectiveId);
const remaining = computed(() => props.plan.objectives.length - completedIds.value.size);
const encouragement = computed(() => {
  if (!props.plan.objectives.length) return 'Your objectives will appear here when the plan is ready.';
  if (!completedIds.value.size) return 'Take it one objective at a time. Your plan stays here whenever you want to check it.';
  if (!remaining.value) return 'You’ve completed the practice checkpoints in this plan. Take a moment to reflect with Kai.';
  return `Keep going. ${completedIds.value.size} ${completedIds.value.size === 1 ? 'checkpoint is' : 'checkpoints are'} saved, with ${remaining.value} ${remaining.value === 1 ? 'objective' : 'objectives'} still to practise.`;
});
</script>
<template>
  <div class="plan-overview">
    <div v-if="plan.status === 'APPROVED'" class="misu-note">
      <AgentAvatar agent="MISU" size="compact" />
      <div><strong>Misu</strong><p>{{ encouragement }}</p></div>
    </div>
    <p>
      {{ STUDY_PURPOSE_LABELS[preferences.purpose] }}
      <span v-if="plan.pacing"
        >· {{ plan.pacing.practiceMinutes }} min per topic · optional
        {{ plan.pacing.breakMinutes }} min breaks</span
      >
    </p>
    <p v-if="plan.status === 'APPROVED'" class="plan-progress">{{ completedIds.size }} of {{ plan.objectives.length }} practice checkpoints completed · {{ remaining }} remaining</p>
    <ol>
      <li
        v-for="objective in plan.objectives"
        :key="objective.id"
        :aria-current="
          objective.id === currentId && !completedIds.has(objective.id) ? 'step' : undefined
        "
        :class="{ complete: completedIds.has(objective.id) }"
      >
        <span class="objective-marker" aria-hidden="true"><Check v-if="completedIds.has(objective.id)" :size="16" /><Circle v-else :size="16" /></span>
        <div class="objective-detail"><strong>{{ objective.title }}</strong>
        <span v-if="plan.status === 'APPROVED'" class="objective-status">{{ completedIds.has(objective.id) ? 'Completed checkpoint' : objective.id === currentId ? 'Current objective' : 'Still to practise' }}</span>
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
        </div>
      </li>
    </ol>
  </div>
</template>
<style scoped>
.plan-overview > p {
  font-size: 0.85rem;
  color: #49677e;
  line-height: 1.5;
}
.plan-overview ol {
  padding-left: 0;
  list-style: none;
}
.plan-overview li {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid #deebf4;
}
.plan-overview li[aria-current] {
  color: #175b87;
}
.objective-marker { display: grid; align-content: start; justify-content: center; padding-top: 3px; color: #7c98ad; }
.complete .objective-marker { color: #2473a4; }
.objective-detail { min-width: 0; }
.objective-status { display: block; margin-top: 4px; color: #536d82; font-size: .75rem; }
.misu-note { display: flex; gap: 10px; padding: 14px; background: #edf7ff; border-radius: 16px; color: #244962; }
.misu-note p { margin: 5px 0 0; font-size: .85rem; }
.plan-progress { font-variant-numeric: tabular-nums; }
.plan-overview strong {
  font-size: 0.95rem;
}
.plan-overview details {
  margin-top: 8px;
  font-size: 0.85rem;
}
.plan-overview summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
}
.plan-overview summary:focus-visible { outline: 3px solid #337ba9; outline-offset: 2px; border-radius: 4px; }
.plan-overview p {
  line-height: 1.6;
}
</style>
