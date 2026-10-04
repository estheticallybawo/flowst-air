<script setup lang="ts">
const auth = useAuth()
await auth.ensureSession()
const authenticated = computed(() => auth.status.value === 'AUTHENTICATED')
</script>

<template>
  <div class="airs-public">
    <header class="airs-public-header">
      <AirsBrand />
      <nav aria-label="Flowst Airs public navigation">
        <NuxtLink to="/#how-it-works">How it works</NuxtLink>
        <NuxtLink to="/airs/pricing">Pricing</NuxtLink>
        <NuxtLink to="/airs/about">Privacy &amp; trust</NuxtLink>
      </nav>
      <NuxtLink class="airs-button airs-button-teal" :to="authenticated ? '/airs' : '/auth/sign-in'">{{ authenticated ? 'Open study space' : 'Sign in' }}</NuxtLink>
    </header>
    <main id="main-content" tabindex="-1"><slot /></main>
    <footer class="airs-footer"><AirsBrand /><span>Your learning companion</span><NuxtLink to="/airs/about">About &amp; privacy</NuxtLink></footer>
  </div>
</template>
