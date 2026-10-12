<script setup lang="ts">
const auth = useAuth()
await auth.ensureSession()
const authenticated = computed(() => auth.status.value === 'AUTHENTICATED')
useHead({ title: 'Flowst Airs · Give your thoughts a stronger voice', meta: [{ name: 'description', content: 'Build your verbal intelligence through guided spoken practice. Express your ideas with greater confidence, prepare for career conversations, and earn Tides as you progress.' }, { property: 'og:title', content: 'Flowst Airs · Give your thoughts a stronger voice' }, { property: 'og:description', content: 'A practice space for independent adult learners to explore ideas, express opinions and build confidence for conversations that shape their careers.' }], bodyAttrs: { class: 'air-surface' } })
</script>
<template><AirLanding :authenticated="authenticated" /></template>
