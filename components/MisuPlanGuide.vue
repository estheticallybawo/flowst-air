<script setup lang="ts">
import type { StudyPlan, StudyPreferences } from "~/shared/study";
import { STUDY_PURPOSE_LABELS } from "~/shared/study";
const props = defineProps<{
  plan: StudyPlan;
  preferences: StudyPreferences;
  preparing?: boolean;
  savingApproval?: boolean;
}>();
const phaseLabels: Record<string, string> = {
  READING_SOURCE: "I’m reading the included material.",
  PREPARING_GOALS: "I’m preparing your practice goals.",
  CHECKING_REFERENCES: "I’m checking the source references.",
};
const pending = computed(
  () => props.preparing || props.plan.status === "PENDING",
);
const guidanceAvailable = computed(() =>
  ["explicit-instruction", "self-explanation-teach-back"].every((id) =>
    props.plan.functionRefs?.some(
      (ref) => ref.id === id && ref.version === "1",
    ),
  ),
);
</script>

<template>
  <section class="misu-guide" aria-label="Misu learning planner">
    <AgentActivity
      agent="MISU"
      :busy="pending || savingApproval"
      :state="savingApproval ? 'connecting' : 'composing'"
      :label="
        savingApproval
          ? 'Saving your approval.'
          : pending
            ? phaseLabels[plan.operation?.phase || ''] ||
              'I’m preparing your source-backed plan.'
            : plan.status === 'APPROVED'
              ? 'Your approved learning plan'
              : 'Your session plan'
      "
    />
    <h2>
      {{
        plan.status === "APPROVED"
          ? "Your approved learning plan"
          : "Your session plan"
      }}
    </h2>
    <p role="status" aria-live="polite">
      <template v-if="pending"
        >Misu is preparing a source-backed plan for your chosen goal. You’ll
        review it before starting.</template
      >
      <template v-else-if="savingApproval"
        >Saving your approval. Amina’s session starts only after approval is
        confirmed.</template
      >
      <template v-else-if="plan.status === 'FAILED'"
        >Misu could not finish preparing the plan. You can retry
        below.</template
      >
      <template v-else-if="plan.status === 'APPROVED'"
        >Your plan is approved. Amina will guide practice on your selected
        objective; Misu’s plan remains available here.</template
      >
      <template v-else
        >I’ve drafted your plan. Please go through it and let me know if you
        need an adjustment.</template
      >
    </p>
    <details
      v-if="!pending && (plan.status === 'DRAFT' || plan.status === 'APPROVED')"
    >
      <summary>What this plan is based on</summary>
      <dl>
        <template v-if="plan.contextSnapshot"
          ><dt>Confirmed learner context</dt>
          <dd>
            {{
              plan.contextSnapshot.summary ||
              plan.contextSnapshot.selfDescription ||
              [
                plan.contextSnapshot.background,
                plan.contextSnapshot.goals,
                plan.contextSnapshot.audience,
              ]
                .filter(Boolean)
                .join(" · ")
            }}
          </dd></template
        ><template v-if="plan.rationale"
          ><dt>Why this path</dt>
          <dd>{{ plan.rationale }}</dd></template
        ><template v-if="plan.conversationStrategy"
          ><dt>How Amina will guide practice</dt>
          <dd>{{ plan.conversationStrategy }}</dd></template
        ><template v-if="plan.evaluationCriteria?.length"
          ><dt>What Kai will consider</dt>
          <dd v-for="criterion in plan.evaluationCriteria" :key="criterion.id">
            {{ criterion.description }}
          </dd></template
        >
        <dt>Your goal</dt>
        <dd>
          {{ STUDY_PURPOSE_LABELS[preferences.purpose]
          }}<span v-if="preferences.context"> · {{ preferences.context }}</span>
        </dd>
        <dt>Scope and time</dt>
        <dd>
          {{ preferences.scope === "FOCUSED" ? "Focused" : "Broad" }} scope ·
          <template v-if="plan.pacing">{{ plan.pacing.practiceMinutes }} minutes per topic · {{ plan.pacing.breakMinutes }}-minute breaks. {{ plan.estimatedTotalMinutes }} minutes of planned practice; {{ plan.estimatedBreakMinutes }} minutes of breaks, including the final optional recovery break.</template><template v-else>{{ preferences.timeBudgetMinutes }} minutes available.</template> Activity times
          are estimates.
        </dd>
        <dt>Source grounding</dt>
        <dd>
          Each objective links to included source passages. Review those
          references alongside its intended outcome and Misu’s proposed plan
          explanation when available.
        </dd>
        <template v-if="guidanceAvailable"
          ><dt>Teaching approach</dt>
          <dd>
            A short introduction, guided practice, then an explanation in your
            own words. The approved approach gives you a chance to attempt an
            answer and request help.
          </dd></template
        >
      </dl>
      <p class="note">
        This summary describes your saved choices and the approved teaching
        approach. Practice and progress reviews provide separate evidence.
      </p>
    </details>
  </section>
</template>

<style scoped>
.misu-guide {
  min-width: 0;
  margin-bottom: 16px;
  overflow-wrap: anywhere;
}
header {
  display: flex;
  align-items: center;
  gap: 12px;
}
header p {
  margin: 0 0 5px;
  color: #464a53;
  font-size: 0.82rem;
}
h2 {
  margin: 0;
  font-size: 1.1rem;
  color: #0d0f14;
}
.misu-guide > p,
dd {
  color: #464a53;
  font-size: 0.85rem;
  line-height: 1.6;
}
details {
  padding: 12px;
  border: 1px solid #dbdee5;
  border-radius: 12px;
  background: #f7faff;
}
summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
}
dt {
  font-weight: 600;
  margin-top: 12px;
  font-size: 0.85rem;
}
dd {
  margin: 4px 0 0;
}
.note {
  font-size: 0.78rem;
  color: #464a53;
  line-height: 1.5;
}
</style>
