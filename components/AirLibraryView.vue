<script setup lang="ts">
import {
  BookOpenText,
  CircleAlert,
  FileUp,
  MessageCircle,
  Mic2,
  Trash2,
} from "lucide-vue-next";
import {
  DEFAULT_STUDY_PREFERENCES,
  STUDY_PURPOSE_LABELS,
  type StudyDocument,
  type StudyMode,
  type StudyPreferences,
  type StudyPurpose,
} from "~/shared/study";
import { learnerStudyError } from "~/shared/studyPresentation";
import type { SourceDraft } from "~/shared/studyMaterial";

const props = withDefaults(
  defineProps<{ uploadOnly?: boolean; libraryOnly?: boolean }>(),
  {
    uploadOnly: false,
    libraryOnly: false,
  },
);
const auth = useAuth();
const standaloneAir = ["air", "amira"].includes(
  useRuntimeConfig().public.appSurface,
);
useHead({
  title: "Flowst Airs · Bring Your Source",
});
const {
  access,
  loading: accessLoading,
  error: accessError,
  refresh: refreshAccess,
} = useAirAccess(standaloneAir);
const maxUploadBytes = standaloneAir ? 4_000_000 : 20 * 1024 * 1024;
const items = ref<
  Array<{
    id: string;
    document: StudyDocument;
    mode: StudyMode;
    planStatus: string;
    updatedAt: string;
    abandonedAt?: string;
  }>
>([]);
const eligibility = ref<{
  canUpload: boolean;
  existingConversationId?: string;
  activeConversationId?: string;
  reason?: string;
  completionRequired?: boolean;
} | null>(null);
const file = ref<File | null>(null);
const sourceMode = ref<"document" | "link">(
  useRoute().query.source ? "link" : "document",
);
const readySource = ref<SourceDraft | null>(null);
watch(sourceMode, () => {
  readySource.value = null;
  error.value = "";
});
const preferences = ref<StudyPreferences>({ ...DEFAULT_STUDY_PREFERENCES });
const purposes = Object.entries(STUDY_PURPOSE_LABELS) as [
  StudyPurpose,
  string,
][];
const validTime = computed(
  () =>
    Number.isInteger(preferences.value.timeBudgetMinutes) &&
    preferences.value.timeBudgetMinutes >= 5 &&
    preferences.value.timeBudgetMinutes <= 120,
);
const validContext = computed(
  () =>
    preferences.value.context.trim().length <= 600 &&
    (preferences.value.purpose !== "OTHER" ||
      Boolean(preferences.value.context.trim())),
);
const fileTooLarge = computed(() =>
  Boolean(file.value && file.value.size > maxUploadBytes),
);
const fileUnsupported = computed(() =>
  Boolean(file.value && !/\.(pdf|docx|pptx)$/i.test(file.value.name)),
);
const busy = ref(false);
const abandoning = ref(false);
const error = ref("");
const libraryLoading = ref(true);
const libraryError = ref("");
const eligibilityLoading = ref(standaloneAir);
const eligibilityError = ref("");
const checkingUploadAccess = computed(
  () => standaloneAir && (accessLoading.value || eligibilityLoading.value),
);

watch(file, () => {
  error.value = "";
});

async function load() {
  libraryLoading.value = true;
  libraryError.value = "";
  try {
    items.value = await auth.authorizedFetch("/api/study/conversations");
  } catch (cause: any) {
    libraryError.value = learnerStudyError(
      cause,
      "Your study chats could not be loaded. Try again.",
    );
  } finally {
    libraryLoading.value = false;
  }
}

async function loadEligibility() {
  if (!standaloneAir) return;
  eligibilityLoading.value = true;
  eligibilityError.value = "";
  eligibility.value = null;
  try {
    eligibility.value = await auth.authorizedFetch(
      "/api/study/upload-eligibility",
    );
  } catch (cause: any) {
    eligibilityError.value = learnerStudyError(
      cause,
      "We could not check whether you can start a new session. Please try again.",
    );
  } finally {
    eligibilityLoading.value = false;
  }
}

onMounted(() => {
  if (!props.uploadOnly) void load();
  void loadEligibility();
});

async function upload() {
  if (
    (sourceMode.value === "document" ? !file.value : !readySource.value) ||
    busy.value ||
    (sourceMode.value === "document" &&
      (fileTooLarge.value || fileUnsupported.value)) ||
    !validTime.value ||
    !validContext.value ||
    (standaloneAir &&
      (!eligibility.value?.canUpload || !access.value?.allowedActions.UPLOAD))
  )
    return;
  busy.value = true;
  error.value = "";
  try {
    if (sourceMode.value === "link" && readySource.value) {
      const created = await auth.authorizedFetch<{ id: string }>(
        "/api/study/conversations/from-source",
        {
          method: "POST",
          body: {
            sourceId: readySource.value.id,
            confirmSource: true,
            preferences: {
              ...preferences.value,
              context: preferences.value.context.trim(),
            },
          },
        },
      );
      await navigateTo(`/airs/${created.id}`);
      return;
    }
    const form = new FormData();
    form.set("file", file.value!);
    form.set(
      "preferences",
      JSON.stringify({
        ...preferences.value,
        context: preferences.value.context.trim(),
      }),
    );
    const created = await auth.authorizedFetch<{ id: string }>(
      "/api/study/conversations",
      { method: "POST", body: form },
    );
    await navigateTo(`/airs/${created.id}`);
  } catch (cause: any) {
    error.value = learnerStudyError(
      cause,
      "Flowst Airs could not read that file. Try another text-based document.",
    );
    if ([403, 409].includes(cause?.statusCode || cause?.status)) {
      void loadEligibility();
      void refreshAccess();
    }
  } finally {
    busy.value = false;
  }
}

function pickDroppedFile(event: DragEvent) {
  if (busy.value) return;
  file.value = event.dataTransfer?.files[0] || null;
}

async function remove(id: string) {
  if (
    !window.confirm(
      standaloneAir
        ? "Delete this document and all saved practice? Deleting an unfinished session does not mark its objectives complete or unlock another upload."
        : "Delete this document, its study chat, and all saved practice?",
    )
  )
    return;
  try {
    await auth.authorizedFetch(`/api/study/conversations/${id}`, {
      method: "DELETE",
    });
    items.value = items.value.filter((item) => item.id !== id);
    await loadEligibility();
    if (standaloneAir) await refreshAccess();
  } catch (cause: any) {
    error.value = learnerStudyError(
      cause,
      "The study chat could not be deleted. Try again.",
    );
  }
}

async function replaceCurrentDocument() {
  const activeId =
    eligibility.value?.activeConversationId ||
    eligibility.value?.existingConversationId;
  if (
    !activeId ||
    abandoning.value ||
    !window.confirm(
      "Abandon your current plan and replace its document? Voice practice on this plan will end permanently. Its objectives remain unfinished, and any saved records remain readable. This allows a new upload without deleting saved records.",
    )
  )
    return;
  abandoning.value = true;
  error.value = "";
  try {
    await auth.authorizedFetch(`/api/study/conversations/${activeId}/abandon`, {
      method: "POST",
      body: { confirmAbandon: true },
    });
    await Promise.all([
      loadEligibility(),
      refreshAccess(),
      props.uploadOnly ? Promise.resolve() : load(),
    ]);
  } catch (cause: any) {
    error.value = learnerStudyError(
      cause,
      "Your current plan could not be abandoned. Please try again.",
    );
  } finally {
    abandoning.value = false;
  }
}
</script>

<style scoped>
.source-choice {
  grid-column: 1/-1;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  border: 0;
  padding: 0;
  margin: 0.5rem 0;
}
.source-choice legend {
  font-weight: 600;
  margin-bottom: 0.6rem;
}
.source-choice label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.source-picker {
  grid-column: 1/-1;
}
</style>

<template>
  <AirStudyShell>
    <div class="air-library">
      <header v-if="!props.uploadOnly" class="intro">
        <div class="intro-copy">
          <div class="identity">
            <AgentAvatar agent="AMIRA" /><span
              >Flowst Airs · Your study space</span
            >
          </div>
          <h1>Bring the notes.<br /><em>Own the idea.</em></h1>
          <p>
            Bring one source. Review a source-backed plan, then practise
            explaining the ideas aloud with Amina.
          </p>
        </div>
        <div class="intro-image">
          <img
            :src="
              standaloneAir
                ? '/mascots/amina.png'
                : '/optimized/v1/mascots/amina/portrait.webp'
            "
            alt="Amina, your voice study companion"
            width="768"
            height="1024"
            decoding="async"
          />
        </div>
      </header>

      <header v-if="props.uploadOnly" class="air-page-heading">
        <p class="air-eyebrow">A fresh conversation</p>
        <h1>Create a new learning session</h1>
        <p>
          Choose your material and tell Misu what you need from it. Your
          source-backed plan will use your goal and available time.
        </p>
      </header>
      <template v-if="!props.libraryOnly">
        <p v-if="standaloneAir && accessError" class="air-error" role="alert">
          {{ accessError }} <button @click="refreshAccess">Try again</button>
        </p>
        <section
          v-else-if="standaloneAir && access?.tier === 'RESTRICTED'"
          class="air-panel"
        >
          <h2>Study access is currently unavailable</h2>
          <p>You can still read or delete your saved material.</p>
          <NuxtLink class="air-text-link" to="/airs/settings"
            >Review account access</NuxtLink
          >
        </section>
        <p
          v-else-if="standaloneAir && eligibilityError"
          class="air-error"
          role="alert"
        >
          {{ eligibilityError }}
          <button @click="loadEligibility">Try again</button>
        </p>
        <AirSkeleton
          v-else-if="checkingUploadAccess"
          :variant="props.uploadOnly ? 'upload' : 'access'"
          label="Checking study access and upload availability"
        />
        <p v-else-if="standaloneAir && !access" class="air-error" role="alert">
          Your study access could not be confirmed.
          <button @click="refreshAccess">Try again</button>
        </p>
        <AirSkeleton
          v-else-if="abandoning"
          variant="access"
          label="Abandoning the current plan and refreshing upload access"
        />
        <AirSkeleton
          v-else-if="busy"
          variant="upload"
          with-preferences
          :label="
            sourceMode === 'document'
              ? 'Uploading your document and requesting a session plan'
              : 'Saving your reviewed source and requesting a session plan'
          "
        />
        <section
          v-else-if="
            !standaloneAir || (props.uploadOnly && eligibility?.canUpload)
          "
          class="upload-card"
          aria-labelledby="upload-heading"
        >
          <div class="upload-symbol"><FileUp :size="26" /></div>
          <div>
            <h2 id="upload-heading">Start a study chat</h2>
            <p v-if="sourceMode === 'document'">
              PDF, Word, or PowerPoint · text-based · up to
              {{ standaloneAir ? "4 MB" : "20 MB" }}.
            </p>
          </div>
          <fieldset class="source-choice">
            <legend>Bring your source</legend>
            <label
              ><input v-model="sourceMode" type="radio" value="document" />
              Document</label
            >
            <label
              ><input v-model="sourceMode" type="radio" value="link" /> Link or
              transcript</label
            >
          </fieldset>
          <AirSourcePicker
            v-if="sourceMode === 'link'"
            @ready="readySource = $event"
          />
          <label
            v-if="sourceMode === 'document'"
            class="file-picker"
            @dragover.prevent
            @drop.prevent="pickDroppedFile"
          >
            <span>{{ file?.name || "Choose or drop a document" }}</span>
            <input
              type="file"
              accept=".pdf,.docx,.pptx"
              @change="
                file = ($event.target as HTMLInputElement).files?.[0] || null
              "
            />
          </label>
          <section
            v-if="
              sourceMode === 'link'
                ? !!readySource
                : file && !fileTooLarge && !fileUnsupported
            "
            class="study-preferences"
            aria-labelledby="preferences-heading"
          >
            <div class="preferences-intro">
              <h3 id="preferences-heading">Make it useful for you</h3>
              <p>
                Your choices are saved with this session and used to prepare the
                plan.
                {{
                  sourceMode === "document"
                    ? "Nothing is uploaded until you choose Create session plan."
                    : "Create session plan confirms the source you reviewed above."
                }}
              </p>
            </div>
            <label class="preference-field"
              ><span>What is this session for?</span
              ><select v-model="preferences.purpose">
                <option
                  v-for="[purpose, label] in purposes"
                  :key="purpose"
                  :value="purpose"
                >
                  {{ label }}
                </option>
              </select></label
            >
            <label class="preference-field"
              ><span>How much time do you have?</span>
              <div class="minutes-input">
                <input
                  v-model.number="preferences.timeBudgetMinutes"
                  type="number"
                  min="5"
                  max="120"
                  step="1"
                  inputmode="numeric"
                  aria-describedby="time-choice-help"
                /><span>minutes</span>
              </div>
              <small id="time-choice-help"
                >5–120 minutes. A planning estimate, not a fixed finish
                time.</small
              ></label
            >
            <fieldset class="scope-field">
              <legend>How much would you like to cover?</legend>
              <div class="scope-options">
                <label class="scope-option"
                  ><input
                    v-model="preferences.scope"
                    type="radio"
                    value="FOCUSED"
                  /><span
                    ><strong>Focused</strong
                    ><small>One useful goal</small></span
                  ></label
                ><label class="scope-option"
                  ><input
                    v-model="preferences.scope"
                    type="radio"
                    value="BROAD"
                  /><span
                    ><strong>Broad</strong><small>The main ideas</small></span
                  ></label
                >
              </div>
            </fieldset>
            <label class="preference-field preference-brief"
              ><span
                >{{
                  preferences.purpose === "OTHER"
                    ? "What would you like to work toward?"
                    : "Anything to keep in focus?"
                }}
                <small>{{
                  preferences.purpose === "OTHER" ? "(required)" : "(optional)"
                }}</small></span
              ><textarea
                v-model="preferences.context"
                rows="2"
                maxlength="600"
                :required="preferences.purpose === 'OTHER'"
                placeholder="For example: a junior AI interview, focusing on how to explain the main concepts."
              />
            </label>
            <p v-if="!validTime" class="preference-error" role="alert">
              Choose a whole number of minutes between 5 and 120.
            </p>
            <p v-if="!validContext" class="preference-error" role="alert">
              Add a brief goal so Misu can propose a relevant plan.
            </p>
          </section>
          <button
            class="start-button"
            type="button"
            :disabled="
              (sourceMode === 'document'
                ? !file || fileTooLarge || fileUnsupported
                : !readySource) ||
              !validTime ||
              !validContext ||
              busy ||
              (standaloneAir && !access?.allowedActions.UPLOAD)
            "
            @click="upload"
          >
            {{
              busy
                ? sourceMode === "document"
                  ? "Uploading and reading…"
                  : "Saving reviewed source…"
                : "Create session plan"
            }}
          </button>
        </section>
        <p v-else-if="!eligibility" class="air-error" role="alert">
          Your upload availability could not be confirmed.
          <button @click="loadEligibility">Try again</button>
        </p>
        <section
          v-else-if="!eligibility.canUpload"
          class="upload-locked"
          aria-label="Current session needs completion"
        >
          <div class="upload-symbol"><BookOpenText :size="26" /></div>
          <div>
            <h2>
              {{
                eligibility.existingConversationId
                  ? "Continue your current session"
                  : "Your previous plan is unfinished"
              }}
            </h2>
            <p>
              {{
                eligibility.reason ||
                "Finish the agreed objectives in your current session, or explicitly abandon its plan before starting another document."
              }}
            </p>
          </div>
          <div class="upload-locked-actions">
            <NuxtLink
              v-if="eligibility.existingConversationId"
              :to="`/airs/${eligibility.existingConversationId}`"
              >Continue with Amina</NuxtLink
            ><button
              v-if="
                eligibility.activeConversationId ||
                eligibility.existingConversationId
              "
              type="button"
              :disabled="abandoning"
              @click="replaceCurrentDocument"
            >
              Replace study document
            </button>
          </div>
        </section>
        <div v-else class="air-library-start">
          <NuxtLink class="air-button" to="/airs/new"
            >Start a new session</NuxtLink
          >
          <p>One resource. A plan you can review. Room to practise.</p>
        </div>
        <p
          v-if="sourceMode === 'document' && fileTooLarge"
          class="error"
          role="alert"
        >
          <CircleAlert :size="17" /> This file is over the
          {{ standaloneAir ? "4 MB" : "20 MB" }} limit. Choose a smaller
          document.
        </p>
        <p
          v-if="sourceMode === 'document' && fileUnsupported"
          class="error"
          role="alert"
        >
          Choose a text-based PDF, DOCX, or PPTX document.
        </p>
        <p v-if="error" class="error" role="alert">
          <CircleAlert :size="17" /> {{ error }}
        </p>
      </template>
      <section
        v-if="!props.uploadOnly"
        id="library"
        class="saved"
        aria-labelledby="saved-heading"
      >
        <div class="saved-head">
          <h2 id="saved-heading">Your study chats</h2>
          <span v-if="!libraryLoading && !libraryError"
            >{{ items.length }}
            {{ items.length === 1 ? "source" : "sources" }}</span
          >
        </div>
        <AirSkeleton
          v-if="libraryLoading"
          variant="documents"
          label="Loading saved sources"
        />
        <p v-else-if="libraryError" class="air-error" role="alert">
          {{ libraryError }} <button @click="load">Try again</button>
        </p>
        <p v-else-if="!items.length" class="empty">
          {{
            eligibility && !eligibility.canUpload
              ? eligibility.reason ||
                "Your current session needs completion before another document can be added."
              : "Bring a source to begin your first conversation."
          }}
        </p>
        <div v-else class="chat-grid">
          <article v-for="item in items" :key="item.id" class="chat-card">
            <div class="document-icon"><BookOpenText :size="21" /></div>
            <span class="kind"
              >{{ item.document.kind }} ·
              {{ item.document.sectionCount }} sections ·
              {{
                item.abandonedAt
                  ? "Read-only · Ended early"
                  : item.planStatus === "APPROVED"
                    ? "Saved plan"
                    : item.planStatus === "FAILED"
                      ? "Plan needs retry"
                      : item.planStatus === "PENDING"
                        ? "Plan pending"
                        : "Plan review"
              }}</span
            >
            <h3>{{ item.document.title || item.document.name }}</h3>
            <small
              v-if="
                item.document.title &&
                item.document.title !== item.document.name
              "
              class="original-file"
              >{{ item.document.name }}</small
            >
            <p>{{ item.document.excerpt }}</p>
            <div class="chat-actions">
              <NuxtLink
                :to="`/airs/${item.id}`"
                :aria-label="
                  item.abandonedAt
                    ? `View saved conversation for ${item.document.name}`
                    : undefined
                "
                ><MessageCircle :size="16" />
                {{ item.abandonedAt ? "View saved" : "Continue" }}
                <Mic2 v-if="!item.abandonedAt" :size="15"
              /></NuxtLink>
              <button
                type="button"
                :aria-label="`Delete ${item.document.name}`"
                @click="remove(item.id)"
              >
                <Trash2 :size="17" />
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </AirStudyShell>
</template>

<style scoped>
.air-library {
  padding: 15px 0 70px;
}
.intro {
  position: relative;
  min-height: 332px;
  padding: 38px 42px;
  display: flex;
  align-items: center;
  overflow: hidden;
  border-radius: 34px;
  background:
    radial-gradient(circle at 45% 110%, #bae6fd 0, transparent 42%),
    linear-gradient(110deg, #eef8ff 0%, #e0f2fe 100%);
}
.intro::before {
  position: absolute;
  top: -160px;
  left: 46%;
  width: 360px;
  height: 360px;
  border: 1px solid rgba(2, 132, 199, 0.15);
  border-radius: 50%;
  box-shadow:
    0 0 0 40px rgba(255, 255, 255, 0.09),
    0 0 0 82px rgba(255, 255, 255, 0.07);
  content: "";
}
.intro-copy {
  position: relative;
  z-index: 1;
  width: 70%;
}
.identity {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #0369a1;
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.intro h1 {
  margin: 20px 0 15px;
  font-size: clamp(2.7rem, 6vw, 5.35rem);
  line-height: 0.99;
  letter-spacing: -0.06em;
  text-wrap: balance;
}
.intro h1 em {
  color: #0369a1;
  font-style: normal;
}
.intro p {
  max-width: 49ch;
  margin: 0;
  color: #475569;
  font-size: 0.9rem;
  line-height: 1.65;
}
.intro-image {
  position: absolute;
  inset: 0 0 0 auto;
  width: 34%;
  background: #bae6fd;
}
.intro-image::before {
  position: absolute;
  z-index: 1;
  inset: 0;
  background: linear-gradient(90deg, #e0f2fe 0%, transparent 29%);
  content: "";
}
.intro-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 17%;
}
.upload-card,
.upload-locked {
  margin: 24px 0 18px;
  padding: 24px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 18px;
  border-radius: 25px;
  background: #f8fcff;
  box-shadow: 0 14px 36px rgba(2, 80, 125, 0.08);
}
.upload-locked {
  grid-template-columns: auto minmax(0, 1fr) auto;
  background: #e0f2fe;
}
.upload-locked-actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}
.upload-locked-actions button {
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid #c7e4f5;
  border-radius: 12px;
  background: #fff;
  color: #475569;
  font-size: 0.85rem;
  cursor: pointer;
}
.upload-locked-actions button:focus-visible {
  outline: 3px solid #0369a1;
  outline-offset: 3px;
}
.upload-symbol,
.document-icon {
  width: 53px;
  height: 53px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: #0369a1;
  background: #e0f2fe;
}
.upload-card h2,
.upload-locked h2 {
  margin: 0 0 4px;
  font-size: 1.17rem;
  letter-spacing: -0.02em;
}
.upload-card p,
.upload-locked p {
  margin: 0;
  color: #475569;
  font-size: 0.78rem;
  line-height: 1.45;
}
.file-picker {
  max-width: 230px;
  min-height: 46px;
  padding: 12px 16px;
  position: relative;
  overflow: hidden;
  border: 1px solid #b8dff3;
  border-radius: 15px;
  background: #fff;
  cursor: pointer;
  font-size: 0.77rem;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-picker input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.file-picker:focus-within,
.start-button:focus-visible,
.chat-actions a:focus-visible,
.chat-actions button:focus-visible,
.upload-locked a:focus-visible {
  outline: 3px solid #0284c7;
  outline-offset: 3px;
}
.study-preferences {
  grid-column: 1/-1;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  padding-top: 24px;
  border-top: 1px solid #c7e4f5;
  text-align: left;
}
.preferences-intro,
.scope-field,
.preference-brief,
.preference-error {
  grid-column: 1/-1;
}
.preferences-intro h3 {
  margin: 0 0 7px;
  font-size: 1rem;
  line-height: 1.4;
}
.preference-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  color: #102b3f;
  font-size: 0.875rem;
  font-weight: 600;
}
.preference-field > small,
.preference-field > span > small,
.scope-option small {
  color: #475569;
  font-weight: 400;
  font-size: 0.8rem;
  line-height: 1.4;
}
.preference-field select,
.preference-field textarea,
.minutes-input {
  min-height: 46px;
  width: 100%;
  min-width: 0;
  border: 1px solid #c7e4f5;
  border-radius: 12px;
  background: #fff;
  color: #102b3f;
}
.preference-field select,
.preference-field textarea {
  padding: 11px 13px;
  font: inherit;
  font-weight: 400;
}
.preference-field textarea {
  resize: vertical;
  min-height: 82px;
}
.minutes-input {
  display: flex;
  align-items: center;
  padding-right: 13px;
}
.minutes-input input {
  min-width: 0;
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: transparent;
  padding: 11px 13px;
  color: #102b3f;
  font: inherit;
  font-weight: 400;
}
.minutes-input > span {
  color: #475569;
  font-size: 0.85rem;
  font-weight: 400;
}
.scope-field {
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
}
.scope-field legend {
  margin-bottom: 10px;
  padding: 0;
  color: #102b3f;
  font-size: 0.875rem;
  font-weight: 600;
}
.scope-options {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}
.scope-option {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 66px;
  padding: 12px 14px;
  border: 1px solid #c7e4f5;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}
.scope-option:has(input:checked) {
  background: #e0f2fe;
  border-color: #0369a1;
}
.scope-option input {
  width: 17px;
  height: 17px;
  margin: 0;
  accent-color: #0369a1;
}
.scope-option > span {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.scope-option strong {
  color: #102b3f;
  font-size: 0.875rem;
  font-weight: 600;
}
.preference-field select:focus-visible,
.preference-field textarea:focus-visible,
.minutes-input:focus-within,
.scope-option:focus-within {
  outline: 3px solid #0369a1;
  outline-offset: 3px;
}
.minutes-input input:focus {
  outline: none;
}
.preference-error {
  margin: 0;
  color: #9b2929;
  font-size: 0.85rem;
}
.study-preferences + .start-button {
  grid-column: 1/-1;
  width: 100%;
}
.start-button,
.chat-actions a,
.upload-locked a {
  min-height: 46px;
  padding: 0 19px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 15px;
  background: #0369a1;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 850;
  transition:
    transform 0.18s ease,
    background 0.18s ease;
}
.start-button:hover:not(:disabled),
.chat-actions a:hover,
.upload-locked a:hover {
  transform: translateY(-2px);
  background: #075985;
}
.start-button:active:not(:disabled),
.chat-actions a:active,
.upload-locked a:active {
  transform: translateY(1px);
}
.start-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.error {
  margin: 12px 0;
  padding: 13px 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-left: 4px solid #b63425;
  border-radius: 11px;
  background: #fff4f2;
  color: #9b2929;
  font-size: 0.82rem;
}
.saved {
  margin-top: 43px;
}
.saved-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.saved-head h2 {
  font-size: 1.68rem;
  letter-spacing: -0.035em;
}
.saved-head span {
  color: var(--ink-soft);
  font-size: 0.78rem;
}
.empty {
  padding: 35px;
  border-radius: 22px;
  background: #ffffffaf;
  color: var(--ink-soft);
}
.chat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.chat-card {
  min-height: 260px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(2, 80, 125, 0.07);
}
.kind {
  margin: 15px 0 6px;
  color: #0369a1;
  font-size: 0.68rem;
  font-weight: 850;
}
.chat-card h3 {
  margin: 0;
  font-size: 1.12rem;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.original-file {
  display: block;
  margin-top: 6px;
  color: #64748b;
  font-size: 0.66rem;
  overflow-wrap: anywhere;
}
.chat-card p {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  color: var(--ink-soft);
  font-size: 0.78rem;
  line-height: 1.55;
}
.chat-actions {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chat-actions button {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  color: #9b2929;
  background: #fff4f2;
}
@media (max-width: 900px) {
  .upload-card {
    grid-template-columns: auto 1fr;
  }
  .file-picker,
  .start-button {
    grid-column: 1/-1;
    max-width: none;
    width: 100%;
  }
}
@media (max-width: 650px) {
  .intro {
    min-height: 300px;
    padding: 27px 23px;
  }
  .intro-copy {
    width: 80%;
  }
  .intro-image {
    width: 42%;
  }
  .intro h1 {
    font-size: clamp(2.5rem, 8vw, 3.7rem);
  }
  .intro p {
    max-width: 28ch;
    font-size: 0.79rem;
  }
  .upload-locked {
    grid-template-columns: auto 1fr;
  }
  .upload-locked a {
    grid-column: 1/-1;
  }
}
@media (max-width: 440px) {
  .intro {
    min-height: 285px;
  }
  .intro-copy {
    width: 86%;
  }
  .intro-image {
    width: 43%;
    opacity: 0.82;
  }
  .intro h1 {
    font-size: 2.5rem;
  }
  .intro p {
    max-width: 24ch;
  }
  .upload-card,
  .upload-locked {
    padding: 19px;
  }
}
@media (max-width: 650px) {
  .study-preferences {
    grid-template-columns: minmax(0, 1fr);
  }
  .preference-field select,
  .preference-field textarea,
  .minutes-input input {
    font-size: 1rem;
  }
  .scope-options {
    gap: 8px;
  }
  .scope-option {
    padding: 12px 10px;
  }
  .upload-locked-actions {
    grid-column: 1/-1;
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .start-button,
  .chat-actions a,
  .upload-locked a,
  .scope-option {
    transition: none;
  }
}
</style>
