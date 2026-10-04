<script setup lang="ts">
const auth = useAuth()
await auth.ensureSession()
const authenticated = computed(() => auth.status.value === 'AUTHENTICATED')
useHead({ title: 'Flowst Air · Bring Your Source', bodyAttrs: { class: 'air-surface' } })
</script>
<template><AirLanding :authenticated="authenticated" /></template>
