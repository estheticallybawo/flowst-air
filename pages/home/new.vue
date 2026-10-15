<script setup lang="ts">
import AirSessionModePicker from "~/components/AirSessionModePicker.vue";
definePageMeta({})
const route = useRoute();
</script>
<template><AirsSetup v-if="route.query.mode === 'study'" /><AirSessionModePicker v-else /></template>
