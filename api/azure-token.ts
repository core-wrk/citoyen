import { requireStudyAccess } from "../server/access.js";
import { reserveMonthlyRequest } from "../server/usage.js";
import { send, type ApiRequest, type ApiResponse } from "../server/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST")
    return send(res, 405, { error: "Method not allowed." });
  const user = await requireStudyAccess(req, res);
  if (!user) return;
  const key = process.env.AZURE_SPEECH_KEY,
    region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region || !/^[a-z0-9-]+$/.test(region))
    return send(res, 503, {
      error: "Pronunciation assessment is not configured.",
    });
  if (!(await reserveMonthlyRequest(user, res))) return;
  try {
    const response = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "content-type": "application/x-www-form-urlencoded",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw new Error();
    send(res, 200, { token: await response.text(), region });
  } catch {
    send(res, 502, { error: "Speech assessment is temporarily unavailable." });
  }
}
