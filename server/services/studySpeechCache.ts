import { createHash, randomUUID } from "node:crypto";
import { createError, type H3Event } from "h3";
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { TimedStudySpeech } from "../../shared/studySpeech";
import { getStudyConversation, studyStorageResources } from "./studyRepository";
import { synthesizeStudySpeech } from "./studyAwsSpeech";
import { elevenSynthesizeTimedStudySpeech } from "./studyElevenSpeech";

interface CachedSpeech {
  ownerId: string;
  revision: string;
  status: "PENDING" | "READY" | "FAILED";
  objectKey: string;
  textHash: string;
  failure?: string;
  failureCode?: string;
  failureStatus?: number;
  failureRetryable?: boolean;
  expiresAt?: number;
}
const records = new Map<string, CachedSpeech>(),
  packets = new Map<string, TimedStudySpeech>();
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const storageKey = (owner: string, id: string, turnId: string) =>
  `study-speech/${hash(owner)}/${id}/${turnId}.json`;

async function readRecord(id: string, turnId: string, event?: H3Event) {
  const storage = studyStorageResources(event);
  return storage.mock
    ? records.get(`${id}#${turnId}`)
    : ((
        await storage.db.send(
          new GetCommand({
            TableName: storage.table,
            Key: { pk: `STUDY#${id}`, sk: `SPEECH#${turnId}` },
            ConsistentRead: true,
          }),
        )
      ).Item as CachedSpeech | undefined);
}
async function saveRecord(
  id: string,
  turnId: string,
  next: CachedSpeech,
  previous: string,
  event?: H3Event,
) {
  const storage = studyStorageResources(event);
  if (storage.mock) {
    await getStudyConversation(next.ownerId, id, event);
    if ((records.get(`${id}#${turnId}`)?.revision || "") !== previous)
      throw createError({
        statusCode: 409,
        statusMessage: "This spoken reply is already being prepared.",
      });
    records.set(`${id}#${turnId}`, next);
    return;
  }
  try {
    await storage.db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: storage.table,
              Key: { pk: `STUDY#${id}`, sk: "META" },
              ConditionExpression:
                "ownerId = :owner AND attribute_not_exists(abandonedAt)",
              ExpressionAttributeValues: { ":owner": next.ownerId },
            },
          },
          {
            Put: {
              TableName: storage.table,
              Item: { pk: `STUDY#${id}`, sk: `SPEECH#${turnId}`, ...next },
              ConditionExpression: previous
                ? "revision = :revision AND ownerId = :owner"
                : "attribute_not_exists(pk)",
              ...(previous
                ? {
                    ExpressionAttributeValues: {
                      ":revision": previous,
                      ":owner": next.ownerId,
                    },
                  }
                : {}),
            },
          },
        ],
      }),
    );
  } catch (cause) {
    if ((cause as Error).name !== "TransactionCanceledException") throw cause;
    await getStudyConversation(next.ownerId, id, event);
    throw createError({
      statusCode: 409,
      statusMessage: "This spoken reply is already being prepared.",
    });
  }
}
async function readPacket(
  record: CachedSpeech,
  event?: H3Event,
): Promise<TimedStudySpeech | null> {
  const storage = studyStorageResources(event);
  if (storage.mock) return packets.get(record.objectKey) || null;
  try {
    const result = await storage.s3.send(
      new GetObjectCommand({ Bucket: storage.bucket, Key: record.objectKey }),
    );
    if (!result.Body || (result.ContentLength || 0) > 8_000_000)
      throw new Error("Invalid saved speech size");
    const parts: Uint8Array[] = [];
    let bytes = 0;
    for await (const part of result.Body as AsyncIterable<Uint8Array>) {
      bytes += part.byteLength;
      if (bytes > 8_000_000) throw new Error("Invalid saved speech size");
      parts.push(part);
    }
    return JSON.parse(
      Buffer.concat(parts).toString("utf8"),
    ) as TimedStudySpeech;
  } catch (cause) {
    if (["NoSuchKey", "NotFound"].includes((cause as Error).name)) return null;
    if (["AccessDenied", "AccessDeniedException"].includes((cause as Error).name))
      throw createError({
        statusCode: 503,
        statusMessage: "Amina’s saved audio needs a server storage-permission update. Your saved reply is still readable.",
        data: { code: "SPEECH_CACHE_ACCESS", retryable: false },
      });
    if (["ExpiredToken", "ExpiredTokenException", "CredentialsProviderError", "InvalidIdentityToken"].includes((cause as Error).name))
      throw createError({
        statusCode: 503,
        statusMessage: "The app’s audio-storage connection is unavailable. Your saved reply is still readable.",
        data: { code: "SPEECH_CACHE_AUTH", retryable: false },
      });
    throw cause;
  }
}

/** A saved turn has one paid dispatch. Replays read private audio; only explicit retry can dispatch after a failure. */
export async function getOrPrepareStudySpeech(
  owner: string,
  id: string,
  turnId: string,
  retry = false,
  event?: H3Event,
): Promise<TimedStudySpeech> {
  const study = await getStudyConversation(owner, id, event);
  const turn = study.turns.find(
    (item) => item.id === turnId && item.role === "AMIRA",
  );
  if (!turn)
    throw createError({
      statusCode: 404,
      statusMessage: "Amina’s response was not found.",
      data: { code: 'SPEECH_RESPONSE_NOT_FOUND', retryable: false },
    });
  const previous = await readRecord(id, turnId, event),
    textHash = hash(turn.text);
  if (
    previous?.expiresAt &&
    previous.expiresAt <= Math.floor(Date.now() / 1000)
  )
    throw createError({
      statusCode: 410,
      statusMessage: "This guest audio has expired.",
      data: { code: 'SPEECH_EXPIRED', retryable: false },
    });
  if (
    previous &&
    (previous.ownerId !== owner || previous.textHash !== textHash)
  )
    throw createError({
      statusCode: 409,
      statusMessage: "The saved spoken reply no longer matches this response.",
    });
  if (previous) {
    // Recover audio saved before a process stopped, even if the READY marker was not saved.
    const packet = await readPacket(previous, event);
    if (packet) return packet;
    if (previous.status === "PENDING")
      throw createError({
        statusCode: 409,
        statusMessage:
          "This spoken reply is still being prepared. No second voice request was sent.",
        data: { code: "SPEECH_PENDING" },
      });
    if (!retry || previous.status === "READY")
      throw createError({
        statusCode: previous.failureStatus || 503,
        statusMessage:
          previous.failure ||
          "Saved audio is unavailable. The response is still readable.",
        data: {
          code: previous.failureCode || (previous.status === 'READY' ? 'SPEECH_CACHE_UNAVAILABLE' : "SPEECH_FAILED"),
          ...(previous.status === 'READY' ? { retryable: false } : typeof previous.failureRetryable === 'boolean' ? { retryable: previous.failureRetryable } : {}),
        },
      });
  }
  const next: CachedSpeech = {
    ownerId: owner,
    revision: randomUUID(),
    status: "PENDING",
    objectKey: storageKey(owner, id, turnId),
    textHash,
    ...(owner.startsWith("guest-")
      ? { expiresAt: Math.floor(Date.now() / 1000) + 86400 }
      : {}),
  };
  await saveRecord(id, turnId, next, previous?.revision || "", event);
  let audioSaved = false;
  try {
    const config = useRuntimeConfig(event);
    const packet =
      config.studyVoiceProvider === "aws"
        ? {
            audioBase64: (
              await synthesizeStudySpeech(owner, study, turn.text, event)
            ).toString("base64"),
            mimeType: "audio/mpeg" as const,
            spokenText: turn.text.slice(0, 3000),
            alignment: null,
          }
        : await elevenSynthesizeTimedStudySpeech(
            owner,
            study,
            turn.text,
            event,
          );
    const body = JSON.stringify(packet);
    if (Buffer.byteLength(body) > 8_000_000)
      throw createError({
        statusCode: 502,
        statusMessage: "The spoken reply was too large to save.",
      });
    // Check ownership again after provider work. Deleted/abandoned sessions cannot acquire new audio.
    const current = await getStudyConversation(owner, id, event);
    if (current.abandonedAt)
      throw createError({
        statusCode: 409,
        statusMessage: "This study has been abandoned.",
      });
    const storage = studyStorageResources(event);
    if (storage.mock) packets.set(next.objectKey, packet);
    else
      await storage.s3.send(
        new PutObjectCommand({
          Bucket: storage.bucket,
          Key: next.objectKey,
          Body: body,
          ContentType: "application/json",
          ServerSideEncryption: "AES256",
        }),
      );
    audioSaved = true;
    await saveRecord(
      id,
      turnId,
      { ...next, status: "READY", revision: randomUUID() },
      next.revision,
      event,
    );
    return packet;
  } catch (cause: any) {
    const message =
      cause?.statusMessage ||
      (["TimeoutError", "AbortError"].includes(cause?.name)
        ? "The voice request timed out. It may have been processed; no automatic retry was sent."
        : "The spoken reply could not be prepared. Your response is still readable.");
    await saveRecord(
      id,
      turnId,
      {
        ...next,
        status: "FAILED",
        revision: randomUUID(),
        failure: message,
        failureStatus: cause?.statusCode || 503,
        failureCode: cause?.data?.code,
        ...(typeof cause?.data?.retryable === 'boolean' ? { failureRetryable: cause.data.retryable } : {}),
      },
      next.revision,
      event,
    ).catch(() => undefined);
    if (audioSaved) {
      const alive = await getStudyConversation(owner, id, event).catch(
        () => null,
      );
      if (!alive || alive.abandonedAt) {
        const storage = studyStorageResources(event);
        if (storage.mock) packets.delete(next.objectKey);
        else
          await storage.s3
            .send(
              new DeleteObjectCommand({
                Bucket: storage.bucket,
                Key: next.objectKey,
              }),
            )
            .catch(() => undefined);
      }
    }
    throw cause?.statusCode
      ? cause
      : createError({ statusCode: 503, statusMessage: message });
  }
}

export async function deleteStudySpeech(
  owner: string,
  id: string,
  event?: H3Event,
) {
  const storage = studyStorageResources(event);
  if (storage.mock) {
    for (const [key, record] of records)
      if (key.startsWith(`${id}#`) && record.ownerId === owner) {
        packets.delete(record.objectKey);
        records.delete(key);
      }
    return;
  }
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await storage.db.send(
      new QueryCommand({
        TableName: storage.table,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :speech)",
        ExpressionAttributeValues: {
          ":pk": `STUDY#${id}`,
          ":speech": "SPEECH#",
        },
        ExclusiveStartKey: cursor,
        ConsistentRead: true,
      }),
    );
    for (const record of result.Items || [])
      if (
        record.ownerId === owner &&
        record.objectKey.startsWith(`study-speech/${hash(owner)}/${id}/`)
      )
        await storage.s3.send(
          new DeleteObjectCommand({
            Bucket: storage.bucket,
            Key: record.objectKey,
          }),
        );
    cursor = result.LastEvaluatedKey;
  } while (cursor);
}
