import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";
import { allowedEmails, auth, authReady } from "./auth.js";
import { send, type ApiRequest, type ApiResponse } from "./http.js";

export const localMode = () => process.env.NODE_ENV !== "production";

export async function requireStudyAccess(req: ApiRequest, res: ApiResponse) {
  if (authReady()) {
    try {
      const session = await auth().api.getSession({ headers: fromNodeHeaders(req.headers as IncomingHttpHeaders) });
      if (session && allowedEmails().includes(session.user.email.toLowerCase())) {
        const expected = req.headers["x-citoyen-user"];
        if (expected && expected !== session.user.id) {
          send(res, 409, { error: "Your account changed. Please reload the page." });
          return null;
        }
        return { id: session.user.id };
      }
    } catch {
      send(res, 503, { error: "Sign-in is temporarily unavailable." });
      return null;
    }
  }
  if (localMode() && !req.headers.cookie) return { id: "local" };
  send(res, 401, { error: "Sign in with an invited account to continue." });
  return null;
}
