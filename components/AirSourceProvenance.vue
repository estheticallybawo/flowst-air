<script setup lang="ts">
import type { StudyProvenance } from "~/shared/studyMaterial";
defineProps<{ provenance: StudyProvenance }>();
</script>
<template>
  <aside class="source-provenance" aria-label="Source attribution">
    <strong v-if="provenance.fixture"
      >Demonstration fixture. This plan uses scripted sample material; live
      voice requires configured providers.</strong
    >
    <p v-if="provenance.transcriptOrigin">
      {{
        provenance.fixture
          ? "Synthetic demonstration transcript"
          : provenance.transcriptOrigin === "GENERATED"
            ? "AI-generated speech transcript"
            : "Learner-supplied transcript"
      }}. Video visuals were not inspected.
    </p>
    <a
      v-if="!provenance.fixture"
      :href="provenance.url"
      target="_blank"
      rel="noopener noreferrer"
      >Original source</a
    >
    <span v-if="provenance.creator"> · {{ provenance.creator }}</span>
    <details>
      <summary>Snapshot details</summary>
      <p>
        Retrieved {{ new Date(provenance.retrievedAt).toLocaleString() }} ·
        {{ provenance.provider }}
      </p>
      <p v-if="provenance.commit">
        Commit: <code>{{ provenance.commit }}</code>
      </p>
      <p v-if="provenance.license">
        License information: {{ provenance.license }}
      </p>
      <ul>
        <li v-for="omission in provenance.omissions" :key="omission">
          {{ omission }}
        </li>
      </ul>
    </details>
  </aside>
</template>
<style scoped>
.source-provenance {
  padding: 1rem;
  border: 1px solid #c7e4f5;
  border-radius: 0.75rem;
  margin: 1rem 0;
  color: #475569;
  font-size: 0.9rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.source-provenance a {
  color: #0369a1;
}
.source-provenance strong {
  display: block;
}
.source-provenance summary {
  cursor: pointer;
}
</style>
