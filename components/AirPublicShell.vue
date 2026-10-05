<script setup lang="ts">
const auth = useAuth();
await auth.ensureSession();
const authenticated = computed(() => auth.status.value === "AUTHENTICATED");
</script>

<template>
  <div class="air-public">
    <header class="air-public-header">
      <AirBrand />
      <nav aria-label="Flowst Airs public navigation">
        <NuxtLink to="/#how-it-works">How it works</NuxtLink>
        <NuxtLink to="/airs/pricing">Pricing</NuxtLink>
        <NuxtLink to="/airs/about">Privacy &amp; trust</NuxtLink>
      </nav>
      <NuxtLink
        class="air-button air-button-teal"
        :to="authenticated ? '/airs' : '/auth/sign-in'"
        >{{ authenticated ? "Open study space" : "Sign in" }}</NuxtLink
      >
    </header>
    <main id="main-content" tabindex="-1"><slot /></main>
    <footer class="air-footer">
      <AirBrand /><span>Your learning companion</span
      ><NuxtLink to="/airs/about">About &amp; privacy</NuxtLink>
    </footer>
  </div>
</template>
<style scoped>
.air-public {
  background: var(--air-canvas, #eef8ff);
}
</style>
