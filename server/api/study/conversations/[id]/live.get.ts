import { getAminaAgent } from "../../../../services/studyElevenAgent";
import { requireIdentity } from "../../../../utils/auth";
import { getStudyConversation } from "../../../../services/studyRepository";
import { assertAirStudyAccess } from "../../../../services/airAccess";
export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  const study = await getStudyConversation(identity.userId, id, event);
  await assertAirStudyAccess(identity.userId, "PRACTISE", event, id);
  const config = useRuntimeConfig(event);
  if (config.studyVoiceProvider === 'aws' && (config.studyObjectiveFlowEnabled === true || study.objectiveFlow)) return {enabled:false,provider:'aws',socketUrl:'',message:'AWS live calls are not available with objective-driven practice yet. Recorded practice is available.'};
  setHeader(event, "Cache-Control", "private, no-store");
  if (config.studyVoiceProvider !== "aws") {
    try {
      await getAminaAgent();
      return {
        enabled: true,
        provider: "elevenlabs",
        socketUrl: "",
        message: "",
      };
    } catch (cause) {
      return {
        enabled: false,
        provider: "elevenlabs",
        socketUrl: "",
        message:
          (cause as { statusMessage?: string }).statusMessage ||
          "Live voice availability could not be checked. Retry shortly.",
      };
    }
  }
  return {
    enabled: config.aminaRealtimeEnabled === true,
    socketUrl: String(config.aminaRealtimeSocketUrl || "/api/study/live"),
    message: config.aminaRealtimeEnabled
      ? ""
      : "Live calls are not enabled on this server yet. Recording is available.",
  };
});
