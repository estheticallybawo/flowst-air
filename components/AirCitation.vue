<script setup lang="ts">
import type { StudySource } from '~/shared/study'
defineProps<{ source: StudySource }>()
</script>
<template>
  <a v-if="source.location?.url" :href="source.location.url" :title="source.excerpt" target="_blank" rel="noopener noreferrer">{{ source.label }}</a>
  <span v-else :title="source.excerpt">{{ source.label }}</span>
</template>
