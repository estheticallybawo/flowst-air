<script setup lang="ts">
const auth = useAuth()
await auth.ensureSession()
const authenticated = computed(() => auth.status.value === 'AUTHENTICATED')
</script>

<template>
  <div class="air-public">
    <header class="air-public-header">
      <AirBrand />
      <nav aria-label="Flowst Air public navigation">
        <NuxtLink to="/#how-it-works">How it works</NuxtLink>
        <NuxtLink to="/air/pricing">Pricing</NuxtLink>
        <NuxtLink to="/air/about">Privacy &amp; trust</NuxtLink>
      </nav>
      <NuxtLink class="air-button air-button-teal" :to="authenticated ? '/air' : '/auth/sign-in'">{{ authenticated ? 'Open study space' : 'Sign in' }}</NuxtLink>
    </header>
    <main id="main-content" tabindex="-1"><slot /></main>
    <footer class="air-footer"><AirBrand /><span>Your learning companion</span><NuxtLink to="/air/about">About &amp; privacy</NuxtLink></footer>
  </div>
</template>
