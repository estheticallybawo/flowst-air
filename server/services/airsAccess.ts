import { createError } from "h3";
import type { H3Event } from "h3";
import type { AirsAccess, AirsStudyAction } from "../../shared/airsAccess";
import {
  getStudyConversation,
  getStudyUploadEligibility,
  assertStudyConversationActive,
} from "./studyRepository";

/** Replace this adapter with verified billing entitlements when checkout is integrated.
 * Never accept tier, limits or access grants from a browser request. */
export async function resolveAirsEntitlement(
  _ownerId: string,
  event?: H3Event,
) {
  const enabled = useRuntimeConfig(event).airsStudyAccessEnabled !== false;
  return {
    tier: enabled ? ("FREE_PILOT" as const) : ("RESTRICTED" as const),
    enabled,
  };
}

export async function getAirsAccess(
  ownerId: string,
  event?: H3Event,
  conversationId?: string,
): Promise<AirsAccess> {
  const config = useRuntimeConfig(event);
  const entitlement = await resolveAirsEntitlement(ownerId, event);
  const eligibility = await getStudyUploadEligibility(ownerId, event);
  const conversation = conversationId
    ? await getStudyConversation(ownerId, conversationId, event)
    : undefined;
  return {
    tier: entitlement.tier,
    allowedActions: {
      UPLOAD: entitlement.enabled && eligibility.canUpload,
      PLAN: entitlement.enabled && !conversation?.abandonedAt,
      PRACTISE: entitlement.enabled && !conversation?.abandonedAt,
      SPEECH: entitlement.enabled && !conversation?.abandonedAt,
    },
    limits: {
      uploadBytes:
        ['airs', 'air', 'amira'].includes(config.public.appSurface) ? 4_000_000 : 20 * 1024 * 1024,
      uploadPolicy: "OBJECTIVE_COMPLETION",
      recordedSecondsPerDocument: Number(
        config.studyAwsVoiceTrialMaxSeconds ?? 300,
      ),
      spokenCharactersPerDocument: Number(
        config.studyAwsVoiceTrialMaxCharacters ?? 6000,
      ),
    },
    usage: {
      activeConversationId: eligibility.canUpload
        ? undefined
        : eligibility.activeConversationId,
      completionRequired: eligibility.completionRequired,
      uploadRestrictionReason: eligibility.canUpload
        ? undefined
        : eligibility.reason,
      uploadRestrictionCode: eligibility.canUpload
        ? undefined
        : eligibility.reasonCode,
      conversationId: conversation?.id,
      recordedSeconds: conversation
        ? conversation.voiceUsage?.transcribeSeconds || 0
        : undefined,
      spokenCharacters: conversation
        ? conversation.voiceUsage?.pollyCharacters || 0
        : undefined,
    },
    upgradeAvailable: false,
  };
}

export async function assertAirsStudyAccess(
  ownerId: string,
  action: AirsStudyAction,
  event?: H3Event,
  conversationId?: string,
) {
  if (conversationId) assertStudyConversationActive(await getStudyConversation(ownerId, conversationId, event));
  if (!['airs', 'air', 'amira'].includes(useRuntimeConfig(event).public.appSurface)) return;
  const entitlement = await resolveAirsEntitlement(ownerId, event);
  if (!entitlement.enabled)
    throw createError({
      statusCode: 403,
      statusMessage:
        "Study access is currently unavailable. Your saved material is still available.",
      data: {
        code: "AMIRA_ACCESS_RESTRICTED",
        action,
        nextAction: "/airs/settings",
        upgradeAvailable: false,
      },
    });
  // The active-document completion gate and voice budgets are enforced atomically by the study services.
}
