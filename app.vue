<script setup lang="ts">
const standaloneAir = ["air", "amira"].includes(
  useRuntimeConfig().public.appSurface,
);
const sourceFixtureMode = useRuntimeConfig().public.studySourceFixtureMode;
const demoError = ref("");
const route = useRoute();
const workspace = computed(
  () => route.path === "/airs/new" || /^\/airs\/[a-f0-9-]+$/.test(route.path),
);
async function startSourceDemo() {
  try {
    await $fetch("/api/auth/dev-session", {
      method: "POST",
      body: { scenario: "member" },
    });
    await navigateTo("/airs/new", { external: true });
  } catch {
    demoError.value =
      "The local demo session could not start. Check that fixture mode and mock authentication are enabled.";
  }
}
useHead({ bodyAttrs: { class: standaloneAir ? "air-surface" : "" } });
</script>

<template>
  <div class="app-shell" :class="{ 'workspace-host': workspace }">
    <a class="skip-link" href="#main-content">Skip to main content</a>
    <NuxtRouteAnnouncer />
    <aside
      v-if="sourceFixtureMode"
      class="source-fixture-banner"
      aria-label="Demonstration mode"
    >
      Local demonstration: sample sources and scripted plans. Live voice needs
      configured providers.
      <button @click="startSourceDemo">Open local demo</button>
      <p v-if="demoError" role="alert">{{ demoError }}</p>
    </aside>
    <NuxtPage />
  </div>
</template>
<style scoped>
.workspace-host {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
.workspace-host :deep(.air-study-frame.is-session:not(.is-keyboard-open)) {
  height: auto;
  flex: 1;
  min-height: 0;
}
.workspace-host .source-fixture-banner {
  flex: none;
  padding: 6px 12px;
  font-size: 0.75rem;
  line-height: 1.4;
}

.source-fixture-banner {
  padding: 0.8rem 1rem;
  background: #eee9df;
  color: #3f4739;
  font-size: 0.9rem;
  line-height: 1.5;
}
.source-fixture-banner button {
  margin-left: 0.75rem;
  text-decoration: underline;
  font-weight: 600;
}
</style>
