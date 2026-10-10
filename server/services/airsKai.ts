import { createError } from "h3";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { H3Event } from "h3";
import {
  kaiReviewV03Schema,
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
import {
  KAI_ASSESSMENT_VERSION, unassessedKaiSession, validateKaiLearnerQuotes,
  validateKaiSessionAssessment, validateKaiTextObservation, type KaiAssessmentEvidence,
} from '../../shared/kaiAssessment';

export function kaiReviewCacheKey(id: string, planVersion: number, basedOnTurnId: string, version?: '0.3') {
  return `REVIEW#${id}#${planVersion}#${basedOnTurnId}${version ? '#assessment-' + version : ''}`;
}

/** Read-only lookup: rich reviews take precedence; retained legacy feedback remains readable. */
export async function readSavedKaiReview(ownerId: string, id: string, event?: H3Event): Promise<KaiReview | null> {
  const study = await getStudyConversation(ownerId, id, event);
  const history = await getStudyPedagogyHistory(ownerId, id, event);
  const last = history.evidence.filter(item => study.turns.some(turn => turn.id === item.learnerTurnId && turn.role === 'USER' && !['QUESTION', 'CONTROL', 'INTRO'].includes(turn.kind || ''))).at(-1);
  const basedOnTurnId = last?.learnerTurnId || (study.objectiveFlow?.endedAt ? 'closed-' + study.objectiveFlow.endedAt : undefined);
  if (!basedOnTurnId) return null;
  return await readAirsArtifact<KaiReview>(ownerId, kaiReviewCacheKey(id, study.plan.version, basedOnTurnId, KAI_ASSESSMENT_VERSION), event)
    || await readAirsArtifact<KaiReview>(ownerId, kaiReviewCacheKey(id, study.plan.version, basedOnTurnId), event)
    || null;
}
export async function createKaiReview(
  ownerId: string,
  id: string,
  event?: H3Event,
  options: { refresh?: boolean; reviewId?: string } = {},
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
    key = kaiReviewCacheKey(id, study.plan.version, lastTurn, KAI_ASSESSMENT_VERSION);
  const existing = await readAirsArtifact<KaiReview>(ownerId, key, event);
  if (existing) return existing;
  const legacy = await readAirsArtifact<KaiReview>(ownerId, kaiReviewCacheKey(id, study.plan.version, lastTurn), event);
  if (legacy && !options.refresh) return legacy;
  if (options.refresh && (!legacy || options.reviewId !== legacy.id))
    throw createError({statusCode:409,statusMessage:'This earlier review changed. Reopen Kai’s review before refreshing it.'});
  const release = await claimAirsReview(ownerId, key, event);
  try {
    // A concurrent request may have completed between the first lookup and this claim.
    const committed = await readAirsArtifact<KaiReview>(ownerId, key, event);
    if (committed) return committed;
    if (!evidence.length) {
      const review: KaiReview = {assessmentVersion:KAI_ASSESSMENT_VERSION,id:randomUUID(),conversationId:id,planVersion:study.plan.version,basedOnTurnId:lastTurn,createdAt:new Date().toISOString(),nextPracticeStatus:'PROPOSED',closureOnly:true,sessionStatus:'ended_with_gaps',objectiveOutcomes:outcomes,observations:[],sessionAssessment:unassessedKaiSession('No reviewed learning evidence is available from this session.'),notAssessed:['Understanding was not assessed: no reviewed learning evidence is available.','Deferred or skipped objectives have not been assessed.','Audio delivery, intelligence and durable mastery.'],nextPractice:{goal:outcomes?.find(item => item.status === 'deferred')?.title || 'Choose an objective to practise',exercise:'Start a future session on an objective you deferred. No learning judgement was made in this session.',evidenceIds:[]},evidence:[]};
      await writeAirsArtifact(ownerId,key,review,event); await writeAirsArtifact(ownerId,'LATEST_REVIEW',review,event); return review;
    }
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
    const criterionIds = new Set(criteria.map((item) => item.id));
    function validateKaiEvidence(review: z.infer<typeof kaiReviewV03Schema>) {
      try {
        validateReviewEvidence(review, evidenceIds, criterionIds);
        validateKaiSessionAssessment(review.sessionAssessment, assessmentEvidence);
        for (const observation of review.observations) {
          validateKaiLearnerQuotes(observation.evidenceIds, observation.learnerQuotes, assessmentEvidence);
          validateKaiTextObservation(observation.text, observation.kind, observation.uncertainty);
        }
        return review;
      } catch {
        throw createError({
          statusCode: 502,
          statusMessage: "Kai could not link this review to your saved evidence. Your practice is saved; retry the review.",
          data: { code: "KAI_EVIDENCE_INVALID" },
        });
      }
    }
    const inputs = evidence.map((item) => ({
      id: item.id,
      sourceIds: item.sourceIds,
      attempt: study.turns.find((t) => t.id === item.learnerTurnId)?.text,
      coaching: study.turns.find((t) => t.id === item.feedbackTurnId)?.text,
      evaluationMode:item.evaluationMode,targetId:item.targetId,semantic:item.semantic,promptsUsed:item.promptsUsed ?? null,hintsUsed:item.hintsUsed ?? null,selfCorrections:item.selfCorrections ?? null,
      reasoningEligible:['reasoning','application','transfer'].includes(item.evaluationMode || study.plan.objectives.find(objective => objective.id === item.objectiveId)?.policy?.evaluationMode || '') || study.turns.find(turn => turn.id === item.learnerTurnId)?.mode === 'SCENARIO',
    }));
    const assessmentEvidence = new Map<string, KaiAssessmentEvidence>(inputs.map(item => [item.id, {
      attempt:item.attempt || '', reasoningEligible:item.reasoningEligible, semanticAcceptance:item.semantic?.semanticAcceptance,
      demonstrated:item.semantic?.demonstrated,
      transcriptionUncertainty:item.semantic?.transcriptionUncertainty,
    }]));
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
                kind: 'observation',
                learnerQuotes: [{evidenceId:evidence[0]!.id,text:inputs[0]!.attempt!.slice(0,1000)}],
              },
            ],
            sessionAssessment: unassessedKaiSession('Scripted demonstration: verbal skills are not interpreted by this fixture. Live feedback requires Kai’s model connection.'),
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
          "Review saved learner explanations against approved criteria and the objective ledger. Provide evidence-based verbal skills feedback for THIS_SESSION using SAVED_LEARNER_TEXT: exactly four domains, understanding, clarity, vocabulary, reasoning. This is feedback on observable expression, not a standardized score, level, grade, intelligence test or durable mastery claim. Stay compact within 2000 output tokens: one or two short sentences and at most two short quotes per domain, at most three short approved-focus observations, and one concise future exercise. For each domain choose observed, partial or not_assessed and cite exact learnerQuotes {evidenceId,text} from saved attempts. Every cited evidence ID needs its own exact learner quote. Understanding must respect the supplied semantic review and remaining gaps; when historical semantic review is missing, label interpretation as inference with uncertainty. Faithful paraphrase and ordinary vocabulary count; do not penalize everyday wording or demand technical terms unless the approved source-fidelity objective explicitly requires them. Clarity concerns how the saved explanation is organized; vocabulary concerns precise, source-appropriate word choice, never native-speaker rankings. Reasoning can be assessed only from a cited activity marked reasoningEligible and a quote actually showing an explanation or connection; otherwise mark not_assessed. Material transcription uncertainty requires an inference with its uncertainty, or not_assessed. For not_assessed use empty evidenceIds and learnerQuotes and explain what was not elicited. Do not invent extra learning requirements, assess deferred objectives as completed, or demand another immediate attempt. Separate observations from inferences using kind and uncertainty. Historical prompts/hints may be unknown, never invent counts or claim unaided performance. Even zero recorded app hints do not prove the learner had no other support. Coaching is tentative data, not ground truth. Do not infer pronunciation, voice, accent, pauses, pace, tempo, volume or audible delivery from text; no audio-quality data is supplied. Cite evidence for the future-practice suggestion and state missing evidence. Use only allowedEvidenceIds from the approved evaluation context; these are the exact item.id values in get_session_evidence, not source, target, turn or trace IDs. Every criterionId must be one of approvedCriterionIds. Suggest one future exercise tied to the goal, not an approved plan, new requirement, norm-based score or immediate repeat of a met target.",
          [
            {
              name: "get_approved_evaluation_context",
              description:
                "Read approved criteria, goals and contextual guidance.",
              parameters: noArgs,
              run: () => ({
                criteria,
                approvedCriterionIds: [...criterionIds],
                allowedEvidenceIds: [...evidenceIds],
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
              parameters: z.toJSONSchema(kaiReviewV03Schema) as Record<
                string,
                unknown
              >,
              run: (args) =>
                validateKaiEvidence(kaiReviewV03Schema.parse(args)),
            },
          ],
          "propose_evidence_review",
          event,
        );
    const parsed = kaiReviewV03Schema.safeParse(result.proposal);
    if (!parsed.success)
      throw createError({
        statusCode: 502,
        statusMessage: "Kai returned an invalid evidence review.",
      });
    const valid = validateKaiEvidence(parsed.data);
    const review: KaiReview = {
      ...valid,
      assessmentVersion:KAI_ASSESSMENT_VERSION,
      notAssessed:[...new Set([...valid.notAssessed,'Audio delivery: pronunciation, pauses, tempo and volume.','Intelligence, durable mastery and longitudinal progress.'])].slice(0,6),
      objectiveOutcomes:outcomes,sessionStatus:study.objectiveFlow?.sessionStatus === 'active' ? undefined : study.objectiveFlow?.sessionStatus,
      evidence: inputs.map((item) => ({
        id: item.id,
        attempt: item.attempt || "",
        promptsUsed:item.promptsUsed,hintsUsed:item.hintsUsed,transcriptionUncertainty:item.semantic?.transcriptionUncertainty || [],
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
    review = await readSavedKaiReview(ownerId, id, event);
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
    kaiReviewCacheKey(id,review.planVersion,review.basedOnTurnId,review.assessmentVersion),
    next,
    event,
  );
  await writeAirsArtifact(ownerId, "LATEST_REVIEW", next, event);
  return next;
}
