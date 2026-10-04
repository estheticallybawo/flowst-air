import { requireIdentity } from "../../../../../utils/auth";
import { assertAirStudyAccess } from "../../../../../services/airAccess";
import {
  acquireStudyLiveLease,
  appendStudyVoiceUsage,
  releaseStudyLiveLease,
  getStudyConversation,
} from "../../../../../services/studyRepository";
import { buildAminaLiveContext } from "../../../../../services/studyAmina";
import { getAminaAgent } from "../../../../../services/studyElevenAgent";
import { signStudyVoiceToken } from "../../../../../services/studyVoice";
import { awsVoiceTrialCheck } from "../../../../../services/studyAwsSpeech";

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  await assertAirStudyAccess(identity.userId, "PRACTISE", event);
  const { conversation } = await buildAminaLiveContext(identity.userId, id);
  const { maxSeconds } = await getAminaAgent();
  const config = useRuntimeConfig(event);
  awsVoiceTrialCheck(
    conversation,
    "TRANSCRIBE",
    maxSeconds,
    Number(config.studyAwsVoiceTrialMaxSeconds),
  );
  awsVoiceTrialCheck(
    conversation,
    "POLLY",
    1,
    Number(config.studyAwsVoiceTrialMaxCharacters),
  );
  const lease = await acquireStudyLiveLease(
    identity.userId,
    id,
    90_000,
    Number(config.studyAwsVoiceTrialMaxCharacters) -
      (conversation.voiceUsage?.pollyCharacters || 0),
  );
  try {
    const current = await getStudyConversation(identity.userId, id, event);
    awsVoiceTrialCheck(
      current,
      "TRANSCRIBE",
      maxSeconds,
      Number(config.studyAwsVoiceTrialMaxSeconds),
    );
    if (current.plan.version !== conversation.plan.version)
      throw createError({
        statusCode: 409,
        statusMessage: "Reload your study plan before starting a call.",
      });
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(String(config.elevenLabsStudyAgentId))}`,
      {
        headers: { "xi-api-key": String(config.elevenLabsApiKey) },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok)
      throw createError({
        statusCode: 503,
        statusMessage: "The voice call could not start. Please retry.",
      });
    const result = (await response.json()) as { token: string };
    if (!result.token)
      throw createError({
        statusCode: 503,
        statusMessage: "The voice call returned no connection token.",
      });
    await appendStudyVoiceUsage(
      identity.userId,
      id,
      { kind: "ELEVEN_CALL", units: maxSeconds },
      event,
    );
    setHeader(event, "Cache-Control", "private, no-store");
    return {
      conversationToken: result.token,
      studyToken: signStudyVoiceToken(
        identity.userId,
        id,
        conversation.plan.version,
        lease.leaseId,
      ),
      maxSeconds,
    };
  } catch (cause) {
    await releaseStudyLiveLease(id, lease.leaseId);
    throw cause;
  }
});
