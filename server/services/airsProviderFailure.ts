export type AirsProviderFailureCode =
  | "AGENT_PROVIDER_RATE_LIMITED"
  | "AGENT_PROVIDER_CONFIGURATION"
  | "AGENT_PROVIDER_REQUEST_INVALID"
  | "AGENT_PROVIDER_RESULT_INVALID"
  | "AGENT_PROVIDER_UNAVAILABLE";

export interface AirsProviderFailure {
  statusCode: number;
  statusMessage: string;
  data: {
    code: AirsProviderFailureCode;
    providerStatus: number;
    retryable: boolean;
    retryAfterSeconds?: number;
  };
}

/** Return only a bounded delay, never the provider's raw header. */
export function airsRetryAfterSeconds(
  value: string | null | undefined,
  nowMs = Date.now(),
): number | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  const seconds = /^\d+(?:\.\d+)?$/.test(trimmed)
    ? Number(trimmed)
    : (Date.parse(trimmed) - nowMs) / 1000;
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86_400)
    return undefined;
  return Math.ceil(seconds);
}

/** Classify only HTTP status and an allowlisted reason; provider prose stays private. */
export function classifyAirsProviderFailure(input: {
  providerStatus: number;
  providerReason?: "tool_use_failed";
  retryAfter?: string | null;
  nowMs?: number;
}): AirsProviderFailure {
  const { providerStatus } = input;
  const retained = "Your source is still available.";
  let code: AirsProviderFailureCode = "AGENT_PROVIDER_UNAVAILABLE";
  let statusCode = 503;
  let retryable = true;
  let statusMessage = `The learning service is temporarily unavailable. ${retained} Try again shortly.`;
  if (providerStatus === 429) {
    code = "AGENT_PROVIDER_RATE_LIMITED";
    statusCode = 429;
    statusMessage = `The learning service has reached a request or token limit. ${retained} Wait before retrying this step.`;
  } else if ([401, 403].includes(providerStatus)) {
    code = "AGENT_PROVIDER_CONFIGURATION";
    retryable = false;
    statusMessage = `The learning service needs an account or access configuration repair. ${retained} Contact the app owner.`;
  } else if (
    providerStatus === 400 &&
    input.providerReason === "tool_use_failed"
  ) {
    code = "AGENT_PROVIDER_RESULT_INVALID";
    statusCode = 502;
    statusMessage = `The learning service could not prepare a valid plan or review. ${retained} Retry this step.`;
  } else if ([400, 404, 413, 422].includes(providerStatus)) {
    code = "AGENT_PROVIDER_REQUEST_INVALID";
    statusCode = 502;
    retryable = false;
    statusMessage = `The learning service could not accept this request. ${retained} The app owner needs to check the request configuration.`;
  }
  const retryAfterSeconds =
    providerStatus === 429
      ? airsRetryAfterSeconds(input.retryAfter, input.nowMs)
      : undefined;
  return {
    statusCode,
    statusMessage,
    data: {
      code,
      providerStatus,
      retryable,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    },
  };
}

/** Inspect bounded error data solely to distinguish a failed tool result from a bad request. */
export async function airsProviderFailureReason(
  response: Response,
): Promise<"tool_use_failed" | undefined> {
  if (response.status !== 400) return undefined;
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(part.value);
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (typeof body !== "object" || body === null || !("error" in body))
      return undefined;
    const error = body.error;
    return typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "tool_use_failed"
      ? "tool_use_failed"
      : undefined;
  } catch {
    return undefined;
  } finally {
    reader.releaseLock();
  }
}
