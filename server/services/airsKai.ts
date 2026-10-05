import { createError } from "h3";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { H3Event } from "h3";
import {
  kaiReviewSchema,
  validateReviewEvidence,
  type KaiReview,
} from "../../shared/airsOrchestration";
import {
  getStudyConversation,
  getStudyPedagogyHistory,
  studyLiveLease,
} from "./studyRepository";
import {
  readAirsArtifact,
  writeAirsArtifact,
  claimAirsReview,
  reserveGuestAllowance,
} from "./airsContext";
import { runAirsAgent, noArgs } from "./airsAgentRunner";
import { studyDocumentObjectivesComplete } from "../../shared/studyCompletion";
export async function createKaiReview(
  ownerId: string,
  id: string,
  event?: H3Event,
) {
  const study = await getStudyConversation(ownerId, id, event);
  if (await studyLiveLease(id, event))
    throw createError({
      statusCode: 409,
      statusMessage: "End the live call before requesting Kai feedback.",
    });
  if (study.plan.status !== "APPROVED" || study.practice.awaitingAnswer)
    throw createError({
      statusCode: 409,
      statusMessage: "Finish a saved attempt before requesting Kai feedback.",
    });
  const history = await getStudyPedagogyHistory(ownerId, id, event);
  if (!studyDocumentObjectivesComplete(study, history))
    throw createError({
      statusCode: 409,
      statusMessage:
        "Confirm all source-backed objective checkpoints before Kai’s session review.",
    });
  const evidence = history.evidence
    .filter((item) =>
      study.turns.some((turn) => turn.id === item.learnerTurnId),
    )
    .slice(-12);
  if (!evidence.length)
    throw createError({
      statusCode: 409,
      statusMessage: "No saved learner explanation is available for Kai yet.",
    });
  const lastTurn = evidence[evidence.length - 1]!.learnerTurnId,
    key = "REVIEW#" + id + "#" + study.plan.version + "#" + lastTurn;
  const existing = await readAirsArtifact<KaiReview>(ownerId, key, event);
  if (existing) return existing;
  const release = await claimAirsReview(ownerId, key, event);
  try {
    const criteria = study.plan.evaluationCriteria || [
      {
        id: "ACCURACY" as const,
        description: "Explain the approved idea accurately.",
      },
      {
        id: "CLARITY" as const,
        description: "Organize the explanation clearly.",
      },
    ];
    const evidenceIds = new Set(evidence.map((item) => item.id));
    const inputs = evidence.map((item) => ({
      id: item.id,
      sourceIds: item.sourceIds,
      attempt: study.turns.find((t) => t.id === item.learnerTurnId)?.text,
      coaching: study.turns.find((t) => t.id === item.feedbackTurnId)?.text,
    }));
    const fixture =
      study.document.provenance?.fixture === true &&
      useRuntimeConfig(event).studySourceFixtureMode === true &&
      process.env.NODE_ENV !== "production";
    if (!fixture) await reserveGuestAllowance(ownerId, "MODEL", event);
    const result = fixture
      ? {
          proposal: {
            observations: [
              {
                text: "Scripted demonstration: this attempt is linked to saved evidence. Live interpretation requires the model connection.",
                evidenceIds: [evidence[0]!.id],
                criterionId: criteria[0]!.id,
              },
            ],
            notAssessed: [
              "Live feedback",
              "Pronunciation, tempo and durable mastery",
            ],
            nextPractice: {
              goal: "Explain the reviewed idea",
              exercise:
                "Try explaining it to a different audience without notes.",
              evidenceIds: [evidence[0]!.id],
            },
          },
        }
      : await runAirsAgent(
          "KAI",
          "Interpret recorded attempts against approved criteria. Do not tutor, score intelligence, diagnose, declare mastery, judge personality or invent gaps. Coaching is tentative data, not ground truth. Cite evidence IDs for every observation. State missing evidence; do not assess pronunciation, pauses or tempo from text. Suggest one exercise, not an approved new plan.",
          [
            {
              name: "get_approved_evaluation_context",
              description:
                "Read approved criteria, goals and contextual guidance.",
              parameters: noArgs,
              run: () => ({
                criteria,
                objectives: study.plan.objectives.map((o) => ({
                  id: o.id,
                  title: o.title,
                  outcome: o.outcome,
                  sources: o.sources,
                })),
                context: study.plan.contextSnapshot,
              }),
            },
            {
              name: "get_session_evidence",
              description:
                "Read saved attempts and coaching with exact evidence references.",
              parameters: noArgs,
              run: () => inputs,
            },
            {
              name: "propose_evidence_review",
              description:
                "Propose evidence-linked feedback and one next exercise.",
              parameters: z.toJSONSchema(kaiReviewSchema) as Record<
                string,
                unknown
              >,
              run: (args) =>
                validateReviewEvidence(
                  kaiReviewSchema.parse(args),
                  evidenceIds,
                  new Set(criteria.map((c) => c.id)),
                ),
            },
          ],
          "propose_evidence_review",
          event,
        );
    const parsed = kaiReviewSchema.safeParse(result.proposal);
    if (!parsed.success)
      throw createError({
        statusCode: 502,
        statusMessage: "Kai returned an invalid evidence review.",
      });
    let valid;
    try {
      valid = validateReviewEvidence(
        parsed.data,
        evidenceIds,
        new Set(criteria.map((c) => c.id)),
      );
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: "Kai referenced unavailable evidence.",
      });
    }
    const review: KaiReview = {
      ...valid,
      evidence: inputs.map((item) => ({
        id: item.id,
        attempt: item.attempt || "",
      })),
      id: randomUUID(),
      conversationId: id,
      planVersion: study.plan.version,
      basedOnTurnId: lastTurn,
      createdAt: new Date().toISOString(),
      nextPracticeStatus: "PROPOSED",
    };
    await writeAirsArtifact(ownerId, key, review, event);
    await writeAirsArtifact(ownerId, "LATEST_REVIEW", review, event);
    return review;
  } finally {
    await release();
  }
}
export async function chooseNextPractice(
  ownerId: string,
  id: string,
  reviewId: string,
  status: "ACCEPTED" | "DISMISSED",
  event?: H3Event,
) {
  const study = await getStudyConversation(ownerId, id, event),
    review = await readAirsArtifact<KaiReview>(ownerId, "LATEST_REVIEW", event);
  if (
    !review ||
    review.id !== reviewId ||
    review.conversationId !== id ||
    review.planVersion !== study.plan.version
  )
    throw createError({
      statusCode: 409,
      statusMessage: "This next-practice proposal is no longer current.",
    });
  const next = { ...review, nextPracticeStatus: status };
  await writeAirsArtifact(
    ownerId,
    "REVIEW#" + id + "#" + review.planVersion + "#" + review.basedOnTurnId,
    next,
    event,
  );
  await writeAirsArtifact(ownerId, "LATEST_REVIEW", next, event);
  return next;
}
