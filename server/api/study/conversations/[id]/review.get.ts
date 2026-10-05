import type { KaiReview } from "../../../../../shared/airsOrchestration";
import { requireIdentity } from "../../../../utils/auth";
import {
  getStudyConversation,
  getStudyPedagogyHistory,
} from "../../../../services/studyRepository";
import { readAirsArtifact } from "../../../../services/airsContext";
export default defineEventHandler(async (event) => {
  const owner = (await requireIdentity(event)).userId,
    id = getRouterParam(event, "id") || "";
  const study = await getStudyConversation(owner, id, event);
  const history = await getStudyPedagogyHistory(owner, id, event);
  const last = history.evidence
    .filter((e) => study.turns.some((t) => t.id === e.learnerTurnId))
    .at(-1);
  const review = last
    ? await readAirsArtifact<KaiReview>(
        owner,
        `REVIEW#${id}#${study.plan.version}#${last.learnerTurnId}`,
        event,
      )
    : null;
  return { review: review || null };
});
