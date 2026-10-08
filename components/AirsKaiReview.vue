<script setup lang="ts">
import type { KaiReview } from "~/shared/airsOrchestration";
import { KAI_ASSESSMENT_VERSION, KAI_VERBAL_LABELS } from "~/shared/kaiAssessment";
const props = defineProps<{ conversationId: string; canReview: boolean; autoGenerate?: boolean }>();
const reviewRetry = useStudyRetry(computed(() => `airs-review-retry:${props.conversationId}`));
const emit = defineEmits<{ "completion-ready": [review: KaiReview | null]; finished: [review: KaiReview] }>();
const auth = useAuth(), review = ref<KaiReview | null>(null), busy = ref(false), reviewing = ref(false), loading = ref(false), error = ref("");
const page = ref(0);
let conversationEpoch = 0;
const lastPage = computed(() => review.value?.sessionAssessment?.domains.length ?? review.value?.observations.length ?? 0);
const domain = computed(() => review.value?.sessionAssessment?.domains[page.value]);
const earlierReview = computed(() => !!review.value && review.value.assessmentVersion !== KAI_ASSESSMENT_VERSION);
const completionReady = computed(() => props.canReview && review.value && !busy.value && !error.value && page.value >= lastPage.value ? review.value : null);
watch(completionReady, value => emit("completion-ready", value), { immediate: true });
function outcomeReason(reason: string) {
  return ({ learner_skipped: "You skipped this objective.", learner_deferred: "You deferred this objective for later practice.", learner_ended: "The session ended before this objective was covered." } as Record<string, string>)[reason] || reason;
}
function outcomeStatus(status: string) {
  return ({met_for_session:"covered this session",deferred:"deferred · gap retained",partially_met:"partly demonstrated · gap retained",needs_revisit:"needs another session",active:"unresolved",not_started:"not assessed"} as Record<string,string>)[status] || "unresolved";
}
function answerLabel(evidenceId: string) {
  const index = review.value?.evidence?.findIndex(item => item.id === evidenceId) ?? -1;
  return index >= 0 ? "Saved answer " + (index + 1) : "Saved answer";
}
watch(
  () => [props.conversationId, props.canReview] as const,
  async ([id, allowed], previous) => {
    if (!previous || previous[0] !== id) {
      conversationEpoch++;
      review.value = null; page.value = 0; error.value = ""; busy.value = false; reviewing.value = false; loading.value = false;
    }
    if (!allowed || review.value || busy.value) return;
    const epoch = conversationEpoch;
    busy.value = true; loading.value = true;
    try {
      const response = await auth.authorizedFetch<{ review: KaiReview | null }>("/api/study/conversations/" + id + "/review");
      if (epoch !== conversationEpoch) return;
      review.value = response.review;
    } catch {
      /* A read failure leaves explicit review generation available. */
    } finally {
      if (epoch === conversationEpoch) { busy.value = false; loading.value = false; }
    }
    // Loading a retained review never creates a new paid assessment automatically.
    if (epoch === conversationEpoch && props.canReview && !review.value && props.autoGenerate) await generate();
  },
  { immediate: true },
);
async function generate(refresh = false) {
  if (busy.value || reviewRetry.remaining.value || !props.canReview || (refresh && !earlierReview.value)) return;
  const epoch = conversationEpoch, id = props.conversationId;
  busy.value = true; reviewing.value = true; error.value = "";
  try {
    const result = await auth.authorizedFetch<KaiReview>("/api/study/conversations/" + id + "/review", {
      method: "POST", ...(refresh ? {body:{refresh:true,reviewId:review.value!.id}} : {}),
    });
    if (epoch !== conversationEpoch) return;
    review.value = result; page.value = 0;
  } catch (cause: any) {
    if (epoch === conversationEpoch) {
      reviewRetry.retain(cause);
      error.value = cause?.data?.statusMessage || "Kai could not prepare feedback. Your saved practice remains available.";
    }
  } finally {
    if (epoch === conversationEpoch) { busy.value = false; reviewing.value = false; }
  }
}
async function choose(status: "ACCEPTED" | "DISMISSED") {
  if (!review.value || busy.value) return;
  const epoch = conversationEpoch, id = props.conversationId;
  busy.value = true; error.value = "";
  try {
    const result = await auth.authorizedFetch<KaiReview>("/api/study/conversations/" + id + "/next-practice", { method: "POST", body: { reviewId: review.value.id, status } });
    if (epoch === conversationEpoch) review.value = result;
  } catch {
    if (epoch === conversationEpoch) error.value = "The exercise choice was not saved. Retry.";
  } finally { if (epoch === conversationEpoch) busy.value = false; }
}
function finish() { if (completionReady.value) emit("finished", completionReady.value); }
</script>
<template>
  <section class="kai-review" aria-label="Kai evidence review">
    <AgentActivity agent="KAI" state="weaving" :busy="reviewing" :label="reviewing ? 'I’m reviewing your saved evidence.' : loading ? 'Loading your saved feedback.' : busy ? 'Saving your next practice choice.' : 'Your practice feedback'" />
    <template v-if="!review">
      <p>I’ll review your saved explanations against your approved goals.</p>
      <button :disabled="!canReview || busy || !!reviewRetry.remaining.value" @click="generate()">{{ busy ? "Preparing…" : reviewRetry.remaining.value ? `Retry available in ${reviewRetry.remaining.value}s` : "Review my saved practice" }}</button>
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
    <button v-if="error && review" :disabled="busy" @click="error = ''; page = 0">Return to this saved review</button>
    <template v-if="review">
      <section v-if="review.objectiveOutcomes?.length" aria-label="Session outcomes">
        <h3>{{ review.sessionStatus === "covered" ? "Objectives covered this session" : "Session ended with gaps" }}</h3>
        <p v-if="review.closureOnly">No learning evidence was recorded. Understanding was not assessed.</p>
        <ul><li v-for="outcome in review.objectiveOutcomes" :key="outcome.objectiveId"><strong>{{ outcome.title }}</strong>: {{ outcomeStatus(outcome.status) }}<p v-if="outcome.reason">{{ outcomeReason(outcome.reason) }}</p></li></ul>
      </section>
      <aside v-if="earlierReview" class="earlier-review" aria-label="Earlier saved review">
        <p>This earlier review is still available. Refresh asks Kai to prepare verbal skills feedback from your saved answers and keeps the earlier review.</p>
        <button :disabled="busy || !canReview || !!reviewRetry.remaining.value" @click="generate(true)">{{ reviewing ? "Preparing…" : reviewRetry.remaining.value ? `Retry available in ${reviewRetry.remaining.value}s` : "Refresh for verbal skills feedback" }}</button>
      </aside>
      <p v-if="review.sessionAssessment" class="assessment-scope">Feedback uses your saved answers from this session. Audio delivery and durable mastery were not assessed.</p>
      <article v-if="domain" class="skill-card" :aria-label="KAI_VERBAL_LABELS[domain.domain] + ' feedback'">
        <h3>{{ KAI_VERBAL_LABELS[domain.domain] }}</h3>
        <p class="assessment-status">{{ domain.status === 'observed' ? 'Observed in this session' : domain.status === 'partial' ? 'Partly demonstrated' : 'Not assessed' }}</p>
        <p v-if="domain.kind === 'inference'">Inference from saved evidence</p>
        <p>{{ domain.summary }}</p><p v-if="domain.uncertainty">{{ domain.uncertainty }}</p>
        <details v-if="domain.learnerQuotes.length"><summary>Evidence from your answers</summary>
          <figure v-for="quote in domain.learnerQuotes" :key="quote.evidenceId + quote.text" :data-evidence-id="quote.evidenceId"><blockquote>{{ quote.text }}</blockquote><figcaption>{{ answerLabel(quote.evidenceId) }}</figcaption><p>App hints recorded: {{ review.evidence?.find(item => item.id === quote.evidenceId)?.hintsUsed ?? 'unknown' }}. Saved prompts: {{ review.evidence?.find(item => item.id === quote.evidenceId)?.promptsUsed ?? 'unknown' }}.</p><p v-for="uncertainty in review.evidence?.find(item => item.id === quote.evidenceId)?.transcriptionUncertainty || []" :key="uncertainty">Transcription uncertainty: {{ uncertainty }}</p></figure>
        </details>
      </article>
      <template v-if="!review.sessionAssessment">
        <article v-for="(observation, index) in review.observations.slice(page, page + 1)" :key="index">
          <h3>{{ observation.criterionId.toLowerCase() }}</h3><p v-if="observation.kind === 'inference'">Inference from saved evidence</p><p>{{ observation.text }}</p><p v-if="observation.uncertainty">{{ observation.uncertainty }}</p>
          <details><summary>Recorded evidence</summary><p v-for="evidenceId in observation.evidenceIds" :key="evidenceId">{{ review.evidence?.find(item => item.id === evidenceId)?.attempt || "Saved attempt" }}</p></details>
        </article>
      </template>
      <details v-if="review.sessionAssessment && review.observations.length">
        <summary>Observations against your approved focus</summary>
        <article v-for="(observation,index) in review.observations" :key="index"><h3>{{ observation.criterionId.toLowerCase() }}</h3><p v-if="observation.kind === 'inference'">Inference from saved evidence</p><p>{{ observation.text }}</p><p v-if="observation.uncertainty">{{ observation.uncertainty }}</p><blockquote v-for="quote in observation.learnerQuotes || []" :key="quote.evidenceId + quote.text" :data-evidence-id="quote.evidenceId">{{ quote.text }}</blockquote></article>
      </details>
      <details><summary>What this review does not assess</summary><ul><li v-for="item in review.notAssessed" :key="item">{{ item }}</li></ul></details>
      <template v-if="page >= lastPage">
        <h3>Suggested next practice</h3><p>{{ review.nextPractice.goal }}</p><p>{{ review.nextPractice.exercise }}</p>
        <button :disabled="busy" @click="choose('ACCEPTED')">Save next practice</button><button :disabled="busy" @click="choose('DISMISSED')">Dismiss suggestion</button>
        <p role="status">Next exercise: {{ review.nextPracticeStatus.toLowerCase() }}. This does not start a new session.</p>
        <button :disabled="!completionReady" @click="finish">Finish review</button>
      </template>
      <div class="dialog-actions"><button v-if="page > 0" :disabled="busy" @click="page--">Back</button><button v-if="page < lastPage" :disabled="busy" @click="page++">{{ page === lastPage - 1 ? "What to practise next" : review.sessionAssessment ? "Next skill" : "Next observation" }}</button></div>
    </template>
  </section>
</template>
<style scoped>
.kai-review { padding: 0; margin: 0; }
h3 { text-transform: capitalize; font-size: 0.95rem; }
p, li, blockquote, figcaption { font-size: 0.85rem; line-height: 1.6; overflow-wrap: anywhere; }
button { padding: 12px; margin: 4px; border: 1px solid #b8dff3; border-radius: 8px; }
button:disabled { opacity: 0.5; }
article { padding: 12px 0; border-bottom: 1px solid #c7e4f5; }
.earlier-review { padding: 12px; border-left: 3px solid #68aacd; background: #f4fbff; }
.assessment-scope, figcaption { color: #3c6277; }
.assessment-status { font-weight: 600; }
figure { margin: 12px 0; }
blockquote { margin: 8px 0; padding-left: 12px; border-left: 2px solid #b8dff3; white-space: pre-wrap; }
</style>
