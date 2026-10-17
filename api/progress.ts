import {
  progressRequestSchema,
  parseSavedStudyData,
} from "../shared/contracts.js";
import { requireStudyAccess } from "../server/access.js";
import { databaseRequest } from "../server/supabase.js";
import { send, type ApiRequest, type ApiResponse } from "../server/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!["GET", "PUT"].includes(req.method || ""))
    return send(res, 405, { error: "Method not allowed." });
  const user = await requireStudyAccess(req, res);
  if (!user) return;
  if (user.id === "local") return send(res, 200, { localOnly: true });
  try {
    if (req.method === "GET") {
      const response = await databaseRequest(
        `study_progress?select=data&user_id=eq.${encodeURIComponent(user.id)}`,
        user.token,
      );
      if (!response.ok)
        return send(res, 502, {
          error: "Saved study progress could not be loaded.",
        });
      const rows = await response.json();
      const value = rows[0]?.data;
      return send(res, 200, {
        data: value ? parseSavedStudyData(value) : null,
      });
    }
    const parsed = progressRequestSchema.safeParse(req.body);
    if (!parsed.success || JSON.stringify(parsed.data).length > 200_000)
      return send(res, 400, {
        error: "The study record is invalid or too large.",
      });
    const response = await databaseRequest(
      "study_progress?on_conflict=user_id",
      user.token,
      {
        method: "POST",
        headers: { prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          user_id: user.id,
          data: parsed.data.data,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    send(
      res,
      response.ok ? 200 : 502,
      response.ok ? { saved: true } : { error: "Progress could not be saved." },
    );
  } catch {
    send(res, 502, {
      error: "Study sync is unavailable. Your browser copy is still saved.",
    });
  }
}
