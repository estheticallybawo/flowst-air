<script setup lang="ts">
import {
  DEFAULT_STUDY_PREFERENCES,
  STUDY_PURPOSE_LABELS,
  type StudyPreferences,
} from "~/shared/study";
import type { SourceDraft } from "~/shared/studyMaterial";
import { learnerStudyError } from "~/shared/studyPresentation";
const auth = useAuth(),
  standalone = ["air", "amira"].includes(useRuntimeConfig().public.appSurface);
const {
  access,
  loading: accessLoading,
  error: accessError,
  refresh: refreshAccess,
} = useAirAccess(standalone);
const step = ref<"context" | "source" | "preferences">("context"),
  mode = ref<"document" | "link">("document"),
  file = ref<File | null>(null),
  ready = ref<SourceDraft | null>(null);
const preview = ref<{
  name: string;
  kind: string;
  excerpt: string;
  sectionCount: number;
  sections: Array<{ label: string; text: string }>;
  omissions: string[];
} | null>(null);
const preferences = ref<StudyPreferences>({ ...DEFAULT_STUDY_PREFERENCES }),
  busy = ref(false),
  sourceBusy = ref(false),
  sourceLabel = ref(""),
  error = ref(""),
  eligibilityLoading = ref(standalone);
const eligibility = ref<{
  canUpload: boolean;
  existingConversationId?: string;
  activeConversationId?: string;
  reason?: string;
} | null>(null);
const heading = ref<HTMLElement | null>(null);
const usable = computed(
  () =>
    !standalone ||
    Boolean(
      eligibility.value?.canUpload && access.value?.allowedActions.UPLOAD,
    ),
);
const valid = computed(
  () =>
    Number.isInteger(preferences.value.timeBudgetMinutes) &&
    preferences.value.timeBudgetMinutes >= 5 &&
    preferences.value.timeBudgetMinutes <= 120 &&
    (preferences.value.purpose !== "OTHER" ||
      Boolean(preferences.value.context.trim())),
);
watch(step, async () => {
  await nextTick();
  heading.value?.focus();
});
watch(mode, () => {
  preview.value = null;
  ready.value = null;
  error.value = "";
});
async function checkAccess() {
  if (!standalone) return;
  eligibilityLoading.value = true;
  error.value = "";
  try {
    eligibility.value = await auth.authorizedFetch(
      "/api/study/upload-eligibility",
    );
  } catch {
    error.value = "Study availability could not be checked. Try again.";
  } finally {
    eligibilityLoading.value = false;
  }
}
onMounted(checkAccess);
async function replaceStudy() {
  const id =
    eligibility.value?.activeConversationId ||
    eligibility.value?.existingConversationId;
  if (
    !id ||
    !window.confirm(
      "Abandon the current plan and end its voice practice permanently? Its saved records remain readable and unfinished objectives stay unfinished.",
    )
  )
    return;
  busy.value = true;
  try {
    await auth.authorizedFetch("/api/study/conversations/" + id + "/abandon", {
      method: "POST",
      body: { confirmAbandon: true },
    });
    await checkAccess();
    await refreshAccess();
  } catch (cause) {
    error.value = learnerStudyError(
      cause,
      "The current study could not be replaced.",
    );
  } finally {
    busy.value = false;
  }
}
function chooseFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] || null;
  preview.value = null;
  error.value = "";
}
async function inspectDocument() {
  if (!file.value || busy.value) return;
  const limit = standalone ? 4000000 : 20 * 1024 * 1024;
  if (file.value.size > limit || !/\.(pdf|docx|pptx)$/i.test(file.value.name)) {
    error.value =
      "Choose a text-based PDF, Word or PowerPoint within the upload limit.";
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const form = new FormData();
    form.set("file", file.value);
    preview.value = await auth.authorizedFetch(
      "/api/study/sources/document-preview",
      { method: "POST", body: form },
    );
  } catch (cause) {
    error.value = learnerStudyError(
      cause,
      "The document could not be read. Try another source.",
    );
  } finally {
    busy.value = false;
  }
}
async function createPlan() {
  if (busy.value || !valid.value || !usable.value) return;
  busy.value = true;
  error.value = "";
  try {
    let created: { id: string };
    if (mode.value === "link" && ready.value)
      created = await auth.authorizedFetch(
        "/api/study/conversations/from-source",
        {
          method: "POST",
          body: {
            sourceId: ready.value.id,
            confirmSource: true,
            preferences: preferences.value,
          },
        },
      );
    else {
      if (!file.value || !preview.value) return;
      const form = new FormData();
      form.set("file", file.value);
      form.set("preferences", JSON.stringify(preferences.value));
      created = await auth.authorizedFetch("/api/study/conversations", {
        method: "POST",
        body: form,
      });
    }
    await navigateTo("/airs/" + created.id);
  } catch (cause) {
    error.value = learnerStudyError(
      cause,
      "Your source could not be saved. Review its status before retrying.",
    );
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <AirStudyShell
    ><main class="misu-setup">
      <nav class="setup-nav" aria-label="Airs navigation">
        <span>Flowst Airs</span
        ><NuxtLink to="/airs/library">Saved sessions</NuxtLink>
      </nav>
      <AirSkeleton
        v-if="standalone && (accessLoading || eligibilityLoading)"
        variant="upload"
        label="Loading your Airs workspace"
      />
      <section
        v-else-if="standalone && (!usable || accessError)"
        class="setup-error"
      >
        <h1>Let’s check your study access.</h1>
        <p>
          {{
            accessError ||
            error ||
            eligibility?.reason ||
            "Finish your current study or review your account access before starting another source."
          }}
        </p>
        <NuxtLink
          v-if="eligibility?.existingConversationId"
          :to="'/airs/' + eligibility.existingConversationId"
          >Continue saved session</NuxtLink
        ><button
          v-if="
            eligibility?.activeConversationId ||
            eligibility?.existingConversationId
          "
          :disabled="busy"
          @click="replaceStudy"
        >
          Replace current study</button
        ><button
          @click="
            checkAccess();
            refreshAccess();
          "
        >
          Check again</button
        ><NuxtLink to="/airs/settings">Account access</NuxtLink>
      </section>
      <template v-else
        ><AirsContextCard
          v-if="step === 'context'"
          @continue="step = 'source'"
        />
        <section v-else class="setup-stage">
          <AgentActivity
            agent="MISU"
            :state="step === 'source' ? 'searching' : 'composing'"
            :busy="busy || sourceBusy"
            :label="
              busy
                ? step === 'source'
                  ? 'I’m reading your document.'
                  : 'I’m saving your source and session choices.'
                : sourceBusy
                  ? sourceLabel
                  : step === 'source'
                    ? 'Your context is saved. Let’s choose your material.'
                    : 'Let’s choose what you want from this practice.'
            "
          />
          <h1 ref="heading" tabindex="-1">
            {{
              step === "source"
                ? "What would you like to practise with?"
                : "What would you like to practise, and for how long?"
            }}
          </h1>
          <div v-show="step === 'source'">
            <fieldset>
              <legend>Bring one source</legend>
              <label
                ><input
                  v-model="mode"
                  type="radio"
                  value="document"
                  :disabled="busy"
                />
                Document</label
              ><label
                ><input
                  v-model="mode"
                  type="radio"
                  value="link"
                  :disabled="busy"
                />
                Link or transcript</label
              >
            </fieldset>
            <AirSourcePicker
              v-if="mode === 'link'"
              @ready="ready = $event"
              @activity="
                (active, label) => {
                  sourceBusy = active;
                  sourceLabel = label;
                }
              "
            />
            <template v-else
              ><label class="field"
                >Choose a document<input
                  type="file"
                  accept=".pdf,.docx,.pptx"
                  :disabled="busy"
                  @change="chooseFile"
              /></label>
              <p>
                Text-based PDF, Word or PowerPoint · up to
                {{ standalone ? "4 MB" : "20 MB" }}.
              </p>
              <button :disabled="busy || !file" @click="inspectDocument">
                {{ busy ? "Reading document…" : "Read document" }}
              </button>
              <section v-if="preview" aria-label="Document review">
                <h2>{{ preview.name }}</h2>
                <p>
                  {{ preview.sectionCount }} readable sections. Review the
                  included text before continuing.
                </p>
                <p>{{ preview.excerpt }}</p>
                <details>
                  <summary>Included material</summary>
                  <article
                    v-for="section in preview.sections"
                    :key="section.label"
                  >
                    <h3>{{ section.label }}</h3>
                    <p>{{ section.text }}</p>
                  </article>
                  <p v-if="preview.sectionCount > preview.sections.length">
                    Showing the first {{ preview.sections.length }} sections in
                    this preview. The plan can reference the extracted source
                    snapshot.
                  </p>
                </details>
                <ul v-if="preview.omissions.length">
                  <li v-for="omission in preview.omissions" :key="omission">
                    {{ omission }}
                  </li>
                </ul>
              </section></template
            >
            <div class="actions">
              <button
                :disabled="
                  busy || sourceBusy || (mode === 'link' ? !ready : !preview)
                "
                @click="step = 'preferences'"
              >
                Use this source</button
              ><button
                class="secondary"
                :disabled="busy || sourceBusy"
                @click="step = 'context'"
              >
                Edit my context
              </button>
            </div>
          </div>
          <div v-if="step === 'preferences'">
            <label class="field"
              >What is this session for?<select v-model="preferences.purpose">
                <option
                  v-for="(label, value) in STUDY_PURPOSE_LABELS"
                  :key="value"
                  :value="value"
                >
                  {{ label }}
                </option>
              </select></label
            ><label class="field"
              >How much time do you have?<input
                v-model.number="preferences.timeBudgetMinutes"
                type="number"
                min="5"
                max="120"
                inputmode="numeric"
              /><small
                >5–120 minutes available. Activity times are estimates.</small
              ></label
            >
            <details :open="preferences.purpose === 'OTHER'">
              <summary>Adjust scope or add a focus</summary>
              <label class="field"
                >Coverage<select v-model="preferences.scope">
                  <option value="FOCUSED">One useful goal</option>
                  <option value="BROAD">The main ideas</option>
                </select></label
              ><label class="field"
                >Anything to keep in focus?<textarea
                  v-model="preferences.context"
                  maxlength="600"
                  rows="3"
                  :required="preferences.purpose === 'OTHER'"
                />
              </label>
            </details>
            <p v-if="!valid" role="alert">
              Choose 5–120 whole minutes and add a goal for “Something else.”
            </p>
            <div class="actions">
              <button :disabled="busy || !valid" @click="createPlan">
                {{ busy ? "Saving source…" : "Draft my plan" }}</button
              ><button
                class="secondary"
                :disabled="busy"
                @click="step = 'source'"
              >
                Review source
              </button>
            </div>
          </div>
          <p v-if="error" role="alert">{{ error }}</p>
        </section></template
      >
    </main></AirStudyShell
  >
</template>
<style scoped>
.misu-setup {
  max-width: 760px;
  width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 24px clamp(12px, 3vw, 32px) 64px;
  color: #142924;
}
.setup-nav {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 32px;
  font-size: 0.85rem;
}
.setup-nav a {
  color: #234d40;
}
.setup-stage {
  padding: 24px 0;
}
h1 {
  font-size: clamp(1.5rem, 3vw, 2rem);
  line-height: 1.3;
  max-width: 28ch;
  margin: 0 0 28px;
}
h2 {
  font-size: 1.15rem;
}
h3 {
  font-size: 1rem;
}
p,
small {
  line-height: 1.6;
  color: #46534f;
  overflow-wrap: anywhere;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0 0 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}
legend {
  margin-bottom: 12px;
  font-weight: 600;
}
fieldset label {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 44px;
}
.field {
  display: block;
  margin: 20px 0;
  font-weight: 600;
}
.field input:not([type="radio"]),
select,
textarea {
  display: block;
  margin-top: 8px;
  box-sizing: border-box;
  width: 100%;
  padding: 14px;
  border: 1px solid #adbab5;
  border-radius: 10px;
  background: white;
  font: inherit;
  line-height: 1.5;
}
.field small {
  display: block;
  font-weight: 400;
  margin-top: 8px;
}
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 24px;
}
button {
  min-height: 44px;
  padding: 12px 20px;
  background: #173d32;
  color: white;
  border: 1px solid #173d32;
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
}
.secondary {
  background: transparent;
  color: #173d32;
}
button:disabled {
  opacity: 0.55;
  cursor: default;
}
button:active {
  transform: scale(0.98);
}
button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
summary:focus-visible {
  outline: 3px solid #608977;
  outline-offset: 3px;
}
details {
  padding: 16px 0;
  border-top: 1px solid #d9e1dd;
  border-bottom: 1px solid #d9e1dd;
}
summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
}
article {
  border-top: 1px solid #d9e1dd;
  padding: 12px 0;
}
.setup-error {
  display: grid;
  gap: 16px;
}
input[type="radio"] {
  accent-color: #173d32;
}
@media (prefers-reduced-motion: no-preference) {
  button {
    transition: transform 160ms ease-out;
  }
}
</style>
