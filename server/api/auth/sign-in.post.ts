import { z } from "zod";
import { signInWithCognito } from "../../services/cognito";
import { authFailure, setRefreshCookie } from "../../utils/authSession";

const schema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

const mockScenario = (email: string) => {
  const requested = email.split("@")[0]?.toLowerCase() || "member";
  return [
    "admin",
    "educator",
    "member",
    "pending",
    "wrong-school",
    "revoked",
    "profile-incomplete",
  ].includes(requested)
    ? requested
    : "member";
};

export default defineEventHandler(async (event) => {
  const input = schema.parse(await readBody(event));
  const config = useRuntimeConfig(event);
  if (
    config.flowstAuthMode === "mock" &&
    process.env.NODE_ENV !== "production"
  ) {
    const scenario = mockScenario(input.email);
    const token = `mock:${scenario}`;
    setRefreshCookie(event, token);
    return { authenticated: true, accessToken: token, expiresIn: 3600 };
  }
  try {
    const session = await signInWithCognito(input.email, input.password, event);
    setRefreshCookie(event, session.RefreshToken!);
    return {
      authenticated: true,
      accessToken: session.AccessToken,
      expiresIn: session.ExpiresIn || 3600,
    };
  } catch (cause) {
    throw authFailure(cause, "Flowst could not sign you in. Please try again.");
  }
});
