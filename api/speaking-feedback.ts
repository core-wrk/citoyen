import { feedbackRequestSchema } from "../shared/contracts.js";
import { requireStudyAccess } from "../server/access.js";
import { reserveMonthlyRequest } from "../server/usage.js";
import { languageFeedback } from "../server/language.js";
import { send, type ApiRequest, type ApiResponse } from "../server/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST")
    return send(res, 405, { error: "Method not allowed." });
  const user = await requireStudyAccess(req, res);
  if (!user) return;
  const parsed = feedbackRequestSchema.safeParse(req.body);
  if (!parsed.success)
    return send(res, 400, {
      error:
        "Use a response of 1–5,000 characters and a prompt under 1,200 characters.",
    });
  if (!process.env.OPENAI_API_KEY)
    return send(res, 503, {
      error: "Automatic language feedback is not configured.",
    });
  if (!(await reserveMonthlyRequest(user, res))) return;
  try {
    send(res, 200, { feedback: await languageFeedback(parsed.data) });
  } catch {
    send(res, 502, {
      error:
        "Language feedback is temporarily unavailable. Your response is still saved.",
    });
  }
}
