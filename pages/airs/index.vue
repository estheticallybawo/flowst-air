<script setup lang="ts">
definePageMeta({})
const fixtureGrowth = useRuntimeConfig().public.studySourceFixtureMode === true
useHead({ title: fixtureGrowth ? 'Your Growth · Flowst Airs' : 'Flowst Airs' })
</script>
<template><AirsGrowthHome v-if="fixtureGrowth" /><AirsSetup v-else /></template>
