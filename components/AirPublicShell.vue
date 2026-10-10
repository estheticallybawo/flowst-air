<script setup lang="ts">
defineProps<{ landing?: boolean }>();
const auth = useAuth();
await auth.ensureSession();
const authenticated = computed(() => auth.status.value === "AUTHENTICATED");
</script>

<template>
  <div class="air-public" :class="{ 'air-public-landing': landing }">
    <header class="air-public-header">
      <AirBrand />
      <nav aria-label="Flowst Airs public navigation">
        <a :href="landing ? '#how-it-works' : '/#how-it-works'">How it works</a>
        <template v-if="landing"><a href="#for-you">Who it’s for</a><a href="#growth">Tides</a><a href="#faq">FAQ</a></template>
        <template v-else><NuxtLink to="/airs/pricing">Pricing</NuxtLink><NuxtLink to="/airs/about">Privacy &amp; trust</NuxtLink></template>
      </nav>
      <NuxtLink
        class="air-button air-button-teal"
        :to="authenticated ? '/airs' : '/auth/sign-in?redirect=/airs'"
        >{{ authenticated ? "Continue" : "Sign in" }}</NuxtLink
      >
    </header>
    <main id="main-content" tabindex="-1"><slot /></main>
    <footer class="air-footer">
      <AirBrand /><span>Understand. Explain. Keep growing.</span
      ><NuxtLink v-if="landing" to="/airs/pricing">Access &amp; plans</NuxtLink><NuxtLink to="/airs/about">About &amp; privacy</NuxtLink>
    </footer>
  </div>
</template>
<style scoped>
.air-public {
  background: var(--air-canvas, #eef8ff);
}
.air-public-landing .air-public-header { margin-top: 20px; padding: 16px 24px; border: 0; border-radius: 999px; background: #fff; box-shadow: 0 8px 28px rgb(2 80 125 / 6%); }
.air-public-landing .air-public-header nav { gap: 24px; }
@media(max-width: 767px) { .air-public-landing .air-public-header { border-radius: 22px; padding: 16px; }.air-public-landing .air-public-header nav { flex-wrap: wrap; gap: 12px 20px; } }
</style>
