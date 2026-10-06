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
import { studySessionReviewReady } from "../../shared/studyCompletion";
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
  if (!studySessionReviewReady(study, history))
    throw createError({
      statusCode: 409,
      statusMessage:
        "Finish or explicitly end your practice session before Kai’s review.",
    });
  const evidence = history.evidence
    .filter((item) =>
      study.turns.some((turn) => turn.id === item.learnerTurnId && turn.role === 'USER' && !['QUESTION','CONTROL','INTRO'].includes(turn.kind || '')),
    )
    .slice(-12);
  if (!evidence.length && !study.objectiveFlow)
    throw createError({
      statusCode: 409,
      statusMessage: "No saved learner explanation is available for Kai yet.",
    });
  const outcomes = study.objectiveFlow?.ledger.map(entry => ({objectiveId:entry.objectiveId,title:study.plan.objectives.find(objective => objective.id === entry.objectiveId)!.title,status:entry.status,attempts:entry.targets.reduce((total,target) => total + target.attempts,0),hintsUsed:entry.targets.some(target => target.hintsUsed === null) ? null : entry.targets.reduce((total,target) => total + (target.hintsUsed || 0),0),reason:entry.deferReason || entry.unmetReason}));
  const lastTurn = evidence.at(-1)?.learnerTurnId || 'closed-' + study.objectiveFlow!.endedAt,
    key = "REVIEW#" + id + "#" + study.plan.version + "#" + lastTurn;
  const existing = await readAirsArtifact<KaiReview>(ownerId, key, event);
  if (existing) return existing;
  if (!evidence.length) {
    const review: KaiReview = {id:randomUUID(),conversationId:id,planVersion:study.plan.version,basedOnTurnId:lastTurn,createdAt:new Date().toISOString(),nextPracticeStatus:'PROPOSED',closureOnly:true,sessionStatus:'ended_with_gaps',objectiveOutcomes:outcomes,observations:[],notAssessed:['Understanding was not assessed: no reviewed learning evidence is available.','Deferred or skipped objectives have not been assessed.','Intelligence, pronunciation, tempo and durable mastery.'],nextPractice:{goal:outcomes?.find(item => item.status === 'deferred')?.title || 'Choose an objective to practise',exercise:'Start a future session on an objective you deferred. No learning judgement was made in this session.',evidenceIds:[]},evidence:[]};
    await writeAirsArtifact(ownerId,key,review,event); await writeAirsArtifact(ownerId,'LATEST_REVIEW',review,event); return review;
  }
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
      evaluationMode:item.evaluationMode,targetId:item.targetId,semantic:item.semantic,promptsUsed:item.promptsUsed ?? null,hintsUsed:item.hintsUsed ?? null,selfCorrections:item.selfCorrections ?? null,
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
          "Interpret recorded attempts against approved criteria and the supplied objective ledger. Met for this session is not durable mastery. Deferred/skipped objectives remain gaps; never call them completed. Separate observations from inferences using kind, and explain uncertainty for an inference. Historical support counts may be unknown, never invent them. Do not tutor, score intelligence, diagnose, judge personality or invent gaps. Coaching is tentative data, not ground truth. Cite evidence IDs for every observation. State missing evidence; do not assess pronunciation, pauses or tempo from text. Suggest one exercise for a future session, not an approved plan or an immediate repeat of a met target.",
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
                objectiveLedger:study.objectiveFlow?.ledger,pedagogyTrace:history.traces.filter(trace => trace.status === 'EXECUTED').map(trace => ({id:trace.id,objectiveId:trace.objectiveId,functionRefs:trace.functionRefs,controller:trace.packet.controller})),
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
      objectiveOutcomes:outcomes,sessionStatus:study.objectiveFlow?.sessionStatus === 'active' ? undefined : study.objectiveFlow?.sessionStatus,
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
