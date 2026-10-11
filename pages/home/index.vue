<script setup lang="ts">
definePageMeta({});
const config = useRuntimeConfig().public;
const showGrowth =
  config.studySourceFixtureMode === true || config.airGrowthEnabled === true;
useHead({ title: showGrowth ? "Your Growth · Flowst Airs" : "Flowst Airs" });
</script>
<template><AirsGrowthHome v-if="showGrowth" /><AirsSetup v-else /></template>
