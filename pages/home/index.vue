<script setup lang="ts">
import AirsWebsiteCompanion from '~/components/demo/AirsWebsiteCompanion.vue';
definePageMeta({});
const config = useRuntimeConfig().public;
const showGrowth =
  config.studySourceFixtureMode === true || config.airGrowthEnabled === true;
useHead({ title: showGrowth ? "Your Growth · Flowst Airs" : "Flowst Airs" });
</script>
<template>
  <AirsGrowthHome v-if="showGrowth">
    <template #companion><AirsWebsiteCompanion /></template>
  </AirsGrowthHome>
  <AirsSetup v-else />
</template>
