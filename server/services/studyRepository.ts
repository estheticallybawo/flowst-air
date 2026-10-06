import { randomUUID } from "node:crypto";
import { createError } from "h3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  QueryCommandOutput,
  TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { H3Event } from "h3";
import type {
  StudyConversation,
  StudyMode,
  StudyPlan,
  StudyPreferences,
  StudySource,
  StudyTurn,
  StudyVoiceUsageEvent,
} from "../../shared/study";
import { DEFAULT_STUDY_PREFERENCES } from "../../shared/study";
import { deriveStudyProgression } from "../../shared/studyProgression";
import { studyDocumentObjectivesComplete } from "../../shared/studyCompletion";
import type {
  StudyExecutionTrace,
  StudyLearningEvidence,
} from "../../shared/studyPedagogy";
import type { StudyExtraction } from "./studyExtraction";
import { awsClientConfig } from "./awsClientConfig";
import type { ObjectiveFlowState } from '../../shared/studyObjectivePolicy';
import { objectiveSessionClosed } from '../../shared/studyObjectivePolicy';
import type { StudyObjectiveOperation } from '../../shared/studyObjectiveOperation';
import type { StudyPacingState } from '../../shared/studyPacing';
import { commitMockAirsArtifact } from './airsContext';

interface StudyRecord extends Omit<
  StudyConversation,
  "turns" | "voiceUsage" | "progression"
> {
  pk: string;
  sk: "META";
  gsi2pk: string;
  gsi2sk: string;
  objectKey: string;
  entityType: "StudyConversation";
  sourcePreparing?: boolean;
}

export interface StudyChunk extends StudySource {
  text: string;
  position: number;
}
export interface StudyRecordedTurnClaim {
  recordingId: string;
  claimId: string;
  audioHash: string;
  transcript?: string;
}
interface StudyRecordedRequest {
  pk: string;
  sk: string;
  ownerId: string;
  audioHash: string;
  claimId: string;
  status: "PROCESSING" | "FAILED" | "COMPLETE";
  leaseUntil: string;
  transcript?: string;
  userTurnSk?: string;
  agentTurnSk?: string;
}
const mockRecords = new Map<string, StudyRecord>();
const mockChunks = new Map<string, StudyChunk[]>();
const mockTurns = new Map<string, StudyTurn[]>();
const mockVoiceUsage = new Map<string, StudyVoiceUsageEvent[]>();
const mockTraces = new Map<string, StudyExecutionTrace[]>();
const mockEvidence = new Map<string, StudyLearningEvidence[]>();
const mockRecordedRequests = new Map<string, StudyRecordedRequest>();
const mockObjectiveOperations = new Map<string, StudyObjectiveOperation>();
interface StudyUploadGate {
  conversationId: string;
  completed: boolean;
  createdAt: string;
  abandonedAt?: string;
}
const mockPilotUploads = new Map<string, StudyUploadGate>();
let dbClient: DynamoDBDocumentClient | undefined;
let s3Client: S3Client | undefined;

function resources(event?: H3Event) {
  const config = useRuntimeConfig(event);
  const region = String(config.awsRegion || "us-east-1");
  const table = String(config.dynamoTable || "");
  const bucket = String(config.curriculumBucket || "");
  const mock =
    config.flowstAuthMode === "mock" && process.env.NODE_ENV !== "production";
  if (!mock && (!table || !bucket))
    throw createError({
      statusCode: 503,
      statusMessage: "Flowst Air study storage is not configured.",
    });
  if (!mock) {
    dbClient ||= DynamoDBDocumentClient.from(
      new DynamoDBClient(awsClientConfig(region)),
      { marshallOptions: { removeUndefinedValues: true } },
    );
    s3Client ||= new S3Client(awsClientConfig(region));
  }
  return { mock, table, bucket, db: dbClient!, s3: s3Client! };
}
export { resources as studyStorageResources };

function standalonePilot(event?: H3Event) {
  return ["air", "amira"].includes(useRuntimeConfig(event).public?.appSurface);
}

function pilotMarker(ownerId: string) {
  return { pk: `STUDY_UPLOAD#${ownerId}`, sk: "ACTIVE" };
}

function pilotLimitMessage(deleted = false) {
  return deleted
    ? "Your unfinished study document was deleted. Explicitly abandon that study plan before uploading a replacement."
    : "Finish the objectives in your current study document before uploading another.";
}

async function studyUploadGate(
  ownerId: string,
  event?: H3Event,
): Promise<StudyUploadGate | undefined> {
  const { mock, table, db } = resources(event);
  if (mock) {
    const existing = mockPilotUploads.get(ownerId);
    if (existing) return existing;
    const latest = [...mockRecords.values()]
      .filter((record) => record.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!latest) return undefined;
    const study = await getStudyConversation(ownerId, latest.id, event);
    const complete = objectiveSessionClosed(study.objectiveFlow) || studyDocumentObjectivesComplete(
      study,
      await getStudyPedagogyHistory(ownerId, latest.id, event),
    );
    const gate = {
      conversationId: latest.id,
      completed: complete,
      createdAt: latest.createdAt,
    };
    if (!mockPilotUploads.has(ownerId)) mockPilotUploads.set(ownerId, gate);
    return mockPilotUploads.get(ownerId);
  }
  const key = pilotMarker(ownerId);
  const saved = (
    await db.send(
      new GetCommand({ TableName: table, Key: key, ConsistentRead: true }),
    )
  ).Item;
  if (saved) return saved as StudyUploadGate;
  // Adopt the latest existing study or old monthly reservation without modifying its data.
  const [records, markers] = await Promise.all([
    db.send(
      new QueryCommand({
        TableName: table,
        IndexName: "GSI2",
        KeyConditionExpression:
          "gsi2pk = :owner AND begins_with(gsi2sk, :study)",
        ExpressionAttributeValues: {
          ":owner": `USER#${ownerId}`,
          ":study": "STUDY#",
        },
        ScanIndexForward: false,
        Limit: 1,
      }),
    ),
    db.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :owner AND begins_with(sk, :month)",
        ExpressionAttributeValues: { ":owner": key.pk, ":month": "MONTH#" },
        ConsistentRead: true,
        ScanIndexForward: false,
        Limit: 1,
      }),
    ),
  ]);
  const latest = [records.Items?.[0], markers.Items?.[0]]
    .filter(Boolean)
    .sort((a, b) =>
      String(b!.createdAt || "").localeCompare(String(a!.createdAt || "")),
    )[0];
  if (!latest) return undefined;
  const id = String(latest.conversationId || latest.id);
  let complete = false;
  try {
    const study = await getStudyConversation(ownerId, id, event);
    complete = objectiveSessionClosed(study.objectiveFlow) || studyDocumentObjectivesComplete(
      study,
      await getStudyPedagogyHistory(ownerId, id, event),
    );
  } catch (cause) {
    if ((cause as { statusCode?: number }).statusCode !== 404) throw cause;
  }
  const gate = {
    conversationId: id,
    completed: complete,
    createdAt: String(latest.createdAt || ""),
  };
  try {
    await db.send(
      new PutCommand({
        TableName: table,
        Item: { ...key, ...gate, ownerId, entityType: "StudyUploadGate" },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  } catch (cause) {
    if ((cause as Error).name !== "ConditionalCheckFailedException")
      throw cause;
  }
  return (
    await db.send(
      new GetCommand({ TableName: table, Key: key, ConsistentRead: true }),
    )
  ).Item as StudyUploadGate;
}

export async function getStudyUploadEligibility(
  ownerId: string,
  event?: H3Event,
  _now = new Date(),
) {
  if (!standalonePilot(event))
    return { canUpload: true as const, completionRequired: false };
  const gate = await studyUploadGate(ownerId, event);
  if (!gate || gate.completed || gate.abandonedAt)
    return { canUpload: true as const, completionRequired: false };
  let existingConversationId: string | undefined;
  try {
    existingConversationId = (
      await getStudyConversation(ownerId, gate.conversationId, event)
    ).id;
  } catch (cause) {
    if ((cause as { statusCode?: number }).statusCode !== 404) throw cause;
  }
  return {
    canUpload: false as const,
    completionRequired: true,
    activeConversationId: gate.conversationId,
    existingConversationId,
    reasonCode: existingConversationId
      ? ("ACTIVE_STUDY_UNFINISHED" as const)
      : ("ACTIVE_STUDY_DELETED" as const),
    reason: pilotLimitMessage(!existingConversationId),
  };
}

export async function assertStudyUploadAvailable(
  ownerId: string,
  event?: H3Event,
  now = new Date(),
) {
  const eligibility = await getStudyUploadEligibility(ownerId, event, now);
  if (!eligibility.canUpload)
    throw createError({
      statusCode: 409,
      statusMessage: eligibility.reason,
      data: {
        code: "AMIRA_STUDY_COMPLETION_REQUIRED",
        reasonCode: eligibility.reasonCode,
        activeConversationId: eligibility.activeConversationId,
        nextAction: eligibility.existingConversationId
          ? `/air/${eligibility.existingConversationId}`
          : "/air/settings",
        upgradeAvailable: false,
      },
    });
}

/** Explicit abandonment releases the upload gate, never the completion checkpoint. */
export async function abandonStudyDocument(
  ownerId: string,
  id: string,
  event?: H3Event,
) {
  const gate = await studyUploadGate(ownerId, event);
  if (!gate || gate.conversationId !== id)
    throw createError({
      statusCode: 409,
      statusMessage:
        "This is not your current study document. Refresh your library.",
    });
  let current: StudyConversation | undefined;
  try {
    current = await getStudyConversation(ownerId, id, event);
  } catch (cause) {
    if ((cause as { statusCode?: number }).statusCode !== 404) throw cause;
  }
  if (await studyLiveLease(id, event))
    throw createError({
      statusCode: 409,
      statusMessage: "End the live call before replacing this study document.",
    });
  if (gate.abandonedAt && (!current || current.abandonedAt))
    return getStudyUploadEligibility(ownerId, event);
  const { mock, table, db } = resources(event);
  const abandonedAt =
    current?.abandonedAt || gate.abandonedAt || new Date().toISOString();
  if (mock) {
    const record = mockRecords.get(id);
    const active = mockPilotUploads.get(ownerId);
    if (
      active?.conversationId !== id ||
      (record?.ownerId && record.ownerId !== ownerId) ||
      record?.revision !== current?.revision ||
      (mockLiveLeases.get(id)?.expiresAt || 0) > Date.now()
    )
      throw createError({
        statusCode: 409,
        statusMessage:
          "This study chat changed. End any active call, refresh, and try again.",
      });
    if (record && !record.abandonedAt)
      mockRecords.set(id, {
        ...record,
        abandonedAt,
        updatedAt: abandonedAt,
        revision: record.revision + 1,
      });
    mockPilotUploads.set(ownerId, { ...active, abandonedAt });
  } else {
    try {
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              ConditionCheck: {
                TableName: table,
                Key: { pk: `STUDY#${id}`, sk: "LIVE#VOICE" },
                ConditionExpression:
                  "attribute_not_exists(pk) OR expiresAt <= :now",
                ExpressionAttributeValues: { ":now": Date.now() },
              },
            },
            {
              Update: {
                TableName: table,
                Key: pilotMarker(ownerId),
                UpdateExpression: "SET abandonedAt = :when",
                ConditionExpression:
                  "ownerId = :owner AND conversationId = :id",
                ExpressionAttributeValues: {
                  ":when": abandonedAt,
                  ":owner": ownerId,
                  ":id": id,
                },
              },
            },
            ...(current
              ? [
                  {
                    Update: {
                      TableName: table,
                      Key: { pk: `STUDY#${id}`, sk: "META" },
                      UpdateExpression:
                        "SET abandonedAt = :when, updatedAt = :when, revision = :next",
                      ConditionExpression:
                        "ownerId = :owner AND revision = :revision",
                      ExpressionAttributeValues: {
                        ":when": abandonedAt,
                        ":next": current.revision + 1,
                        ":owner": ownerId,
                        ":revision": current.revision,
                      },
                    },
                  },
                ]
              : [
                  {
                    ConditionCheck: {
                      TableName: table,
                      Key: { pk: `STUDY#${id}`, sk: "META" },
                      ConditionExpression: "attribute_not_exists(pk)",
                    },
                  },
                ]),
          ],
        }),
      );
    } catch (cause) {
      if ((cause as Error).name === "TransactionCanceledException")
        throw createError({
          statusCode: 409,
          statusMessage:
            "End any active call and refresh your current study document before replacing it.",
        });
      throw cause;
    }
  }
  return getStudyUploadEligibility(ownerId, event);
}

/** Abandonment ends future study usage, without hiding or deleting saved evidence. */
export function assertStudyConversationActive(conversation: StudyConversation) {
  if (conversation.abandonedAt)
    throw createError({
      statusCode: 409,
      statusMessage:
        "This study plan was ended early. Your saved conversation is available to read or delete; upload a replacement to study again.",
      data: {
        code: "AMIRA_STUDY_ABANDONED",
        conversationId: conversation.id,
        nextAction: "/airs/new",
        upgradeAvailable: false,
      },
    });
}

function recordedTurnKey(id: string, recordingId: string) {
  return { pk: `STUDY#${id}`, sk: `RECORDED#${recordingId}` };
}

function recordedTurnConflict() {
  return createError({
    statusCode: 409,
    statusMessage:
      "This recording is still processing. Wait a moment and retry the same take.",
  });
}

async function recordedTurnResult(
  id: string,
  request: StudyRecordedRequest,
  event?: H3Event,
) {
  if (request.status !== "COMPLETE") return undefined;
  if (!request.userTurnSk || !request.agentTurnSk)
    throw createError({
      statusCode: 503,
      statusMessage:
        "Your saved response is still loading. Retry this take in a moment.",
    });
  const { mock, table, db } = resources(event);
  const turns = mock
    ? [
        mockTurns
          .get(id)
          ?.find(
            (turn) =>
              `TURN#${turn.createdAt}#${turn.id}` === request.userTurnSk,
          ),
        mockTurns
          .get(id)
          ?.find(
            (turn) =>
              `TURN#${turn.createdAt}#${turn.id}` === request.agentTurnSk,
          ),
      ]
    : await Promise.all(
        [request.userTurnSk, request.agentTurnSk].map(
          async (sk) =>
            (
              await db.send(
                new GetCommand({
                  TableName: table,
                  Key: { pk: `STUDY#${id}`, sk },
                  ConsistentRead: true,
                }),
              )
            ).Item?.turn as StudyTurn | undefined,
        ),
      );
  if (!turns[0] || !turns[1])
    throw createError({
      statusCode: 503,
      statusMessage:
        "Your saved response is still loading. Retry this take in a moment.",
    });
  return { userTurn: turns[0], agentTurn: turns[1] };
}

export async function getCompletedRecordedStudyTurn(
  ownerId: string,
  id: string,
  recordingId: string,
  audioHash: string,
  event?: H3Event,
) {
  await getStudyConversation(ownerId, id, event);
  const { mock, table, db } = resources(event);
  const key = recordedTurnKey(id, recordingId);
  const request = mock
    ? mockRecordedRequests.get(`${id}#${recordingId}`)
    : ((
        await db.send(
          new GetCommand({ TableName: table, Key: key, ConsistentRead: true }),
        )
      ).Item as StudyRecordedRequest | undefined);
  if (!request) return undefined;
  if (request.ownerId !== ownerId || request.audioHash !== audioHash)
    throw createError({
      statusCode: 409,
      statusMessage: "This recording ID belongs to a different take.",
    });
  return recordedTurnResult(id, request, event);
}

export async function claimRecordedStudyTurn(
  ownerId: string,
  id: string,
  recordingId: string,
  audioHash: string,
  event?: H3Event,
): Promise<
  | { status: "CLAIMED"; claim: StudyRecordedTurnClaim }
  | { status: "PROCESSING" }
  | { status: "COMPLETE"; userTurn: StudyTurn; agentTurn: StudyTurn }
> {
  await getStudyConversation(ownerId, id, event);
  const { mock, table, db } = resources(event);
  const key = recordedTurnKey(id, recordingId);
  const now = new Date().toISOString();
  const leaseUntil = new Date(Date.now() + 10 * 60_000).toISOString();
  const claimId = randomUUID();
  const existing = mock
    ? mockRecordedRequests.get(`${id}#${recordingId}`)
    : ((
        await db.send(
          new GetCommand({ TableName: table, Key: key, ConsistentRead: true }),
        )
      ).Item as StudyRecordedRequest | undefined);
  if (existing) {
    if (existing.ownerId !== ownerId || existing.audioHash !== audioHash)
      throw createError({
        statusCode: 409,
        statusMessage: "This recording ID belongs to a different take.",
      });
    const completed = await recordedTurnResult(id, existing, event);
    if (completed) return { status: "COMPLETE", ...completed };
    if (existing.status === "PROCESSING" && existing.leaseUntil > now)
      return { status: "PROCESSING" };
  }
  const request: StudyRecordedRequest = {
    ...key,
    ownerId,
    audioHash,
    claimId,
    status: "PROCESSING",
    leaseUntil,
    transcript: existing?.transcript,
  };
  if (mock) mockRecordedRequests.set(`${id}#${recordingId}`, request);
  else {
    try {
      if (existing) {
        await db.send(
          new UpdateCommand({
            TableName: table,
            Key: key,
            UpdateExpression:
              "SET claimId = :claim, leaseUntil = :lease, #status = :processing",
            ConditionExpression:
              "ownerId = :owner AND audioHash = :hash AND (#status = :failed OR (#status = :processing AND leaseUntil <= :now))",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
              ":claim": claimId,
              ":lease": leaseUntil,
              ":processing": "PROCESSING",
              ":failed": "FAILED",
              ":owner": ownerId,
              ":hash": audioHash,
              ":now": now,
            },
          }),
        );
      } else {
        await db.send(
          new PutCommand({
            TableName: table,
            Item: request,
            ConditionExpression: "attribute_not_exists(pk)",
          }),
        );
      }
    } catch (error: any) {
      if (error?.name === "ConditionalCheckFailedException")
        return { status: "PROCESSING" };
      throw error;
    }
  }
  return {
    status: "CLAIMED",
    claim: {
      recordingId,
      claimId,
      audioHash,
      transcript: existing?.transcript,
    },
  };
}

export async function saveRecordedStudyTranscript(
  ownerId: string,
  id: string,
  claim: StudyRecordedTurnClaim,
  transcript: string,
  event?: H3Event,
) {
  await getStudyConversation(ownerId, id, event);
  const { mock, table, db } = resources(event);
  const key = recordedTurnKey(id, claim.recordingId);
  if (mock) {
    const request = mockRecordedRequests.get(`${id}#${claim.recordingId}`);
    if (
      !request ||
      request.ownerId !== ownerId ||
      request.claimId !== claim.claimId ||
      request.status !== "PROCESSING"
    )
      throw recordedTurnConflict();
    request.transcript = transcript;
  } else {
    try {
      await db.send(
        new UpdateCommand({
          TableName: table,
          Key: key,
          UpdateExpression: "SET transcript = :text",
          ConditionExpression:
            "ownerId = :owner AND claimId = :claim AND #status = :processing",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":text": transcript,
            ":owner": ownerId,
            ":claim": claim.claimId,
            ":processing": "PROCESSING",
          },
        }),
      );
    } catch (error: any) {
      if (error?.name === "ConditionalCheckFailedException")
        throw recordedTurnConflict();
      throw error;
    }
  }
}

export async function failRecordedStudyTurn(
  ownerId: string,
  id: string,
  claim: StudyRecordedTurnClaim,
  event?: H3Event,
) {
  const { mock, table, db } = resources(event);
  const key = recordedTurnKey(id, claim.recordingId);
  if (mock) {
    const request = mockRecordedRequests.get(`${id}#${claim.recordingId}`);
    if (
      request?.ownerId === ownerId &&
      request.claimId === claim.claimId &&
      request.status === "PROCESSING"
    )
      request.status = "FAILED";
  } else {
    await db
      .send(
        new UpdateCommand({
          TableName: table,
          Key: key,
          UpdateExpression: "SET #status = :failed, leaseUntil = :now",
          ConditionExpression:
            "ownerId = :owner AND claimId = :claim AND #status = :processing",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":failed": "FAILED",
            ":now": new Date().toISOString(),
            ":owner": ownerId,
            ":claim": claim.claimId,
            ":processing": "PROCESSING",
          },
        }),
      )
      .catch((error) => {
        if (error?.name !== "ConditionalCheckFailedException") throw error;
      });
  }
}

export function indexStudySections(extraction: StudyExtraction): StudyChunk[] {
  const chunks: StudyChunk[] = [];
  for (const section of extraction.sections) {
    let position = 0;
    while (position < section.text.length) {
      const end = Math.min(position + 1100, section.text.length);
      const text = section.text.slice(position, end).trim();
      if (text)
        chunks.push({
          id: `${section.id}-${position}`,
          label: section.label,
          excerpt: text.slice(0, 1000),
          text,
          position: chunks.length,
          ...(section.location ? { location: section.location } : {}),
        });
      if (end === section.text.length) break;
      position = end - 120;
    }
  }
  return chunks;
}

function publicRecord(
  record: StudyRecord,
  turns: StudyTurn[],
  usage: StudyVoiceUsageEvent[] = [],
): StudyConversation {
  const {
    pk: _pk,
    sk: _sk,
    gsi2pk: _gsi2pk,
    gsi2sk: _gsi2sk,
    objectKey: _objectKey,
    entityType: _entityType,
    sourcePreparing: _sourcePreparing,
    ...conversation
  } = record;
  const plan = conversation.plan || {
    status: "PENDING" as const,
    version: 0,
    objectives: [],
  };
  return {
    ...conversation,
    plan,
    turns,
    progression: deriveStudyProgression({
      plan,
      mode: conversation.mode,
      practice: conversation.practice,
    }),
    voiceUsage: {
      transcribeSeconds: usage
        .filter(
          (item) =>
            item.kind === "TRANSCRIBE" ||
            item.kind === "SONIC_INPUT" ||
            item.kind === "ELEVEN_INPUT" ||
            item.kind === "ELEVEN_CALL",
        )
        .reduce((sum, item) => sum + item.units, 0),
      pollyCharacters: usage
        .filter(
          (item) =>
            item.kind === "POLLY" ||
            item.kind === "SONIC_OUTPUT" ||
            item.kind === "ELEVEN_OUTPUT" ||
            item.kind === "ELEVEN_LIVE_OUTPUT",
        )
        .reduce((sum, item) => sum + item.units, 0),
      estimatedUsd: usage.some((item) => item.estimatedUsd === undefined)
        ? undefined
        : usage.reduce((sum, item) => sum + (item.estimatedUsd || 0), 0),
    },
  };
}

export async function createStudyConversation(
  ownerId: string,
  name: string,
  contentType: string,
  bytes: Buffer,
  extraction: StudyExtraction,
  event?: H3Event,
  preferences?: StudyPreferences,
  sourceId?: string,
) {
  const id = sourceId || randomUUID();
  const now = new Date().toISOString();
  const chunks = indexStudySections(extraction);
  if (!chunks.length)
    throw createError({
      statusCode: 422,
      statusMessage: "No searchable document text was found.",
    });
  const pilot = standalonePilot(event);
  if (pilot) await assertStudyUploadAvailable(ownerId, event, new Date(now));
  const marker = pilot ? pilotMarker(ownerId) : undefined;
  const record: StudyRecord = {
    id,
    ownerId,
    pk: `STUDY#${id}`,
    sk: "META",
    gsi2pk: `USER#${ownerId}`,
    gsi2sk: `STUDY#${now}#${id}`,
    objectKey: `study/${ownerId}/${id}/original.${extraction.kind.toLowerCase()}`,
    entityType: "StudyConversation",
    document: {
      id: randomUUID(),
      name: name.slice(0, 180),
      kind: extraction.kind,
      createdAt: now,
      excerpt: extraction.excerpt,
      sectionCount: extraction.sections.length,
      ...(extraction.provenance ? { provenance: extraction.provenance } : {}),
    },
    mode: "DISCUSSION",
    practice: {
      questionNumber: 0,
      totalQuestions: 5,
      awaitingAnswer: false,
      attempts: [],
    },
    plan: { status: "PENDING", version: 0, objectives: [] },
    preferences: preferences || { ...DEFAULT_STUDY_PREFERENCES },
    createdAt: now,
    updatedAt: now,
    revision: 0,
  };
  const { mock, table, bucket, db, s3 } = resources(event);
  if (mock) {
    if (marker) {
      // Keep the final check and reservation together, with no await between them.
      const gate = mockPilotUploads.get(ownerId);
      if (gate && !gate.completed && !gate.abandonedAt)
        throw createError({
          statusCode: 409,
          statusMessage: pilotLimitMessage(),
          data: {
            code: "AMIRA_STUDY_COMPLETION_REQUIRED",
            activeConversationId: gate.conversationId,
            nextAction: `/air/${gate.conversationId}`,
          },
        });
      mockPilotUploads.set(ownerId, {
        conversationId: id,
        completed: false,
        createdAt: now,
      });
    }
    mockRecords.set(id, record);
    mockChunks.set(id, chunks);
    mockTurns.set(id, []);
    mockVoiceUsage.set(id, []);
    mockTraces.set(id, []);
    mockEvidence.set(id, []);
  } else {
    if (sourceId) record.sourcePreparing = true;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: record.objectKey,
        Body: bytes,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      }),
    );
    let metadataSaved = false;
    try {
      if (marker) {
        await db.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: table,
                  Item: {
                    ...marker,
                    ownerId,
                    conversationId: id,
                    createdAt: now,
                    completed: false,
                    entityType: "StudyUploadGate",
                  },
                  ConditionExpression:
                    "attribute_not_exists(pk) OR completed = :yes OR attribute_exists(abandonedAt)",
                  ExpressionAttributeValues: { ":yes": true },
                },
              },
              {
                Put: {
                  TableName: table,
                  Item: record,
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
            ],
          }),
        );
      } else {
        await db.send(
          new PutCommand({
            TableName: table,
            Item: record,
            ConditionExpression: "attribute_not_exists(pk)",
          }),
        );
      }
      metadataSaved = true;
      for (let offset = 0; offset < chunks.length; offset += 25) {
        const batch = chunks.slice(offset, offset + 25).map((chunk) => ({
          PutRequest: {
            Item: {
              pk: record.pk,
              sk: `CHUNK#${String(chunk.position).padStart(4, "0")}`,
              ...chunk,
            },
          },
        }));
        let pending = { [table]: batch };
        let retries = 0;
        do {
          const response = await db.send(
            new BatchWriteCommand({ RequestItems: pending }),
          );
          pending = (response.UnprocessedItems || {}) as typeof pending;
          if (pending[table]?.length && ++retries >= 5)
            throw createError({
              statusCode: 503,
              statusMessage:
                "Source storage is busy. Your source could not be fully saved.",
            });
        } while (pending[table]?.length);
      }
      if (sourceId) {
        await db.send(
          new UpdateCommand({
            TableName: table,
            Key: { pk: record.pk, sk: "META" },
            UpdateExpression: "REMOVE sourcePreparing",
            ConditionExpression: "ownerId = :owner",
            ExpressionAttributeValues: { ":owner": ownerId },
          }),
        );
        delete record.sourcePreparing;
      }
    } catch (error) {
      if (metadataSaved) {
        const removed = await deleteStudyConversation(ownerId, id, event)
          .then(() => true)
          .catch(() => false);
        if (removed && marker) {
          await db
            .send(
              new DeleteCommand({
                TableName: table,
                Key: marker,
                ConditionExpression: "conversationId = :id",
                ExpressionAttributeValues: { ":id": id },
              }),
            )
            .catch(() => undefined);
        }
      }
      await s3
        .send(
          new DeleteObjectCommand({ Bucket: bucket, Key: record.objectKey }),
        )
        .catch(() => undefined);
      if (
        marker &&
        (error as { name?: string })?.name === "TransactionCanceledException"
      ) {
        await assertStudyUploadAvailable(ownerId, event, new Date(now));
      }
      throw error;
    }
  }
  return publicRecord(record, []);
}

export async function getStudyConversation(
  ownerId: string,
  id: string,
  event?: H3Event,
): Promise<StudyConversation> {
  const { mock, table, db } = resources(event);
  const record = mock
    ? mockRecords.get(id)
    : ((
        await db.send(
          new GetCommand({
            TableName: table,
            Key: { pk: `STUDY#${id}`, sk: "META" },
            ConsistentRead: true,
          }),
        )
      ).Item as StudyRecord | undefined);
  if (!record || record.ownerId !== ownerId)
    throw createError({
      statusCode: 404,
      statusMessage: "Study chat not found.",
    });
  if (record.sourcePreparing)
    throw createError({
      statusCode: 503,
      statusMessage: "Your source is still being saved. Check again shortly.",
    });
  if (mock)
    return publicRecord(
      record,
      mockTurns.get(id) || [],
      mockVoiceUsage.get(id) || [],
    );
  const turns: StudyTurn[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await db.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :turn)",
        ExpressionAttributeValues: { ":pk": record.pk, ":turn": "TURN#" },
        ConsistentRead: true,
        ScanIndexForward: true,
        ExclusiveStartKey: cursor,
      }),
    );
    turns.push(...(result.Items || []).map((item) => item.turn as StudyTurn));
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  const usage: StudyVoiceUsageEvent[] = [];
  cursor = undefined;
  do {
    const result: QueryCommandOutput = await db.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :usage)",
        ExpressionAttributeValues: { ":pk": record.pk, ":usage": "USAGE#" },
        ConsistentRead: true,
        ExclusiveStartKey: cursor,
      }),
    );
    usage.push(
      ...(result.Items || []).map((item) => item.usage as StudyVoiceUsageEvent),
    );
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return publicRecord(record, turns, usage);
}

type VoiceUsageReservation = Omit<StudyVoiceUsageEvent, "id" | "createdAt">;
interface StudyVoiceAllowance {
  ownerId: string;
  transcribeSeconds: number;
  pollyCharacters: number;
}
interface LiveOutputReservation {
  leaseId: string;
  outputBudget: number;
}

function recordedVoiceUsage(kind: StudyVoiceUsageEvent["kind"]) {
  return ["TRANSCRIBE", "POLLY", "ELEVEN_INPUT", "ELEVEN_OUTPUT"].includes(
    kind,
  );
}
function inputVoiceUsage(kind: StudyVoiceUsageEvent["kind"]) {
  return ["TRANSCRIBE", "SONIC_INPUT", "ELEVEN_INPUT", "ELEVEN_CALL"].includes(
    kind,
  );
}
function assertVoiceUsageTotals(
  totals: StudyVoiceAllowance,
  field: "transcribeSeconds" | "pollyCharacters",
  units: number,
) {
  if (
    !Number.isSafeInteger(totals.transcribeSeconds) ||
    totals.transcribeSeconds < 0 ||
    !Number.isSafeInteger(totals.pollyCharacters) ||
    totals.pollyCharacters < 0 ||
    !Number.isSafeInteger(totals[field] + units)
  )
    throw createError({
      statusCode: 503,
      statusMessage:
        "Voice usage could not be recorded safely. Your saved conversation is still available.",
    });
}
function recordedVoiceLeaseError() {
  return createError({
    statusCode: 409,
    statusMessage: "End the live call before using recorded voice.",
  });
}
function liveOutputAllowanceError() {
  return createError({
    statusCode: 429,
    statusMessage: "This call has ended or reached its reply allowance.",
  });
}

/** Record before dispatch. Failed or uncertain provider work retains usage; success does not charge again. */
export async function reserveStudyVoiceUsage(
  ownerId: string,
  id: string,
  usage: VoiceUsageReservation,
  event?: H3Event,
) {
  return commitStudyVoiceUsage(ownerId, id, usage, event);
}

/** Live and recorded usage share the same private accounting ledger, without a cumulative ceiling. */
export async function appendStudyVoiceUsage(
  ownerId: string,
  id: string,
  usage: VoiceUsageReservation,
  event?: H3Event,
) {
  return reserveStudyVoiceUsage(ownerId, id, usage, event);
}

async function commitStudyVoiceUsage(
  ownerId: string,
  id: string,
  usage: VoiceUsageReservation,
  event?: H3Event,
  liveOutput?: LiveOutputReservation,
) {
  const field = inputVoiceUsage(usage.kind)
    ? "transcribeSeconds"
    : "pollyCharacters";
  if (!Number.isSafeInteger(usage.units) || usage.units <= 0)
    throw createError({
      statusCode: 400,
      statusMessage:
        "Voice usage must be a positive, safely represented number of units.",
    });
  assertStudyConversationActive(await getStudyConversation(ownerId, id, event));
  const item: StudyVoiceUsageEvent = {
    ...usage,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const { mock, table, db } = resources(event);
  if (mock) {
    // Re-read after awaits, then check and reserve without yielding to another request.
    const record = mockRecords.get(id);
    if (!record || record.ownerId !== ownerId)
      throw createError({
        statusCode: 404,
        statusMessage: "Study chat not found.",
      });
    const current = publicRecord(record, [], mockVoiceUsage.get(id) || []);
    assertStudyConversationActive(current);
    const lease = mockLiveLeases.get(id);
    if (recordedVoiceUsage(usage.kind) && (lease?.expiresAt || 0) > Date.now())
      throw recordedVoiceLeaseError();
    if (
      liveOutput &&
      (!lease ||
        lease.ownerId !== ownerId ||
        lease.leaseId !== liveOutput.leaseId ||
        lease.expiresAt <= Date.now() ||
        (lease.outputUsed || 0) + usage.units > (lease.outputBudget || 0))
    )
      throw liveOutputAllowanceError();
    assertVoiceUsageTotals(
      {
        ownerId,
        transcribeSeconds: current.voiceUsage?.transcribeSeconds ?? 0,
        pollyCharacters: current.voiceUsage?.pollyCharacters ?? 0,
      },
      field,
      usage.units,
    );
    if (liveOutput) lease!.outputUsed = (lease!.outputUsed || 0) + usage.units;
    mockVoiceUsage.set(id, [...(mockVoiceUsage.get(id) || []), item]);
    return item;
  }

  const allowanceKey = { pk: `STUDY#${id}`, sk: "VOICE#ALLOWANCE" };
  for (let attempt = 0; attempt < 5; attempt++) {
    const saved = (
      await db.send(
        new GetCommand({
          TableName: table,
          Key: allowanceKey,
          ConsistentRead: true,
        }),
      )
    ).Item as StudyVoiceAllowance | undefined;
    // Older documents only have usage events. Adopt those totals once, under an absence condition.
    const current = saved
      ? undefined
      : await getStudyConversation(ownerId, id, event);
    const allowance: StudyVoiceAllowance = saved || {
      ownerId,
      transcribeSeconds: current?.voiceUsage?.transcribeSeconds ?? 0,
      pollyCharacters: current?.voiceUsage?.pollyCharacters ?? 0,
    };
    if (allowance.ownerId !== ownerId)
      throw createError({
        statusCode: 404,
        statusMessage: "Study chat not found.",
      });
    assertVoiceUsageTotals(allowance, field, usage.units);
    const writes: NonNullable<TransactWriteCommandInput["TransactItems"]> = [
      {
        ConditionCheck: {
          TableName: table,
          Key: { pk: `STUDY#${id}`, sk: "META" },
          ConditionExpression:
            "ownerId = :owner AND attribute_not_exists(abandonedAt)",
          ExpressionAttributeValues: { ":owner": ownerId },
        },
      },
      saved
        ? {
            Update: {
              TableName: table,
              Key: allowanceKey,
              UpdateExpression: `SET ${field} = ${field} + :units`,
              ConditionExpression: `ownerId = :owner AND ${field} = :previous`,
              ExpressionAttributeValues: {
                ":owner": ownerId,
                ":units": usage.units,
                ":previous": allowance[field],
              },
            },
          }
        : {
            Put: {
              TableName: table,
              Item: {
                ...allowanceKey,
                ...allowance,
                [field]: allowance[field] + usage.units,
              },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
      {
        Put: {
          TableName: table,
          Item: {
            pk: `STUDY#${id}`,
            sk: `USAGE#${item.createdAt}#${item.id}`,
            usage: item,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        },
      },
    ];
    if (recordedVoiceUsage(usage.kind))
      writes.push({
        ConditionCheck: {
          TableName: table,
          Key: { pk: `STUDY#${id}`, sk: "LIVE#VOICE" },
          ConditionExpression: "attribute_not_exists(pk) OR expiresAt <= :now",
          ExpressionAttributeValues: { ":now": Date.now() },
        },
      });
    if (liveOutput)
      writes.push({
        Update: {
          TableName: table,
          Key: { pk: `STUDY#${id}`, sk: "LIVE#VOICE" },
          UpdateExpression: "SET outputUsed = outputUsed + :units",
          ConditionExpression:
            "ownerId = :owner AND leaseId = :lease AND expiresAt > :now AND outputUsed <= :remaining",
          ExpressionAttributeValues: {
            ":owner": ownerId,
            ":lease": liveOutput.leaseId,
            ":now": Date.now(),
            ":units": usage.units,
            ":remaining": liveOutput.outputBudget - usage.units,
          },
        },
      });
    try {
      await db.send(
        new TransactWriteCommand({
          ClientRequestToken: randomUUID(),
          TransactItems: writes,
        }),
      );
      return item;
    } catch (cause) {
      // Only a rejected transaction is safe to re-evaluate. Unknown write outcomes never trigger provider work.
      if (
        ![
          "TransactionCanceledException",
          "TransactionConflictException",
        ].includes((cause as Error).name)
      )
        throw cause;
      assertStudyConversationActive(
        await getStudyConversation(ownerId, id, event),
      );
      const lease = await studyLiveLease(id, event);
      if (recordedVoiceUsage(usage.kind) && lease)
        throw recordedVoiceLeaseError();
      if (
        liveOutput &&
        (lease?.ownerId !== ownerId ||
          lease.leaseId !== liveOutput.leaseId ||
          (lease.outputUsed || 0) + usage.units > (lease.outputBudget || 0))
      )
        throw liveOutputAllowanceError();
    }
  }
  throw createError({
    statusCode: 409,
    statusMessage: "Voice usage is busy. Try again.",
  });
}

export async function listStudyConversations(ownerId: string, event?: H3Event) {
  const { mock, table, db } = resources(event);
  const records = mock
    ? [...mockRecords.values()].filter((item) => item.ownerId === ownerId)
    : ((
        await db.send(
          new QueryCommand({
            TableName: table,
            IndexName: "GSI2",
            KeyConditionExpression:
              "gsi2pk = :owner AND begins_with(gsi2sk, :study)",
            ExpressionAttributeValues: {
              ":owner": `USER#${ownerId}`,
              ":study": "STUDY#",
            },
            ScanIndexForward: false,
            Limit: 40,
          }),
        )
      ).Items as StudyRecord[]) || [];
  return records
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((record) => ({
      id: record.id,
      document: record.document,
      mode: record.mode,
      planStatus: record.plan?.status || "PENDING",
      abandonedAt: record.abandonedAt,
      updatedAt: record.updatedAt,
    }));
}

export async function saveStudyPlan(
  ownerId: string,
  id: string,
  plan: StudyPlan,
  expectedRevision: number,
  event?: H3Event,
  documentTitle?: string,
  preferences?: StudyPreferences,
) {
  const current = await getStudyConversation(ownerId, id, event);
  assertStudyConversationActive(current);
  if (current.revision !== expectedRevision)
    throw createError({
      statusCode: 409,
      statusMessage: "This study chat changed. Reload and try again.",
    });
  const { mock, table, db } = resources(event);
  const updatedAt = new Date().toISOString();
  const gate = standalonePilot(event)
    ? await studyUploadGate(ownerId, event)
    : undefined;
  const updateGate = gate?.conversationId === id;
  const completed =
    updateGate &&
    studyDocumentObjectivesComplete(
      { ...current, plan },
      await getStudyPedagogyHistory(ownerId, id, event),
    );
  if (mock) {
    const record = mockRecords.get(id)!;
    assertStudyConversationActive(publicRecord(record, []));
    if (record.revision !== expectedRevision)
      throw createError({
        statusCode: 409,
        statusMessage: "This study chat changed. Reload and try again.",
      });
    mockRecords.set(id, {
      ...record,
      document: documentTitle
        ? { ...record.document, title: documentTitle }
        : record.document,
      plan,
      preferences: preferences || record.preferences,
      revision: expectedRevision + 1,
      updatedAt,
    });
    if (updateGate)
      mockPilotUploads.set(ownerId, {
        ...gate!,
        completed: Boolean(completed),
      });
  } else {
    const record = (
      await db.send(
        new GetCommand({
          TableName: table,
          Key: { pk: `STUDY#${id}`, sk: "META" },
          ConsistentRead: true,
        }),
      )
    ).Item as StudyRecord;
    try {
      const saved = {
        TableName: table,
        Item: {
          ...record,
          document: documentTitle
            ? { ...record.document, title: documentTitle }
            : record.document,
          plan,
          preferences: preferences || record.preferences,
          revision: expectedRevision + 1,
          updatedAt,
        },
        ConditionExpression:
          "ownerId = :owner AND revision = :revision AND attribute_not_exists(abandonedAt)",
        ExpressionAttributeValues: {
          ":owner": ownerId,
          ":revision": expectedRevision,
        },
      };
      if (updateGate)
        await db.send(
          new TransactWriteCommand({
            TransactItems: [
              { Put: saved },
              {
                Update: {
                  TableName: table,
                  Key: pilotMarker(ownerId),
                  UpdateExpression: "SET completed = :completed",
                  ConditionExpression:
                    "ownerId = :owner AND conversationId = :id",
                  ExpressionAttributeValues: {
                    ":completed": Boolean(completed),
                    ":owner": ownerId,
                    ":id": id,
                  },
                },
              },
            ],
          }),
        );
      else await db.send(new PutCommand(saved));
    } catch (error: any) {
      if (
        error?.name === "ConditionalCheckFailedException" ||
        error?.name === "TransactionCanceledException"
      )
        throw createError({
          statusCode: 409,
          statusMessage: "This study chat changed. Reload and try again.",
        });
      throw error;
    }
  }
  return {
    ...current,
    document: documentTitle
      ? { ...current.document, title: documentTitle }
      : current.document,
    plan,
    preferences: preferences || current.preferences,
    progression: deriveStudyProgression({
      plan,
      mode: current.mode,
      practice: current.practice,
    }),
    revision: expectedRevision + 1,
    updatedAt,
  };
}

export async function getStudyChunks(
  ownerId: string,
  id: string,
  event?: H3Event,
): Promise<StudyChunk[]> {
  await getStudyConversation(ownerId, id, event);
  const { mock, table, db } = resources(event);
  if (mock) return mockChunks.get(id) || [];
  const chunks: StudyChunk[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await db.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :chunk)",
        ExpressionAttributeValues: { ":pk": `STUDY#${id}`, ":chunk": "CHUNK#" },
        ExclusiveStartKey: cursor,
      }),
    );
    chunks.push(
      ...(result.Items || []).map((item) => ({
        id: item.id,
        label: item.label,
        excerpt: item.excerpt,
        text: item.text,
        position: item.position,
      })),
    );
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return chunks;
}

export async function appendStudyTurn(
  ownerId: string,
  id: string,
  turn: StudyTurn,
  event?: H3Event,
) {
  await getStudyConversation(ownerId, id, event);
  const { mock, table, db } = resources(event);
  if (mock) {
    const turns = mockTurns.get(id) || [];
    if (!turns.some((item) => item.id === turn.id)) turns.push(turn);
    mockTurns.set(id, turns);
    return;
  }
  const record = {
    pk: `STUDY#${id}`,
    sk: `TURN#${turn.createdAt}#${turn.id}`,
    turn,
  };
  await db
    .send(
      new PutCommand({
        TableName: table,
        Item: record,
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    )
    .catch((error) => {
      if (error?.name !== "ConditionalCheckFailedException") throw error;
    });
}

export async function appendStudyExchange(
  ownerId: string,
  id: string,
  userTurn: StudyTurn,
  agentTurn: StudyTurn,
  event?: H3Event,
) {
  await getStudyConversation(ownerId, id, event);
  const { mock, table, db } = resources(event);
  if (mock) {
    const turns = mockTurns.get(id) || [];
    if (!turns.some((item) => item.id === userTurn.id))
      turns.push(userTurn, agentTurn);
    mockTurns.set(id, turns);
    return;
  }
  const item = (turn: StudyTurn) => ({
    pk: `STUDY#${id}`,
    sk: `TURN#${turn.createdAt}#${turn.id}`,
    turn,
  });
  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: table,
            Item: item(userTurn),
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
        {
          Put: {
            TableName: table,
            Item: item(agentTurn),
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
      ],
    }),
  );
}

export async function appendStudyTrace(
  ownerId: string,
  id: string,
  trace: StudyExecutionTrace,
  event?: H3Event,
) {
  await getStudyConversation(ownerId, id, event);
  if (trace.conversationId !== id)
    throw createError({
      statusCode: 400,
      statusMessage: "Trace conversation mismatch.",
    });
  const { mock, table, db } = resources(event);
  if (mock) {
    const traces = mockTraces.get(id) || [];
    if (
      !traces.some(
        (item) => item.id === trace.id && item.status === trace.status,
      )
    )
      traces.push(trace);
    mockTraces.set(id, traces);
  } else {
    await db
      .send(
        new PutCommand({
          TableName: table,
          Item: {
            pk: `STUDY#${id}`,
            sk: `TRACE#${trace.id}#${trace.status}`,
            trace,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      )
      .catch((error) => {
        if (error?.name !== "ConditionalCheckFailedException") throw error;
      });
  }
}

export async function getStudyPedagogyHistory(
  ownerId: string,
  id: string,
  event?: H3Event,
) {
  await getStudyConversation(ownerId, id, event);
  const { mock, table, db } = resources(event);
  if (mock)
    return {
      traces: [...(mockTraces.get(id) || [])],
      evidence: [...(mockEvidence.get(id) || [])],
    };
  async function collect(prefix: string) {
    const items: Record<string, any>[] = [];
    let cursor: Record<string, unknown> | undefined;
    do {
      const result = await db.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: {
            ":pk": `STUDY#${id}`,
            ":prefix": prefix,
          },
          ExclusiveStartKey: cursor,
        }),
      );
      items.push(...(result.Items || []));
      cursor = result.LastEvaluatedKey;
    } while (cursor);
    return items;
  }
  return {
    traces: (await collect("TRACE#")).map(
      (item) => item.trace as StudyExecutionTrace,
    ),
    evidence: (await collect("EVIDENCE#")).map(
      (item) => item.evidence as StudyLearningEvidence,
    ),
  };
}

export async function getStudyObjectiveOperation(ownerId: string, id: string, operationId: string, event?: H3Event) {
  await getStudyConversation(ownerId, id, event);
  const storage = resources(event);
  if (storage.mock) return structuredClone(mockObjectiveOperations.get(id + '#' + operationId));
  return (await storage.db.send(new GetCommand({TableName: storage.table, Key: {pk: 'STUDY#' + id, sk: 'FLOW#' + operationId}, ConsistentRead: true}))).Item?.operation as StudyObjectiveOperation | undefined;
}

/** Input, review and output each commit with the conversation revision; output also commits the pointer, evidence and clock. */
export async function saveStudyObjectiveState(ownerId: string, id: string, expectedRevision: number, change: {
  flow: ObjectiveFlowState; plan?: StudyPlan; practice?: StudyConversation['practice']; userTurn?: StudyTurn; agentTurn?: StudyTurn;
  operation?: StudyObjectiveOperation; expectedOperationStatus?: StudyObjectiveOperation['status']; trace?: StudyExecutionTrace; evidence?: StudyLearningEvidence;
  recordedClaim?: StudyRecordedTurnClaim; pacing?: {state: StudyPacingState; expectedRevision: string};
}, event?: H3Event) {
  const current = await getStudyConversation(ownerId, id, event);
  assertStudyConversationActive(current);
  if (current.revision !== expectedRevision || current.plan.status !== 'APPROVED' || current.plan.approvedBy !== ownerId || change.flow.planVersion !== current.plan.version || change.plan && change.plan.version !== current.plan.version)
    throw createError({statusCode:409,statusMessage:'Your study changed. Reload before continuing.'});
  const {mock, db, table} = resources(event), pk = 'STUDY#' + id, now = new Date().toISOString();
  const plan = change.plan || current.plan, practice = change.practice || current.practice;
  const closed = objectiveSessionClosed(change.flow);
  const gate = closed && standalonePilot(event) ? await studyUploadGate(ownerId, event) : undefined;
  const operationKey = id + '#' + change.operation?.id;
  if (mock) {
    const record = mockRecords.get(id)!;
    if (record.revision !== expectedRevision || (change.operation && mockObjectiveOperations.get(operationKey)?.status !== change.expectedOperationStatus))
      throw createError({statusCode:409,statusMessage:'This turn changed. Reload before continuing.'});
    const recorded = change.recordedClaim && mockRecordedRequests.get(id + '#' + change.recordedClaim.recordingId);
    if (change.recordedClaim && (!recorded || recorded.claimId !== change.recordedClaim.claimId || recorded.audioHash !== change.recordedClaim.audioHash || !['PROCESSING','FAILED'].includes(recorded.status))) throw recordedTurnConflict();
    if (change.pacing) commitMockAirsArtifact(ownerId, 'PACING#' + id, change.pacing.state, change.pacing.expectedRevision);
    mockRecords.set(id, {...record, plan, practice, objectiveFlow: structuredClone(change.flow), revision: expectedRevision + 1, updatedAt: now});
    const turns = mockTurns.get(id) || [];
    mockTurns.set(id, [...turns, ...[change.userTurn, change.agentTurn].filter((turn): turn is StudyTurn => Boolean(turn))]);
    if (change.operation) mockObjectiveOperations.set(operationKey, structuredClone(change.operation));
    if (change.trace) mockTraces.set(id, [...(mockTraces.get(id) || []), change.trace]);
    if (change.evidence) mockEvidence.set(id, [...(mockEvidence.get(id) || []), change.evidence]);
    if (recorded && change.agentTurn && change.operation) {
      recorded.status = 'COMPLETE'; recorded.userTurnSk = `TURN#${change.operation.userTurn.createdAt}#${change.operation.userTurn.id}`;
      recorded.agentTurnSk = `TURN#${change.agentTurn.createdAt}#${change.agentTurn.id}`; recorded.transcript = undefined;
    }
    if (gate?.conversationId === id) mockPilotUploads.set(ownerId, {...gate, completed: true});
  } else {
    const put = (sk: string, value: Record<string, unknown>) => ({Put: {TableName: table, Item: {pk, sk, ...value}, ConditionExpression: 'attribute_not_exists(pk)'}});
    const items: NonNullable<TransactWriteCommandInput['TransactItems']> = [{Update: {
      TableName: table, Key: {pk, sk: 'META'},
      UpdateExpression: 'SET #flow = :flow, #plan = :plan, #practice = :practice, #revision = :next, updatedAt = :now',
      ConditionExpression: 'ownerId = :owner AND #revision = :expected AND #plan.#version = :version AND attribute_not_exists(abandonedAt)',
      ExpressionAttributeNames: {'#flow':'objectiveFlow','#plan':'plan','#practice':'practice','#revision':'revision','#version':'version'},
      ExpressionAttributeValues: {':flow':change.flow,':plan':plan,':practice':practice,':next':expectedRevision + 1,':now':now,':owner':ownerId,':expected':expectedRevision,':version':current.plan.version},
    }}];
    if (change.userTurn) items.push(put(`TURN#${change.userTurn.createdAt}#${change.userTurn.id}`, {turn: change.userTurn}));
    if (change.agentTurn) items.push(put(`TURN#${change.agentTurn.createdAt}#${change.agentTurn.id}`, {turn: change.agentTurn}));
    if (change.trace) items.push(put(`TRACE#${change.trace.id}#EXECUTED`, {trace: change.trace}));
    if (change.evidence) items.push(put('EVIDENCE#' + change.evidence.id, {evidence: change.evidence}));
    if (change.operation) items.push({Put: {
      TableName: table, Item: {pk, sk: 'FLOW#' + change.operation.id, operation: change.operation},
      ConditionExpression: change.expectedOperationStatus ? '#operation.#status = :status AND #operation.inputHash = :hash' : 'attribute_not_exists(pk)',
      ...(change.expectedOperationStatus ? {ExpressionAttributeNames:{'#operation':'operation','#status':'status'},ExpressionAttributeValues:{':status':change.expectedOperationStatus,':hash':change.operation.inputHash}} : {}),
    }});
    if (change.recordedClaim && change.agentTurn && change.operation) items.push({Update: {
      TableName: table, Key: recordedTurnKey(id, change.recordedClaim.recordingId),
      UpdateExpression: 'SET #status = :complete, userTurnSk = :userSk, agentTurnSk = :agentSk REMOVE transcript, leaseUntil',
      ConditionExpression: 'ownerId = :owner AND claimId = :claim AND audioHash = :hash AND (#status = :processing OR #status = :failed)',
      ExpressionAttributeNames: {'#status':'status'}, ExpressionAttributeValues: {':complete':'COMPLETE',':userSk':`TURN#${change.operation.userTurn.createdAt}#${change.operation.userTurn.id}`,':agentSk':`TURN#${change.agentTurn.createdAt}#${change.agentTurn.id}`,':owner':ownerId,':claim':change.recordedClaim.claimId,':hash':change.recordedClaim.audioHash,':processing':'PROCESSING',':failed':'FAILED'},
    }});
    if (change.pacing) items.push({Put: {
      TableName: table, Item: {pk: 'AIRS_CONTEXT#' + ownerId, sk: 'PACING#' + id, value: change.pacing.state, entityType:'AirsContext'},
      ConditionExpression: change.pacing.expectedRevision ? '#v.#r = :r' : 'attribute_not_exists(#v.#r)',
      ExpressionAttributeNames:{'#v':'value','#r':'revision'}, ...(change.pacing.expectedRevision ? {ExpressionAttributeValues:{':r':change.pacing.expectedRevision}} : {}),
    }});
    if (gate?.conversationId === id) items.push({Update: {TableName: table, Key: pilotMarker(ownerId), UpdateExpression:'SET completed = :yes',ConditionExpression:'ownerId = :owner AND conversationId = :id',ExpressionAttributeValues:{':yes':true,':owner':ownerId,':id':id}}});
    try { await db.send(new TransactWriteCommand({TransactItems:items})); }
    catch (error) { if ((error as Error).name === 'TransactionCanceledException') throw createError({statusCode:409,statusMessage:'Your study or timer changed. Reload before continuing.'}); throw error; }
  }
  return getStudyConversation(ownerId, id, event);
}

export async function appendStudyExecution(
  ownerId: string,
  id: string,
  expectedRevision: number,
  userTurn: StudyTurn,
  agentTurn: StudyTurn,
  practice: StudyConversation["practice"],
  trace: StudyExecutionTrace,
  evidence?: StudyLearningEvidence,
  event?: H3Event,
  recordedClaim?: StudyRecordedTurnClaim,
) {
  const current = await getStudyConversation(ownerId, id, event);
  assertStudyConversationActive(current);
  if (
    current.revision !== expectedRevision ||
    current.plan.status !== "APPROVED" ||
    current.plan.version !== trace.planVersion
  )
    throw createError({
      statusCode: 409,
      statusMessage:
        "This study plan or conversation changed. Reload and try again.",
    });
  if (
    trace.conversationId !== id ||
    trace.status !== "EXECUTED" ||
    (evidence &&
      (evidence.traceId !== trace.id || evidence.conversationId !== id))
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Study execution references do not match.",
    });
  const { mock, table, db } = resources(event);
  const updatedAt = new Date().toISOString();
  const userTurnSk = `TURN#${userTurn.createdAt}#${userTurn.id}`;
  const agentTurnSk = `TURN#${agentTurn.createdAt}#${agentTurn.id}`;
  if (mock) {
    const record = mockRecords.get(id)!;
    if (record.revision !== expectedRevision)
      throw createError({
        statusCode: 409,
        statusMessage: "This study chat changed. Reload and try again.",
      });
    if (
      (mockTraces.get(id) || []).some(
        (item) => item.id === trace.id && item.status === "EXECUTED",
      )
    )
      throw createError({
        statusCode: 409,
        statusMessage: "This study turn was already saved.",
      });
    const recorded =
      recordedClaim &&
      mockRecordedRequests.get(`${id}#${recordedClaim.recordingId}`);
    if (
      recordedClaim &&
      (!recorded ||
        recorded.ownerId !== ownerId ||
        recorded.claimId !== recordedClaim.claimId ||
        recorded.audioHash !== recordedClaim.audioHash ||
        recorded.status !== "PROCESSING")
    )
      throw recordedTurnConflict();
    mockTurns.set(id, [...(mockTurns.get(id) || []), userTurn, agentTurn]);
    mockTraces.set(id, [...(mockTraces.get(id) || []), trace]);
    if (evidence)
      mockEvidence.set(id, [...(mockEvidence.get(id) || []), evidence]);
    mockRecords.set(id, {
      ...record,
      practice,
      revision: expectedRevision + 1,
      updatedAt,
    });
    if (recorded) {
      recorded.status = "COMPLETE";
      recorded.userTurnSk = userTurnSk;
      recorded.agentTurnSk = agentTurnSk;
      recorded.transcript = undefined;
    }
  } else {
    const pk = `STUDY#${id}`;
    const put = (sk: string, value: Record<string, unknown>) => ({
      Put: {
        TableName: table,
        Item: { pk, sk, ...value },
        ConditionExpression: "attribute_not_exists(pk)",
      },
    });
    try {
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: table,
                Key: { pk, sk: "META" },
                UpdateExpression:
                  "SET #practice = :practice, #revision = :next, #updatedAt = :updatedAt",
                ConditionExpression:
                  "#ownerId = :owner AND #revision = :expected AND #plan.#status = :approved AND #plan.#version = :planVersion AND attribute_not_exists(abandonedAt)",
                ExpressionAttributeNames: {
                  "#practice": "practice",
                  "#revision": "revision",
                  "#updatedAt": "updatedAt",
                  "#ownerId": "ownerId",
                  "#plan": "plan",
                  "#status": "status",
                  "#version": "version",
                },
                ExpressionAttributeValues: {
                  ":practice": practice,
                  ":next": expectedRevision + 1,
                  ":updatedAt": updatedAt,
                  ":owner": ownerId,
                  ":expected": expectedRevision,
                  ":approved": "APPROVED",
                  ":planVersion": trace.planVersion,
                },
              },
            },
            put(userTurnSk, { turn: userTurn }),
            put(agentTurnSk, { turn: agentTurn }),
            put(`TRACE#${trace.id}#EXECUTED`, { trace }),
            ...(evidence ? [put(`EVIDENCE#${evidence.id}`, { evidence })] : []),
            ...(recordedClaim
              ? [
                  {
                    Update: {
                      TableName: table,
                      Key: recordedTurnKey(id, recordedClaim.recordingId),
                      UpdateExpression:
                        "SET #status = :complete, userTurnSk = :userSk, agentTurnSk = :agentSk REMOVE transcript, leaseUntil",
                      ConditionExpression:
                        "ownerId = :owner AND claimId = :claim AND audioHash = :hash AND #status = :processing",
                      ExpressionAttributeNames: { "#status": "status" },
                      ExpressionAttributeValues: {
                        ":complete": "COMPLETE",
                        ":userSk": userTurnSk,
                        ":agentSk": agentTurnSk,
                        ":owner": ownerId,
                        ":claim": recordedClaim.claimId,
                        ":hash": recordedClaim.audioHash,
                        ":processing": "PROCESSING",
                      },
                    },
                  },
                ]
              : []),
          ],
        }),
      );
    } catch (error: any) {
      if (error?.name === "TransactionCanceledException")
        throw createError({
          statusCode: 409,
          statusMessage: "This study chat changed. Reload and try again.",
        });
      throw error;
    }
  }
}

export async function updateStudyMode(
  ownerId: string,
  id: string,
  mode: StudyMode,
  practice: StudyConversation["practice"],
  event?: H3Event,
) {
  const current = await getStudyConversation(ownerId, id, event);
  assertStudyConversationActive(current);
  const { mock, table, db } = resources(event);
  const updatedAt = new Date().toISOString();
  if (mock) {
    const record = mockRecords.get(id)!;
    mockRecords.set(id, {
      ...record,
      mode,
      practice,
      revision: record.revision + 1,
      updatedAt,
    });
  } else {
    const record = (
      await db.send(
        new GetCommand({
          TableName: table,
          Key: { pk: `STUDY#${id}`, sk: "META" },
          ConsistentRead: true,
        }),
      )
    ).Item as StudyRecord;
    await db.send(
      new PutCommand({
        TableName: table,
        Item: {
          ...record,
          mode,
          practice,
          revision: current.revision + 1,
          updatedAt,
        },
        ConditionExpression:
          "ownerId = :owner AND revision = :revision AND attribute_not_exists(abandonedAt)",
        ExpressionAttributeValues: {
          ":owner": ownerId,
          ":revision": current.revision,
        },
      }),
    );
  }
}

export async function deleteStudyConversation(
  ownerId: string,
  id: string,
  event?: H3Event,
) {
  const { mock, table, bucket, db, s3 } = resources(event);
  const record = mock
    ? mockRecords.get(id)
    : ((
        await db.send(
          new GetCommand({
            TableName: table,
            Key: { pk: `STUDY#${id}`, sk: "META" },
          }),
        )
      ).Item as StudyRecord | undefined);
  if (!record || record.ownerId !== ownerId)
    throw createError({
      statusCode: 404,
      statusMessage: "Study chat not found.",
    });
  await (
    await import("./studySpeechCache")
  ).deleteStudySpeech(ownerId, id, event);
  // Keep ownership metadata available until every cleanup stage succeeds, so a
  // failed deletion can be retried without orphaning the remaining records.
  await (await import("./airsContext")).deleteAirsConversationMemory(ownerId, id, event);
  if (mock) {
    mockRecords.delete(id);
    mockChunks.delete(id);
    mockTurns.delete(id);
    mockVoiceUsage.delete(id);
    mockTraces.delete(id);
    mockEvidence.delete(id);
    for (const key of mockRecordedRequests.keys())
      if (key.startsWith(`${id}#`)) mockRecordedRequests.delete(key);
    for (const key of mockObjectiveOperations.keys()) if (key.startsWith(`${id}#`)) mockObjectiveOperations.delete(key);
  } else {
    let cursor: Record<string, unknown> | undefined;
    do {
      const result = await db.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": record.pk },
          ExclusiveStartKey: cursor,
        }),
      );
      for (const item of result.Items || []) {
        if (item.sk === "META") continue;
        await db.send(
          new DeleteCommand({
            TableName: table,
            Key: { pk: item.pk, sk: item.sk },
          }),
        );
      }
      cursor = result.LastEvaluatedKey;
    } while (cursor);
    await s3.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: record.objectKey }),
    );
    await db.send(new DeleteCommand({
      TableName: table,
      Key: { pk: record.pk, sk: "META" },
      ConditionExpression: "ownerId = :owner",
      ExpressionAttributeValues: { ":owner": ownerId },
    }));
  }
}

interface LiveLease {
  ownerId: string;
  leaseId: string;
  expiresAt: number;
  outputBudget?: number;
  outputUsed?: number;
}
const mockLiveLeases = new Map<string, LiveLease>();
export async function studyLiveLease(
  id: string,
  event?: H3Event,
): Promise<LiveLease | undefined> {
  const { mock, table, db } = resources(event);
  const lease = mock
    ? mockLiveLeases.get(id)
    : ((
        await db.send(
          new GetCommand({
            TableName: table,
            Key: { pk: "STUDY#" + id, sk: "LIVE#VOICE" },
            ConsistentRead: true,
          }),
        )
      ).Item as LiveLease | undefined);
  return lease && lease.expiresAt > Date.now() ? lease : undefined;
}
export async function acquireStudyLiveLease(
  ownerId: string,
  id: string,
  durationMs = 330_000,
  outputBudget = 6000,
) {
  assertStudyConversationActive(await getStudyConversation(ownerId, id));
  const { mock, table, db } = resources();
  const lease: LiveLease = {
    ownerId,
    leaseId: randomUUID(),
    expiresAt: Date.now() + durationMs,
    outputBudget,
    outputUsed: 0,
  };
  if (mock) {
    const record = mockRecords.get(id);
    if (!record || record.ownerId !== ownerId)
      throw createError({
        statusCode: 404,
        statusMessage: "Study chat not found.",
      });
    assertStudyConversationActive(publicRecord(record, []));
    if ((mockLiveLeases.get(id)?.expiresAt || 0) > Date.now())
      throw createError({
        statusCode: 409,
        statusMessage: "This document already has an active call.",
      });
    mockLiveLeases.set(id, lease);
  } else
    try {
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              ConditionCheck: {
                TableName: table,
                Key: { pk: "STUDY#" + id, sk: "META" },
                ConditionExpression:
                  "ownerId = :owner AND attribute_not_exists(abandonedAt)",
                ExpressionAttributeValues: { ":owner": ownerId },
              },
            },
            {
              Put: {
                TableName: table,
                Item: { pk: "STUDY#" + id, sk: "LIVE#VOICE", ...lease },
                ConditionExpression:
                  "attribute_not_exists(pk) OR expiresAt <= :now",
                ExpressionAttributeValues: { ":now": Date.now() },
              },
            },
          ],
        }),
      );
    } catch (cause) {
      if ((cause as Error).name === "TransactionCanceledException") {
        assertStudyConversationActive(await getStudyConversation(ownerId, id));
        throw createError({
          statusCode: 409,
          statusMessage: "This document already has an active call.",
        });
      }
      throw cause;
    }
  return lease;
}
export async function releaseStudyLiveLease(id: string, leaseId: string) {
  const { mock, table, db } = resources();
  if (mock) {
    if (mockLiveLeases.get(id)?.leaseId === leaseId) mockLiveLeases.delete(id);
  } else
    await db
      .send(
        new DeleteCommand({
          TableName: table,
          Key: { pk: "STUDY#" + id, sk: "LIVE#VOICE" },
          ConditionExpression: "leaseId = :lease",
          ExpressionAttributeValues: { ":lease": leaseId },
        }),
      )
      .catch((cause) => {
        if ((cause as Error).name !== "ConditionalCheckFailedException")
          throw cause;
      });
}

/** Atomically bound live generated speech, including concurrent model requests. */
export async function reserveStudyLiveOutput(
  ownerId: string,
  id: string,
  leaseId: string,
  units: number,
  event?: H3Event,
) {
  const lease = await studyLiveLease(id, event);
  if (
    !Number.isInteger(units) ||
    units <= 0 ||
    lease?.ownerId !== ownerId ||
    lease.leaseId !== leaseId ||
    (lease.outputUsed || 0) + units > (lease.outputBudget || 0)
  )
    throw createError({
      statusCode: 429,
      statusMessage:
        "This call has reached its reply allowance. Your saved turns remain available.",
    });
  await commitStudyVoiceUsage(
    ownerId,
    id,
    { kind: "ELEVEN_LIVE_OUTPUT", units },
    event,
    { leaseId, outputBudget: lease.outputBudget || 0 },
  );
}
