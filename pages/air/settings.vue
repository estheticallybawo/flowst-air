<script setup lang="ts">
definePageMeta({ alias: '/amira/settings', middleware: ["air-only"] });
const auth = useAuth();
const { access, loading, error, refresh } = useAirAccess();
useHead({ title: "Settings · Flowst Air" });
const profileRequestPending = ref(false);
const profileError = ref("");
const profileLoading = computed(
  () =>
    profileRequestPending.value ||
    ["UNKNOWN", "LOADING"].includes(auth.status.value),
);
async function refreshProfile() {
  profileRequestPending.value = true;
  profileError.value = "";
  try {
    await auth.loadMe();
  } catch {
    profileError.value =
      "We could not load your account details. Please try again.";
  } finally {
    profileRequestPending.value = false;
  }
}
onMounted(() => {
  if (auth.status.value === "AUTHENTICATED" && !auth.me.value)
    void refreshProfile();
});
</script>
<template>
  <AirStudyShell>
    <header class="air-page-heading">
      <p class="air-eyebrow">Your account</p>
      <h1>Settings</h1>
      <p>Know what you can use, what is saved, and what you control.</p>
    </header>
    <div class="air-settings-grid">
      <section class="air-panel">
        <h2>Your account</h2>
        <AirSkeleton
          v-if="profileLoading"
          variant="account"
          label="Loading account details"
        />
        <p v-else-if="!auth.me.value" class="air-error" role="alert">
          {{ profileError || "Your account details are unavailable." }}
          <button @click="refreshProfile">Try again</button>
        </p>
        <template v-else
          ><dl>
            <dt>Name</dt>
            <dd>{{ auth.me.value.profile.displayName || "Not provided" }}</dd>
            <dt>Email</dt>
            <dd>{{ auth.me.value.profile.email || "Not provided" }}</dd>
          </dl>
          <p>
            Sign out using the account menu at the top of the page.
          </p></template
        >
      </section>
      <section class="air-panel" aria-label="Account access">
        <h2>Access &amp; allowance</h2>
        <AirSkeleton
          v-if="loading"
          variant="account"
          label="Checking account access"
        />
        <p v-else-if="error" class="air-error" role="alert">
          {{ error }} <button @click="refresh">Try again</button>
        </p>
        <template v-else-if="access"
          ><strong>{{
            access.tier === "FREE_PILOT"
              ? "Free pilot"
              : "Study access restricted"
          }}</strong>
          <p>
            Up to {{ access.limits.uploadBytes / 1_000_000 }} MB per document.
            Work with one active document at a time; finish its agreed
            objectives or explicitly abandon its plan before replacing it.
          </p>
          <p v-if="access.usage.completionRequired">
            {{
              access.usage.uploadRestrictionReason ||
              "Your current session needs completion before another upload."
            }}
            <NuxtLink class="air-text-link" to="/air"
              >Review your study space</NuxtLink
            >
          </p>
          <p>
            Per document: {{ access.limits.recordedSecondsPerDocument }} voice
            input seconds and
            {{
              access.limits.spokenCharactersPerDocument.toLocaleString()
            }}
            generated reply characters. All Voice conversation shares this
            allowance.
          </p>
          <p v-if="access.tier === 'RESTRICTED'">
            Your saved documents remain readable and can be deleted from the
            library.
          </p></template
        >
        <p v-else class="air-error" role="alert">
          Your account access could not be confirmed.
          <button @click="refresh">Try again</button>
        </p>
      </section>
      <section class="air-panel">
        <h2>Your material &amp; privacy</h2>
        <p>
          Manage documents and saved study records from your library. Deleting
          an unfinished document does not complete its objectives. To replace
          it, use Replace study document and confirm abandoning the current
          plan. Abandoned documents remain read-only and can be deleted.
        </p>
        <NuxtLink class="air-text-link" to="/air/about"
          >Your material and data</NuxtLink
        >
      </section>
      <section class="air-panel">
        <h2>Microphone &amp; accessibility</h2>
        <p>
          Choose Start session or Start live call and grant microphone
          permission to talk with Amina. Replies play during the call; there is
          no recording review or Send step. Mute silences input. End call,
          leaving, and sign-out stop capture and playback.
        </p>
        <p>
          Testing calls reserve up to 60 seconds when started, including unused
          time. Failed or uncertain speech requests can use allowance. Available
          captions may change; confirmed saved transcripts remain readable.
          Manage microphone permission in your browser’s site settings.
        </p>
        <NuxtLink class="air-text-link" to="/air/about"
          >Microphone, transcripts &amp; help</NuxtLink
        >
      </section>
      <AirUpgradePanel class="air-wide" />
    </div>
  </AirStudyShell>
</template>
