import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root = path.resolve(import.meta.dirname, "..");
const index = process.argv.indexOf("--flowst-path");
if (index < 0 || !process.argv[index + 1])
  throw new Error("Supply --flowst-path with the Flowst checkout.");
const host = path.resolve(process.argv[index + 1]);
const files = [
  "components/AirFocusDialog.vue",
  "components/AirsJourneyRail.vue",
  "components/AirsPlanOverview.vue",
  "components/AirSessionNavigation.vue",
  "composables/useAgentHandoff.ts",
  "server/services/studySpeechCache.ts",
  "shared/studyConversation.ts",
  "server/domain/neuromap/studyFunctions.ts",
  "server/services/studyAwsSpeech.ts",
  "shared/airsJourney.ts",
  "shared/studySpeechOutcome.ts",
  "server/api/study/conversations/[id]/review.get.ts",
  "server/api/study/conversations/[id]/control.post.ts",
  "assets/css/air-call-room.css",
  "shared/studyPacing.ts",
  "shared/studySpeech.ts",
  "server/services/studyPreferences.ts",
  "server/services/studyPacing.ts",
  "server/services/studyElevenSpeech.ts",
  "server/api/study/conversations/[id]/pacing.get.ts",
  "server/api/study/conversations/[id]/pacing.post.ts",
  "server/api/study/conversations/[id]/recorded-turn.get.ts",
  "server/api/study/conversations/[id]/recorded-turn.post.ts",
  "server/api/study/conversations/[id]/speech.post.ts",
  "server/api/study/conversations/[id]/plan/confirm.post.ts",
  "composables/useStudyPacing.ts",
  "components/AirConversation.vue",
  "components/AgentAvatar.vue",
  "server/services/airsContextSummary.ts",
  "server/services/studyRepository.ts",
  "server/api/study/context.put.ts",
  "server/api/study/context/summary.post.ts",
  "server/api/study/conversations/[id].get.ts",
  "server/api/study/conversations/[id]/plan.post.ts",
  "server/api/study/conversations/[id]/plan/approve.post.ts",
  "server/api/study/conversations/[id]/welcome.post.ts",
  "server/api/study/sources/document-preview.post.ts",
  "components/AgentActivity.vue",
  "components/AgentOrb.vue",
  "components/AirsSetup.vue",
  "components/AirLibraryView.vue",
  "components/AirSourcePicker.vue",
  "components/AirCallRoom.vue",
  "components/AirAppShell.vue",
  "pages/airs/index.vue",
  "pages/airs/new.vue",
  "pages/airs/library.vue",
  "pages/airs/[id].vue",
  "shared/airsOrchestration.ts",
  "shared/study.ts",
  "server/services/airsAgentRunner.ts",
  "server/services/airsPlanning.ts",
  "server/services/airsAminaFunctions.ts",
  "server/services/airsKai.ts",
  "server/services/studyMisu.ts",
  "server/services/studyAmina.ts",
  "server/services/studySources.ts",
  "components/AirsContextCard.vue",
  "components/AirsKaiReview.vue",
  "components/MisuPlanGuide.vue",
];
const hash = (p) => {
  let source = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  // Flowst retains this exact compatibility export for its legacy callers.
  if (p.endsWith(path.join('server', 'domain', 'neuromap', 'studyFunctions.ts')))
    source = source.replace(/\nexport const compileAmiraStudyPacket = compileAirStudyPacket\s*$/, '');
  return crypto.createHash('sha256').update(source.trimEnd()).digest('hex');
};
const mismatches = files.filter(
  (f) =>
    !fs.existsSync(path.join(host, f)) ||
    hash(path.join(root, f)) !== hash(path.join(host, f)),
);
if (mismatches.length) {
  console.error("Shared Airs mismatch: " + mismatches.join(", "));
  process.exitCode = 1;
} else
  console.log(
    "Shared Airs parity passed: " +
      files.length +
      " modules/components. Authentication, host adapters and the legacy compiler alias intentionally differ.",
  );
