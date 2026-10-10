<script setup lang="ts">
definePageMeta({})
const config = useRuntimeConfig().public
const fixtureGrowth = config.studySourceFixtureMode === true || config.airGrowthPreview === true
useHead({ title: fixtureGrowth ? 'Your Growth · Flowst Airs' : 'Flowst Airs' })
</script>
<template><AirsGrowthHome v-if="fixtureGrowth" /><AirsSetup v-else /></template>
