<script setup lang="ts">
import type { KaiReview } from "~/shared/airsOrchestration";
const props = defineProps<{ conversationId: string; canReview: boolean }>();
const auth = useAuth(),
  review = ref<KaiReview | null>(null),
  busy = ref(false),
  reviewing = ref(false),
  error = ref("");
const page = ref(0);
watch(
  () => props.canReview,
  async (allowed) => {
    if (!allowed || review.value) return;
    try {
      review.value = (
        await auth.authorizedFetch<{ review: KaiReview | null }>(
          "/api/study/conversations/" + props.conversationId + "/review",
        )
      ).review;
    } catch {
      /* The learner can still request a review. */
    }
  },
  { immediate: true },
);
async function generate() {
  busy.value = true;
  reviewing.value = true;
  error.value = "";
  try {
    review.value = await auth.authorizedFetch<KaiReview>(
      "/api/study/conversations/" + props.conversationId + "/review",
      { method: "POST" },
    );
    page.value = 0;
  } catch (cause: any) {
    error.value =
      cause?.data?.statusMessage ||
      "Kai could not prepare feedback. Your saved practice remains available.";
  } finally {
    busy.value = false;
    reviewing.value = false;
  }
}
async function choose(status: "ACCEPTED" | "DISMISSED") {
  if (!review.value) return;
  busy.value = true;
  try {
    review.value = await auth.authorizedFetch<KaiReview>(
      "/api/study/conversations/" + props.conversationId + "/next-practice",
      { method: "POST", body: { reviewId: review.value.id, status } },
    );
  } catch {
    error.value = "The exercise choice was not saved. Retry.";
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="kai-review" aria-label="Kai evidence review">
    <AgentActivity
      agent="KAI"
      state="weaving"
      :busy="reviewing"
      :label="
        reviewing
          ? 'I’m reviewing your saved evidence.'
          : busy
            ? 'Saving your next practice choice.'
            : 'Your practice feedback'
      "
    />
    <p v-if="!review">
      I’ll review your saved explanations against your approved goals.
    </p>
    <button v-if="!review" :disabled="!canReview || busy" @click="generate">
      {{ busy ? "Preparing…" : "Review my saved practice" }}
    </button>
    <p role="status">{{ error }}</p>
    <template v-if="review"
      ><article
        v-for="(observation, index) in review.observations.slice(
          page,
          page + 1,
        )"
        :key="index"
      >
        <h3>{{ observation.criterionId.toLowerCase() }}</h3>
        <p>{{ observation.text }}</p>
        <details>
          <summary>Recorded evidence</summary>
          <p v-for="evidenceId in observation.evidenceIds" :key="evidenceId">
            {{
              review.evidence?.find((item) => item.id === evidenceId)
                ?.attempt || "Saved attempt"
            }}
          </p>
        </details>
      </article>
      <details>
        <summary>What this review does not assess</summary>
        <ul>
          <li v-for="item in review.notAssessed" :key="item">{{ item }}</li>
        </ul>
      </details>
      <template v-if="page >= review.observations.length"
        ><h3>Suggested next practice</h3>
        <p>{{ review.nextPractice.goal }}</p>
        <p>{{ review.nextPractice.exercise }}</p>
        <button :disabled="busy" @click="choose('ACCEPTED')">
          Save next practice</button
        ><button :disabled="busy" @click="choose('DISMISSED')">
          Dismiss suggestion
        </button>
        <p role="status">
          Next exercise: {{ review.nextPracticeStatus.toLowerCase() }}. This
          does not start a new session.
        </p></template
      >
      <div class="dialog-actions">
        <button v-if="page > 0" @click="page--">Back</button
        ><button v-if="page < review.observations.length" @click="page++">
          {{
            page === review.observations.length - 1
              ? "What to practise next"
              : "Next observation"
          }}
        </button>
      </div></template
    >
  </section>
</template>
<style scoped>
.kai-review {
  padding: 0;
  margin: 0;
}
header {
  display: flex;
  gap: 12px;
  align-items: center;
}
h2 {
  font-size: 1.1rem;
}
h3 {
  text-transform: capitalize;
  font-size: 0.95rem;
}
p,
li {
  font-size: 0.85rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
button {
  padding: 12px;
  margin: 4px;
  border: 1px solid #bfc6d2;
  border-radius: 8px;
}
button:disabled {
  opacity: 0.5;
}
article {
  padding: 12px 0;
  border-bottom: 1px solid #dbdee5;
}
</style>
