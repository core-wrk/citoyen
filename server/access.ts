import type { ApiRequest, ApiResponse } from "./http.js";
import { send } from "./http.js";
import { getInvitedUser } from "./supabase.js";

export const localMode = () =>
  process.env.VERCEL !== "1" && process.env.NODE_ENV !== "production";
export async function requireStudyAccess(req: ApiRequest, res: ApiResponse) {
  const header = req.headers.authorization;
  const token =
    typeof header === "string" ? header.replace(/^Bearer\s+/i, "") : "";
  const user = token ? await getInvitedUser(token) : null;
  if (user) return { id: user.id, token };
  if (localMode() && !token) return { id: "local", token: "" };
  send(res, 401, { error: "Sign in with an invited account to continue." });
  return null;
}
