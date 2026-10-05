import { z } from "zod";
import { requireIdentity } from "../../../../utils/auth";
import {
  failAminaTurn,
  finishAminaTurn,
  prepareAminaTurn,
  streamAminaText,
} from "../../../../services/studyAmina";
import { getStudyConversation } from "../../../../services/studyRepository";

const schema = z
  .object({ action: z.enum(["INTRO", "START_SCENARIO", "START_ORAL_EXAM"]) })
  .strict();
const prompts = {
  INTRO: "I'm ready",
  START_SCENARIO: "Please start a scenario from this document.",
  START_ORAL_EXAM: "Please start my five-question oral exam.",
} as const;

export default defineEventHandler(async (event) => {
  const identity = await requireIdentity(event);
  const id = getRouterParam(event, "id") || "";
  const { action } = schema.parse(await readBody(event));
  const conversation = await getStudyConversation(identity.userId, id, event);
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
  const input = prompts[action];
  const prepared = await prepareAminaTurn(identity.userId, id, input, event);
  try {
    let reply = "";
    for await (const chunk of streamAminaText(
      prepared.system,
      prepared.conversation.turns,
      input,
      event,
      prepared.sourceContext,
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
