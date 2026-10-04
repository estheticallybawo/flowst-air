import { learnerStudyError } from "../../shared/studyPresentation";

export class AirsLiveError extends Error {
  constructor(
    message: string,
    public code: string,
    public nextAction = "/airs",
  ) {
    super(message);
    this.name = "AirsLiveError";
  }
}

/** Only application-defined recovery messages cross the socket boundary. */
export function airsLiveFailure(cause: unknown, fallback: string) {
  const error = cause as {
    statusCode?: number;
    statusMessage?: string;
    data?: { code?: string; nextAction?: string };
  };
  if (cause instanceof AirsLiveError)
    return {
      type: "error",
      message: cause.message,
      code: cause.code,
      nextAction: cause.nextAction,
    };
  if (error?.statusCode && error.statusMessage)
    return {
      type: "error",
      message: learnerStudyError(
        {
          statusCode: error.statusCode,
          data: { statusMessage: error.statusMessage },
        },
        fallback,
      ),
      code: error.data?.code,
      nextAction: error.data?.nextAction,
    };
  return { type: "error", message: fallback };
}
