<script setup lang="ts">
definePageMeta({})
const route = useRoute();
const studySelected = computed(() => route.query.mode === "study");
const team = useAgentPresentation();
const teamAccepted = ref(false);
const editingTeam = ref(false);
const showCustomizer = computed(() => editingTeam.value || (studySelected.value && !teamAccepted.value));
function continueWithTeam() {
  teamAccepted.value = true;
  editingTeam.value = false;
}
watch(team.ownerId, () => { teamAccepted.value = false; editingTeam.value = false; });
</script>
<template>
  <AirAppShell v-if="showCustomizer" class="new-session-shell">
    <div class="new-session-team">
      <NuxtLink class="new-session-back" to="/home/new" @click="editingTeam = false">← Back to session choices</NuxtLink>
      <AgentCustomizer @continue="continueWithTeam" />
    </div>
  </AirAppShell>
  <AirsSetup v-else-if="studySelected" />
  <AirSessionModePicker v-else @customize="editingTeam = true" />
</template>

<style scoped>
.new-session-shell{flex:1;min-height:0;width:100%;margin:0 auto;overflow-y:auto;overscroll-behavior-y:contain;box-sizing:border-box;scroll-padding-block:20px}
.new-session-team{max-width:1000px;margin:0 auto;padding:30px 32px 40px;box-sizing:border-box}
.new-session-back{display:inline-flex;align-items:center;min-height:44px;margin-bottom:10px;color:#205b7b;font-size:.9rem;text-decoration:none}
.new-session-back:hover{text-decoration:underline}
.new-session-back:focus-visible{outline:3px solid #0284c7;outline-offset:3px;border-radius:4px}
.new-session-team :deep(.team-customizer__body){overflow:visible;overscroll-behavior:auto}
.new-session-team :deep(.team-customizer__portrait){position:static}
.new-session-team :deep(.team-customizer__agents){position:static}
.new-session-team :deep(.team-customizer__editor){grid-template-columns:minmax(230px,1fr) minmax(0,1.6fr)}
.new-session-team :deep(.team-customizer__portrait>div){height:320px}
@media(max-width:600px){.new-session-team{padding:20px 14px 28px}.new-session-team :deep(.team-customizer__editor){grid-template-columns:1fr}.new-session-team :deep(.team-customizer__portrait>div){width:80px;height:100px}}
</style>
