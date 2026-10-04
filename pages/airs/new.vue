<script setup lang="ts">
definePageMeta({ alias: ['/amira/new', '/air/new'], middleware: ["airs-only"] });
</script>
<template><AirsLibraryView upload-only /></template>
