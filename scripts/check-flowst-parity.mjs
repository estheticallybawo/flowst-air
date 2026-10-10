import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
export const files = [
  "server/services/studyBedrockTransport.ts",
  "server/services/studyModelBudget.ts",
  "server/services/studyElevenAgent.ts",
  "tests/study-bedrock-transport.test.ts",
  "tests/amina-live-model.test.ts",
  "server/services/studyPlanningInventory.ts",
  "tests/study-planning-inventory.test.ts",
  "server/services/studyInference.ts",
  "shared/studyRetry.ts",
  "composables/useStudyRetry.ts",
  "tests/study-provider-recovery.test.ts",
  "tests/source-e2e/provider-retry.spec.ts",
  "shared/aminaWelcome.ts",
  "tests/amina-welcome.test.ts",
  "tests/airs-setup.test.ts",
  "shared/kaiAssessment.ts",
  "server/api/study/conversations/[id]/review.post.ts",
  "tests/kai-assessment.test.ts",
  "components/AirsSessionCompletion.vue",
  "shared/studyCompletionInvitation.ts",
  "server/services/studyRepeat.ts",
  "server/api/study/conversations/[id]/repeat.post.ts",
  "tests/study-repeat.test.ts",
  "tests/study-completion-invitation.test.ts",
  "tests/source-e2e/session-completion.spec.ts",
  "shared/studyObjectivePolicy.ts",
  "shared/studyObjectiveOperation.ts",
  "shared/studyPedagogy.ts",
  "shared/studyCompletion.ts",
  "server/services/studyObjectiveFlow.ts",
  "server/services/airsContext.ts",
  "server/services/aminaRealtime.ts",
  "server/api/study/conversations/[id]/objective/retry.post.ts",
  "server/api/study/conversations/[id]/mode.post.ts",
  "server/api/study/conversations/[id]/live.get.ts",
  "server/api/study/llm/v1/chat/completions.post.ts",
  "composables/useAminaLiveCall.ts",
  "tests/study-objective-flow.test.ts",
  "tests/amina-live-client.test.ts",
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
  "server/api/study/conversations/[id].delete.ts",
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
  "server/services/airsProviderFailure.ts",
  "tests/airs-orchestration.test.ts",
  "tests/airs-provider-failure.test.ts",
  "tests/study-misu-output-contract.test.ts",
  "tests/airs-kai-recovery.test.ts",
  "server/services/airsPlanning.ts",
  "server/services/airsAminaFunctions.ts",
  "server/services/airsKai.ts",
  "server/services/studyMisu.ts",
  "server/services/studyAmina.ts",
  "server/services/studySources.ts",
  "components/AirsContextCard.vue",
  "components/AirsKaiReview.vue",
  "components/MisuPlanGuide.vue",
  "tests/study-deletion.test.ts",
  "components/AirStudyShell.vue",
  "server/services/misuPlanFailure.ts",
  "tests/misu-plan-errors.test.ts",
  "tests/misu-plan-recovery.test.ts",
  "server/services/misuEvidenceReview.ts",
  "shared/studySessionRecovery.ts",
  "tests/study-evidence-review.test.ts",
  "tests/misu-evidence-contract.test.ts",
  "tests/source-e2e/saved-response-recovery.spec.ts",
];
const hash = (p) => {
  let source = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  if (p.endsWith(path.join('server','api','study','llm','v1','chat','completions.post.ts')) || p.endsWith(path.join('tests','amina-live-model.test.ts'))) source = source.replaceAll('assertAmiraStudyAccess','assertAirStudyAccess').replaceAll('/amiraAccess','/airAccess').replaceAll('prepareAmiraTurn','prepareAminaTurn').replaceAll('streamAmiraText','streamAminaText').replaceAll('finishAmiraTurn','finishAminaTurn').replaceAll('failAmiraTurn','failAminaTurn').replaceAll('/studyAmira','/studyAmina');
  // Flowst exercises the retained client alias; its implementation delegates unchanged.
  if (p.endsWith(path.join('tests','amina-live-client.test.ts'))) source = source.replaceAll('useAmiraLiveCall','useAminaLiveCall');
  // Flowst retains this exact compatibility export for its legacy callers.
  if (p.endsWith(path.join('server', 'domain', 'neuromap', 'studyFunctions.ts')))
    source = source.replace(/\nexport const compileAmiraStudyPacket = compileAirStudyPacket\s*$/, '');
  return crypto.createHash('sha256').update(source.trimEnd()).digest('hex');
};

export const intentionalDifferences = {
  "components/AirAppShell.vue": {
    "reason": "Label the isolated hosted Growth demo instead of presenting account actions",
    "flowst": "6f54f8dbe17f2fb6c2f74ac0179333ad12084d381450b683d1a6991d037a2b64",
    "standalone": "1a2774c24d5536e63c9be6b82ceb5da75cb0b1f8848886d135db5990f02c872c"
  },
  "pages/airs/index.vue": {
    "reason": "Growth fixture/Preview Home; Production retains Misu setup",
    "flowst": "1af03a0c32da2c6a931dee021fd058111473b54c10f2612e2b893861e8115d56",
    "standalone": "4e8f8bf29183c5dc1ae76f4653462819fc184763b5b7b70e5c926df882df9f52"
  },
  "components/AirCallRoom.vue": {
    "reason": "Standalone audio failure layout and short-screen scrolling",
    "flowst": "635ea038c70a364175fd0c7c7039f23195b3a2a98b64a84f17cf9893454b183b",
    "standalone": "4fb0443434df2e979819612a89750853578b7f538609f5e87b2828da19ec07a9"
  },
  "assets/css/air-call-room.css": {
    "reason": "Standalone audio failure layout and short-screen scrolling",
    "flowst": "5de0cc99c74c7e4cd3f16427497f4a23b81f150bbb17c72367a69b0c7900f539",
    "standalone": "6acd144dd073c00084e63d1be6e1d84adb72c852a0b6aa89977b9f0fb938d340"
  },
  "components/AirStudyShell.vue": {
    "reason": "Standalone mobile keyboard viewport handling",
    "flowst": "7d3453dd07a7de72f98271d09aa316ac4888729c3316556089d8b41b6aa80cff",
    "standalone": "2d3414ae2ed95dcb73b9acaa30e150eaa27132bee15c86cd0d02f00838c333c6"
  }
};
const baselinePath = 'docs/generated/shared-parity.json';
export function checkAgainstFlowst(host, target = root) {
  const problems = [];
  for (const file of files) {
    if (!fs.existsSync(path.join(host,file)) || !fs.existsSync(path.join(target,file))) { problems.push('Missing shared file: '+file); continue; }
    const left=hash(path.join(host,file)),right=hash(path.join(target,file)),allowed=intentionalDifferences[file];
    if (left!==right && (!allowed || allowed.flowst!==left || allowed.standalone!==right)) problems.push('Shared Airs mismatch: '+file);
  }
  return problems;
}
export function writeBaseline(target = root) {
  const baseline={version:1,files:files.map(file=>({path:file,sha256:hash(path.join(target,file))})),intentionalDifferences};
  fs.mkdirSync(path.join(target,'docs/generated'),{recursive:true});
  fs.writeFileSync(path.join(target,baselinePath),JSON.stringify(baseline,null,2)+'\n');
}
export function verifyBaseline(target = root) {
  let baseline;
  try {baseline=JSON.parse(fs.readFileSync(path.join(target,baselinePath),'utf8'));}
  catch {return ['Shared parity baseline missing or unreadable. Compare both checkouts with npm run parity:update -- --flowst-path <checkout>.'];}
  const problems=[];
  if (baseline.version!==1 || !Array.isArray(baseline.files) || baseline.files.length!==files.length || new Set(baseline.files.map(item=>item.path)).size!==files.length || JSON.stringify(baseline.intentionalDifferences)!==JSON.stringify(intentionalDifferences)) return ['Shared parity baseline does not match the reviewed file list/adaptations.'];
  for (const file of files) {
    const expected=baseline.files.find(item=>item.path===file);
    if (!expected || !fs.existsSync(path.join(target,file)) || hash(path.join(target,file))!==expected.sha256) problems.push('Unverified shared change: '+file);
  }
  return problems;
}
function main() {
  const index=process.argv.indexOf('--flowst-path'),host=index>=0 ? process.argv[index+1] : undefined;
  const update=process.argv.includes('--write-baseline');
  if ((update || process.argv.includes('--require-flowst')) && !host) throw new Error('Updating the baseline requires --flowst-path. Compare the two checkouts first.');
  const problems=host ? checkAgainstFlowst(path.resolve(host)) : verifyBaseline();
  if (problems.length) {console.error(problems.join('\n'));process.exitCode=1;return;}
  if (update) writeBaseline();
  console.log('Shared Airs '+(host?'cross-repository parity':'verified release snapshot')+' passed: '+files.length+' files; '+Object.keys(intentionalDifferences).length+' pinned standalone adaptations.');
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main();
