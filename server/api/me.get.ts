import { getMe } from "../services/authRepository";
import { requireIdentity } from "../utils/auth";

export default defineEventHandler(async (event) =>
  getMe(await requireIdentity(event), event),
);
