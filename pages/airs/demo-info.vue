<script setup lang="ts">
const preview = useRuntimeConfig().public.airGrowthPreview === true;
if (!preview) await navigateTo("/airs", { replace: true });
useHead({ title: "About the Growth demo · Flowst Airs" });
</script>

<template>
  <AirAppShell>
    <section class="growth-demo-info" aria-labelledby="demo-title">
      <p class="demo-label">Prototype · Sample data</p>
      <h1 id="demo-title">Explore your growth</h1>
      <p>
        This preview demonstrates seven Growth capabilities, sample evidence,
        cycle celebrations, and Flowmarks.
      </p>
      <p>
        Real sessions, your library, and account settings are unavailable in this
        demo. Your preview progress stays in this browser until you reload or
        reset it.
      </p>
      <NuxtLink class="air-button" to="/airs">Back to Growth</NuxtLink>
    </section>
  </AirAppShell>
</template>

<style scoped>
.growth-demo-info {
  max-width: 640px;
  margin: clamp(32px, 8vw, 88px) auto;
  padding: clamp(24px, 5vw, 48px);
  border: 1px solid var(--air-line);
  border-radius: 24px;
  background: #fff;
  color: var(--air-ink);
}
.demo-label {
  color: var(--air-accent-strong);
  font-weight: 700;
}
h1 {
  margin: 24px 0;
  font-size: clamp(1.5rem, 4vw, 2rem);
  line-height: 1.4;
}
p {
  margin: 0 0 20px;
  line-height: 1.7;
}
.air-button {
  margin-top: 12px;
}
</style>
