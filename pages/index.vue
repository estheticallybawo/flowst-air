<script setup lang="ts">
const auth = useAuth()
await auth.ensureSession()
const authenticated = computed(() => auth.status.value === 'AUTHENTICATED')
useHead({ title: 'Flowst Airs · Make what you learn your own', meta: [{ name: 'description', content: 'Make your views and knowledge easier to air. Plan with Misu, practise with Amina, review evidence with Kai, and earn Tides as you progress with Flowst Airs.' }, { property: 'og:title', content: 'Flowst Airs · Make what you learn your own' }, { property: 'og:description', content: 'Guided spoken practice, feedback on your attempts, and Tides as you progress. For independent learners, recent graduates and people building with AI.' }], bodyAttrs: { class: 'air-surface' } })
</script>
<template><AirLanding :authenticated="authenticated" /></template>
