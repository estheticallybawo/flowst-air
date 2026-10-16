import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(import.meta.dirname, "..");
export const files = [
  "server/services/studyBedrockTransport.ts",
  "server/services/studyModelBudget.ts",
  "server/services/studyElevenAgent.ts",
  "tests/study-bedrock-transport.test.ts",
  "tests/study-bedrock-result.test.ts",
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
  "shared/studySpeechAudio.ts",
  "tests/study-speech-audio.test.ts",
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
  "pages/home/index.vue",
  "pages/home/new.vue",
  "pages/home/library.vue",
  "pages/home/[id].vue",
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
  "server/services/studyRelatedResearch.ts",
  "tests/study-related-research.test.ts",
  "shared/studySessionRecovery.ts",
  "tests/study-evidence-review.test.ts",
  "tests/misu-evidence-contract.test.ts",
  "tests/source-e2e/saved-response-recovery.spec.ts",
];
export const routeAdaptations = {
  "reason": "The standalone authenticated workspace uses /home; Flowst retains its /airs routes. Shared page modules and URL references remain compared.",
  "standalonePrefix": "/home",
  "flowstPrefix": "/airs",
  "sourcePaths": {
    "pages/home/index.vue": "pages/airs/index.vue",
    "pages/home/new.vue": "pages/airs/new.vue",
    "pages/home/library.vue": "pages/airs/library.vue",
    "pages/home/[id].vue": "pages/airs/[id].vue"
  },
  "normalizedFiles": [
    "components/AirsSetup.vue",
    "components/AirLibraryView.vue",
    "components/AirSourcePicker.vue",
    "components/AirAppShell.vue",
    "server/services/studyRepository.ts",
    "pages/home/[id].vue",
    "tests/source-e2e/provider-retry.spec.ts",
    "tests/source-e2e/session-completion.spec.ts",
    "tests/source-e2e/saved-response-recovery.spec.ts"
  ],
  "normalization": "Only standalone quoted/template /home URL prefixes and escaped /home URL-regex prefixes are canonicalized to /airs. Other files, nested paths, import paths and longer names remain exact. Route-adapted baseline entries also pin the uncanonicalized standalone source hash."
};
const routeFiles = new Set(routeAdaptations.normalizedFiles);
const normalizeStandaloneRoutes = (source) => source
  .replace(/(["'\x60])\/home(?=\/|["'\x60?#])/g, "$1/airs")
  .replace(/(\/\^?)\\\/home(?=\\\/|\$|[?#])/g, "$1\\/airs");
const standaloneSourceHash = (p) => crypto.createHash("sha256")
  .update(fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n").trimEnd()).digest("hex");
const hash = (p, file, standalone = false) => {
  let source = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  if (
    p.endsWith(
      path.join(
        "server",
        "api",
        "study",
        "llm",
        "v1",
        "chat",
        "completions.post.ts",
      ),
    ) ||
    p.endsWith(path.join("tests", "amina-live-model.test.ts"))
  )
    source = source
      .replaceAll("assertAmiraStudyAccess", "assertAirStudyAccess")
      .replaceAll("/amiraAccess", "/airAccess")
      .replaceAll("prepareAmiraTurn", "prepareAminaTurn")
      .replaceAll("streamAmiraText", "streamAminaText")
      .replaceAll("finishAmiraTurn", "finishAminaTurn")
      .replaceAll("failAmiraTurn", "failAminaTurn")
      .replaceAll("/studyAmira", "/studyAmina");
  // Flowst exercises the retained client alias; its implementation delegates unchanged.
  if (p.endsWith(path.join("tests", "amina-live-client.test.ts")))
    source = source.replaceAll("useAmiraLiveCall", "useAminaLiveCall");
  // Flowst retains this exact compatibility export for its legacy callers.
  if (
    p.endsWith(path.join("server", "domain", "neuromap", "studyFunctions.ts"))
  )
    source = source.replace(
      /\nexport const compileAmiraStudyPacket = compileAirStudyPacket\s*$/,
      "",
    );
  if (standalone && routeFiles.has(file)) source = normalizeStandaloneRoutes(source);
  return crypto.createHash("sha256").update(source.trimEnd()).digest("hex");
};

export const intentionalDifferences = {
  "server/services/studyElevenAgent.ts": {
    reason: "Standalone saved-session voice selection checks remote TTS override permission before acquiring a live lease",
    flowst: "f4c4dccab40bd2f57d684e38a2a6d012087ae0cfbebb8012ab3130dac8e08f53",
    standalone: "4c1a12825fda842d4165eda6f52a16bd7d909cc234917682748f102b7fdb409c",
  },
  "server/services/studySpeechCache.ts": {
    reason: "Standalone immutable-session voice choices form cache identity and unsupported transports fail without voice substitution",
    flowst: "35e0107e63af2881f9d3ddbd5ce39d0299dc09c535dbcea743c1e6f9dd611848",
    standalone: "3650f4d106de6266c4031449eb5fb8bc64f51f9b602b97a9c1e73abcc1670546",
  },
  "server/services/studyElevenSpeech.ts": {
    reason: "Standalone synthesis uses the approved saved-session voice while retaining configured legacy defaults and setup errors",
    flowst: "ed6ef31ea2b5e4c650ddc45b496c084b4b55f29e91731cff9b764d95ebaec168",
    standalone: "0c89496394afece1d3181b344b01a1e3a8cc655f82ef4bf2c6f0766ee877bbb3",
  },
  "components/AirConversation.vue": {
    reason: "Standalone conversation portraits render saved-session cosmetic preferences without changing learning turns",
    flowst: "a035542fd864e881f04e1d43f2aac20aa0c2b2cef8d9a77daf9d7841ab3dc6a3",
    standalone: "1a136998e2b9cffdf184db90f9c393b96105ae5e16701f4b0182a2df1cb839af",
  },
  "components/AgentAvatar.vue": {
    reason: "Standalone companion thumbnails render learner-selected cosmetic preferences",
    flowst: "f4109681d6cf8b633f2acfa3d22dec13c6b019995f62c4713a85495522c2edaa",
    standalone: "dbe2c529cbe940fef15259bfd2340381683ce8f0dc7802d8fe15d2ff189a74b0",
  },
  "server/services/studyRepository.ts": {
    reason: "Standalone sessions capture an immutable presentation snapshot and normalize legacy cosmetic defaults without changing study policy",
    flowst: "688ca7e7c4f9ede70fccfc922d35d1d2ff0240fc33c5ade515080ba92cb87c54",
    standalone: "82b5a9920011488733b7f69f5d71e50fdf7374bc6b59db95c3fb87e8cca789bf",
  },
  "components/AirsSetup.vue": {
    reason: "Standalone optional team customization is available before Misu while retaining upload and plan approval controls",
    flowst: "34e08a6a9964177b3ef9f330e5abe635ed47c798ec1c1bee13098c5e0fee00e7",
    standalone: "71bcce9b568e0f497ae10a1457abf3ccfd91fd2a6eeb937392b9821b70bd9196",
  },
  "components/AirLibraryView.vue": {
    reason: "Standalone library cards preview saved companion presentation; hero image and colour masks share contain/bottom framing",
    flowst: "48293d6897a23dd1e7eed7a8bc434ba14690fe144aa64d1c577901c00ac973d7",
    standalone: "391d063646ad173ddfe7b59eea811c7d7e56e85c2cf7f4cffd7bf3c1d6691dcd",
  },
  "pages/home/[id].vue": {
    reason: "Standalone session views provide the saved companion presentation while preserving existing learning and recovery guards",
    flowst: "bf4646dcba41a437cfa7caa05e67919d291b32e3111f50b805a90e412360edbd",
    standalone: "4b6c275b443574bac8751b538afe5cb37fd9c97bf2c64642eb2d9a17f8b30378",
  },
  "shared/study.ts": {
    reason: "Standalone study records optionally carry the persisted cosmetic presentation snapshot",
    flowst: "2d287330a38d4647efcb37a85fa8115f15f7760853c03b693cf997bfe57a74cd",
    standalone: "279457a849f5ec44af323e04c3174d48d66d6940113afdd7fb9ec75a8aa4d297",
  },
  "components/AirAppShell.vue": {
    reason: "Standalone Airs includes opt-in mode demonstrations in its existing authenticated navigation",
    flowst: "2699457f92ac6b4ef7ceaf4c3c5f661d42fe33aede9e34049499f487a0d74bbd",
    standalone: "0707b4de30079e23d44c97a920a73df7e2c6425cf34acbf0319641774c2ce066",
  },
  "pages/home/new.vue": {
    reason: "Standalone mode selection offers optional companion appearance and voice choices before Misu while preserving the explicit Study entry",
    flowst: "1af03a0c32da2c6a931dee021fd058111473b54c10f2612e2b893861e8115d56",
    standalone: "0420a7a848d4dab8d90b12436384c89f1f847febc8f751dba383420114fa2c3f",
  },
  "composables/useStudyRetry.ts": {
    reason: "Owner formatting only; retry tokens and behavior match Flowst",
    flowst: "3ccc25f72f887b7c51110074a4a52b097850cb44300e6cc51d7cd704e76e145c",
    standalone: "c81b3cb89284583fe00357220357d01c6cea1e767bd201e8431e268828dd4177"
  },
  "pages/home/index.vue": {
    reason:
      "Growth Home keeps the normal authenticated shell and adds only an opt-in, memory-only companion preview slot",
    flowst: "1af03a0c32da2c6a931dee021fd058111473b54c10f2612e2b893861e8115d56",
    standalone:
      "df6bf64c09bd03482379ac0c0e15227487b1e38e52af6b90d49277d4b345008b",
  },
  "components/AirCallRoom.vue": {
    reason: "Standalone audio failure layout and short-screen scrolling also render the saved session's customized companion portrait",
    flowst: "635ea038c70a364175fd0c7c7039f23195b3a2a98b64a84f17cf9893454b183b",
    standalone:
      "8c775108c63a672e4f949205ba02e42fbd9b1fc9ed27f444f842b09099ebf3ad",
  },
  "assets/css/air-call-room.css": {
    reason: "Standalone audio failure layout and short-screen scrolling",
    flowst: "90fdd307c1d8286cb7bec950a094c0bbe2395d2f8644b2f8066c84d65a181530",
    standalone: "f4df83973857a092649d4ef873ef8fc0028db6c490521d408a8eee142fca18b3",
  },
  "components/AirStudyShell.vue": {
    reason: "Standalone mobile keyboard viewport handling",
    flowst: "7d3453dd07a7de72f98271d09aa316ac4888729c3316556089d8b41b6aa80cff",
    standalone:
      "2d3414ae2ed95dcb73b9acaa30e150eaa27132bee15c86cd0d02f00838c333c6",
  },
  "composables/useAminaLiveCall.ts": {
    reason: "Standalone canonical /home recovery compatibility also forwards the immutable-session voice override while retaining live lifecycle safeguards",
    flowst: "8099cbe764c21ff8354f5ea67a63b6ee885557435f24dc893afe4d8d2db648dc",
    standalone: "a22e87be282881019359325bbc37da5e3ed3ee99180065ac7abe63d3014a1b2b",
  },
};
const baselinePath = "docs/generated/shared-parity.json";
export function checkAgainstFlowst(host, target = root) {
  const problems = [];
  for (const file of files) {
    const sourceFile = routeAdaptations.sourcePaths[file] || file;
    if (
      !fs.existsSync(path.join(host, sourceFile)) ||
      !fs.existsSync(path.join(target, file))
    ) {
      problems.push("Missing shared file: " + file + (sourceFile !== file ? " (Flowst source: " + sourceFile + ")" : ""));
      continue;
    }
    const left = hash(path.join(host, sourceFile), file),
      right = hash(path.join(target, file), file, true),
      allowed = intentionalDifferences[file];
    if (
      left !== right &&
      (!allowed || allowed.flowst !== left || allowed.standalone !== right)
    )
      problems.push("Shared Airs mismatch: " + file);
  }
  return problems;
}
export function writeBaseline(target = root) {
  const baseline = {
    version: 2,
    files: files.map((file) => ({
      path: file,
      sha256: hash(path.join(target, file), file, true),
      ...(routeFiles.has(file) ? { standaloneSha256: standaloneSourceHash(path.join(target, file)) } : {}),
    })),
    intentionalDifferences,
    routeAdaptations,
  };
  fs.mkdirSync(path.join(target, "docs/generated"), { recursive: true });
  fs.writeFileSync(
    path.join(target, baselinePath),
    JSON.stringify(baseline, null, 2) + "\n",
  );
}
export function verifyBaseline(target = root) {
  let baseline;
  try {
    baseline = JSON.parse(
      fs.readFileSync(path.join(target, baselinePath), "utf8"),
    );
  } catch {
    return [
      "Shared parity baseline missing or unreadable. Compare both checkouts with npm run parity:update -- --flowst-path <checkout>.",
    ];
  }
  const problems = [];
  if (
    baseline.version !== 2 ||
    !Array.isArray(baseline.files) ||
    baseline.files.length !== files.length ||
    new Set(baseline.files.map((item) => item.path)).size !== files.length ||
    JSON.stringify(baseline.intentionalDifferences) !==
      JSON.stringify(intentionalDifferences) ||
    JSON.stringify(baseline.routeAdaptations) !== JSON.stringify(routeAdaptations)
  )
    return [
      "Shared parity baseline does not match the reviewed file list/adaptations.",
    ];
  for (const file of files) {
    const expected = baseline.files.find((item) => item.path === file);
    if (
      !expected ||
      !fs.existsSync(path.join(target, file)) ||
      hash(path.join(target, file), file, true) !== expected.sha256 ||
      (routeFiles.has(file) && standaloneSourceHash(path.join(target, file)) !== expected.standaloneSha256)
    )
      problems.push("Unverified shared change: " + file);
  }
  return problems;
}
function main() {
  const index = process.argv.indexOf("--flowst-path"),
    host = index >= 0 ? process.argv[index + 1] : undefined;
  const update = process.argv.includes("--write-baseline");
  if ((update || process.argv.includes("--require-flowst")) && !host)
    throw new Error(
      "Updating the baseline requires --flowst-path. Compare the two checkouts first.",
    );
  const problems = host
    ? checkAgainstFlowst(path.resolve(host))
    : verifyBaseline();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
    return;
  }
  if (update) writeBaseline();
  console.log(
    "Shared Airs " +
      (host ? "cross-repository parity" : "verified release snapshot") +
      " passed: " +
      files.length +
      " files; " +
      Object.keys(intentionalDifferences).length +
      " pinned standalone adaptations; " +
      Object.keys(routeAdaptations.sourcePaths).length + " reviewed route source mappings; " +
      routeAdaptations.normalizedFiles.length + " scoped URL adaptations.",
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
