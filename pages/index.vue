<script setup lang="ts">
const auth = useAuth()
await auth.ensureSession()
const authenticated = computed(() => auth.status.value === 'AUTHENTICATED')
useHead({ title: 'Flowst Airs · Bring Your Source', bodyAttrs: { class: 'airs-surface' } })
</script>
<template><AirsLanding :authenticated="authenticated" /></template>
