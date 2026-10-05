<script setup lang="ts">
import {
  contextDescription,
  type ContextSnapshot,
} from "~/shared/airsOrchestration";
const emit = defineEmits<{ continue: [] }>();
const auth = useAuth(),
  context = ref<ContextSnapshot | null>(null),
  words = ref(""),
  summary = ref(""),
  loading = ref(true),
  busy = ref(false),
  editing = ref(false),
  error = ref("");
let disposed = false,
  timer: ReturnType<typeof setTimeout> | undefined;
const saved = computed(
  () => Boolean(context.value?.recordedAt) && !editing.value,
);
const status = computed(() =>
  busy.value
    ? context.value?.summaryStatus === "PROCESSING"
      ? "I’m preparing my understanding of what you shared."
      : "Saving your context…"
    : saved.value
      ? "I’ve saved your context."
      : "Let’s plan something useful for you.",
);
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const result = await auth.authorizedFetch<{ context: ContextSnapshot }>(
      "/api/study/context",
    );
    if (disposed) return;
    context.value = result.context;
    words.value = contextDescription(result.context);
    summary.value = result.context.summary || "";
    editing.value = !result.context.recordedAt;
    if (result.context.summaryStatus === "PROCESSING") {
      busy.value =
        Date.now() - Date.parse(result.context.operation?.startedAt || "") <
        120000;
      if (busy.value) poll();
      else
        error.value =
          "The summary has not finished. Your words are saved; retry or continue with them.";
    }
  } catch {
    error.value =
      "Your context could not be loaded. Please retry before saving.";
  } finally {
    loading.value = false;
  }
}
function poll() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const result = await auth.authorizedFetch<{ context: ContextSnapshot }>(
        "/api/study/context",
      );
      if (disposed) return;
      if (result.context.revision !== context.value?.revision) {
        error.value =
          "Your context changed in another window. Reload it before continuing.";
        busy.value = false;
        return;
      }
      if (
        (context.value?.summaryStatus === "READY" ||
          context.value?.summaryStatus === "CONFIRMED") &&
        result.context.summaryStatus === "PROCESSING"
      )
        return;
      context.value = result.context;
      summary.value = result.context.summary || "";
      if (result.context.summaryStatus === "PROCESSING") {
        busy.value =
          Date.now() - Date.parse(result.context.operation?.startedAt || "") <
          120000;
        if (busy.value) poll();
        else
          error.value =
            "The summary has not finished. Your words are saved; retry or continue with them.";
      } else {
        busy.value = false;
        if (result.context.summaryStatus === "FAILED")
          error.value =
            "Your words are saved, but I couldn’t prepare a summary. Retry or continue using your words.";
      }
    } catch {
      busy.value = false;
      error.value =
        "Your words are saved. The summary status could not be checked. Reload to check it.";
    }
  }, 1000);
}
async function summarize() {
  if (!context.value) return;
  busy.value = true;
  error.value = "";
  try {
    context.value = { ...context.value, summaryStatus: "PROCESSING" };
    poll();
    const result = await auth.authorizedFetch<ContextSnapshot>(
      "/api/study/context/summary",
      { method: "POST", body: { revision: context.value.revision || "" } },
    );
    if (disposed || result.revision !== context.value.revision) return;
    context.value = result;
    summary.value = result.summary || "";
  } catch {
    await load();
    error.value =
      "Your words are saved, but I couldn’t prepare a summary. Retry or continue using your words.";
  } finally {
    clearTimeout(timer);
    busy.value = false;
  }
}
async function save() {
  if (busy.value || loading.value || !words.value.trim()) return;
  busy.value = true;
  error.value = "";
  try {
    context.value = await auth.authorizedFetch<ContextSnapshot>(
      "/api/study/context",
      {
        method: "PUT",
        body: {
          selfDescription: words.value,
          revision: context.value?.revision || "",
        },
      },
    );
    editing.value = false;
    await summarize();
  } catch {
    error.value =
      "Your new words were not saved. Reload your context or try again.";
  } finally {
    busy.value = false;
  }
}
async function proceed() {
  if (busy.value || !saved.value) return;
  busy.value = true;
  error.value = "";
  try {
    if (summary.value.trim())
      context.value = await auth.authorizedFetch("/api/study/context", {
        method: "PUT",
        body: {
          revision: context.value?.revision || "",
          summary: summary.value,
          confirmSummary: true,
        },
      });
    emit("continue");
  } catch {
    error.value =
      "Your understanding could not be confirmed. Reload and retry.";
  } finally {
    busy.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(timer);
});
</script>
<template>
  <section class="context-card" aria-label="Your learning context">
    <AgentActivity
      v-if="loading"
      agent="MISU"
      :busy="true"
      state="working"
      label="Loading your saved context."
    />
    <template v-else
      ><AgentActivity
        agent="MISU"
        :busy="busy"
        :label="status"
        state="working"
      />
      <div class="context-body">
        <template v-if="editing"
          ><h1>Let’s make this practice yours.</h1>
          <label for="self-context">Share context about yourself</label>
          <p id="context-help">
            Your background, career direction, interests, or conversations you
            want to prepare for. Share only what you want me to use.
          </p>
          <textarea
            id="self-context"
            v-model="words"
            maxlength="2000"
            rows="4"
            aria-describedby="context-help"
            :disabled="busy || (!!error && !context)"
            placeholder="I’m an early-career developer. I also create content, and I want to explain my projects confidently in interviews."
          /><small>{{ words.length }} / 2,000 characters</small></template
        >
        <template v-else
          ><h1>Here’s what I understand.</h1>
          <p v-if="context?.summaryOrigin === 'FIXTURE'">
            Demonstration summary of your words — no model was contacted.
          </p>
          <label for="context-summary">My understanding — you can edit it</label
          ><textarea
            id="context-summary"
            v-model="summary"
            maxlength="700"
            rows="4"
            :disabled="busy"
          />
          <p v-if="!summary">
            I can use your saved words directly if you prefer.
          </p>
        </template>
      </div>
      <footer class="context-footer">
        <p class="privacy">
          Saved privately to your account. Shared with the learning model to
          prepare your session.
        </p>
        <div class="actions">
          <button
            v-if="editing"
            :disabled="busy || !context || !words.trim()"
            @click="save"
          >
            Save context
          </button>
          <template v-else
            ><button :disabled="busy" @click="proceed">Continue</button
            ><button class="secondary" :disabled="busy" @click="editing = true">
              Edit my context</button
            ><button
              v-if="
                context?.summaryStatus === 'FAILED' ||
                context?.summaryStatus === 'NONE' ||
                (context?.summaryStatus === 'PROCESSING' && !busy)
              "
              class="secondary"
              :disabled="busy"
              @click="summarize"
            >
              Retry summary
            </button>
          </template>
        </div>
        <p v-if="error" role="alert">
          {{ error }}
          <button class="secondary" :disabled="busy" @click="load">
            Reload context
          </button>
        </p>
      </footer></template
    >
  </section>
</template>
<style scoped>
.context-card {
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: clamp(16px, 2vw, 24px);
  box-sizing: border-box;
  border: 1px solid #d8e3dc;
  border-radius: 18px;
  background: #fff;
}
.context-card :deep(.agent-activity) {
  margin-bottom: 12px;
  flex: none;
}
.context-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.context-footer {
  flex: none;
  padding-top: 8px;
}
h1 {
  font-size: clamp(1.15rem, 2vw, 1.5rem);
  line-height: 1.25;
  margin: 0 0 14px;
  color: #142924;
}
label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
}
p {
  line-height: 1.45;
  color: #46534f;
  font-size: 0.92rem;
  margin: 8px 0 12px;
}
textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 12px;
  border: 1px solid #adbab5;
  border-radius: 12px;
  background: #fff;
  font: inherit;
  line-height: 1.5;
  min-height: 100px;
  max-height: 220px;
  resize: none;
}
small {
  display: block;
  text-align: right;
  margin: 8px 0;
  color: #46534f;
}
button {
  min-height: 44px;
  padding: 12px 20px;
  background: #173d32;
  color: white;
  border: 1px solid #173d32;
  border-radius: 10px;
  cursor: pointer;
  margin-top: 0;
  font: inherit;
}
.secondary {
  background: transparent;
  color: #173d32;
}
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
button:disabled {
  opacity: 0.55;
  cursor: default;
}
button:active {
  transform: scale(0.98);
}
.privacy {
  font-size: 0.78rem;
  margin: 0 0 10px;
}
textarea:focus-visible,
button:focus-visible {
  outline: 3px solid #608977;
  outline-offset: 3px;
}
</style>
