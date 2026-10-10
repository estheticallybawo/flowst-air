import { z } from "zod";
import { requireIdentity } from "../../../../utils/auth";
import {
  failAminaTurn,
  finishAminaTurn,
  prepareAminaTurn,
  streamAminaText,
} from "../../../../services/studyAmina";
import { getStudyConversation } from "../../../../services/studyRepository";
import { objectiveControlSchema } from '../../../../../shared/studyObjectivePolicy';
import { cancelPendingObjectiveOperation, ensureObjectiveFlow, usesObjectiveFlow } from '../../../../services/studyObjectiveFlow';

const schema = z
  .object({ action: z.enum(["INTRO", "START_SCENARIO", "START_ORAL_EXAM", ...objectiveControlSchema.options]), expectedRevision:z.number().int().nonnegative().optional(), objectiveId:z.string().min(1).optional(), operationId:z.string().regex(/^[\w:-]{1,160}$/).optional() })
  .strict();
const prompts = {
  INTRO: "I'm ready",
  START_SCENARIO: "Please start a scenario from this document.",
  START_ORAL_EXAM: "Please start my five-question oral exam.",
} as const;

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  const body = schema.parse(await readBody(event));
  const { action } = body;
  let conversation = await getStudyConversation(identity.userId, id, event);
  const control = objectiveControlSchema.safeParse(action);
  if (control.success && usesObjectiveFlow(conversation,event)) {
    conversation = await ensureObjectiveFlow(conversation,event);
    if (!['END','PAUSE','RESUME'].includes(action) && (body.expectedRevision !== conversation.revision || body.objectiveId !== conversation.plan.activeObjectiveId)) throw createError({statusCode:409,statusMessage:'Your active objective changed. Reload before choosing an activity.'});
    if (action === 'END') conversation = await cancelPendingObjectiveOperation(conversation,event);
    const input = ({REPEAT:'Repeat the question',EXPLAIN_AGAIN:'Explain that again',CHANGE_APPROACH:'Change approach',HINT:'Give me a hint',SKIP:'Skip this objective',DEFER:'Revisit this later',PAUSE:'Pause the session',RESUME:"I'm ready",END:'End the session'} as const)[control.data];
    const prepared = await prepareAminaTurn(identity.userId,id,input,event,false,body.operationId,undefined,control.data);
    try {
      let reply = '';
      for await (const chunk of streamAminaText(prepared.system,prepared.conversation.turns,input,event,prepared.sourceContext,prepared.objectiveOperation)) reply += chunk;
      const agentTurn = await finishAminaTurn(identity.userId,id,prepared,reply,event);
      setHeader(event,'Cache-Control','private, no-store'); return {userTurn:prepared.userTurn,agentTurn};
    } catch (error) {await failAminaTurn(identity.userId,id,prepared,error,event);throw error;}
  }
  if (control.success) throw createError({statusCode:409,statusMessage:'These controls require objective-driven practice.'});
  const hasIntroduction = conversation.turns.some(
    (turn) => turn.kind === "INTRO" && turn.role === "AMIRA",
  );
  if (
    action === "INTRO"
      ? conversation.turns.some(turn=>turn.kind==="INTRO" && turn.role==="AMIRA" && (turn.objectiveId===conversation.plan.activeObjectiveId || !turn.objectiveId && conversation.plan.activeObjectiveId===conversation.plan.objectives[0]?.id)) || conversation.mode !== "DISCUSSION"
      : !hasIntroduction ||
        conversation.mode !==
          (action === "START_SCENARIO" ? "SCENARIO" : "ORAL_EXAM")
  )
    throw createError({
      statusCode: 409,
      statusMessage: "This lesson action is not available at the current step.",
    });
  const input = prompts[action as keyof typeof prompts];
  const prepared = await prepareAminaTurn(identity.userId, id, input, event);
  try {
    let reply = "";
    for await (const chunk of streamAminaText(
      prepared.system,
      prepared.conversation.turns,
      input,
      event,
      prepared.sourceContext,
        prepared.objectiveOperation,
    ))
      reply += chunk;
    const agentTurn = await finishAminaTurn(
      identity.userId,
      id,
      prepared,
      reply,
      event,
    );
    setHeader(event, "Cache-Control", "private, no-store");
    return { userTurn: prepared.userTurn, agentTurn };
  } catch (error) {
    await failAminaTurn(identity.userId, id, prepared, error, event);
    throw error;
  }
});
