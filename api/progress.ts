import { progressRequestSchema, parseSavedStudyData } from "../shared/contracts.js";
import { requireStudyAccess } from "../server/access.js";
import { database } from "../server/database.js";
import { send, type ApiRequest, type ApiResponse } from "../server/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!["GET", "PUT"].includes(req.method || "")) return send(res, 405, { error: "Method not allowed." });
  const user = await requireStudyAccess(req, res);
  if (!user) return;
  if (user.id === "local") return send(res, 200, { localOnly: true });
  if (req.headers["x-citoyen-user"] !== user.id) return send(res, 409, { error: "Your account changed. Please reload the page." });
  try {
    if (req.method === "GET") {
      const result = await database().query("SELECT data FROM study_progress WHERE user_id = $1", [user.id]);
      return send(res, 200, { data: result.rows[0] ? parseSavedStudyData(result.rows[0].data) : null });
    }
    const parsed = progressRequestSchema.safeParse(req.body);
    if (!parsed.success) return send(res, 400, { error: "The study record is invalid." });
    await database().query(
      "INSERT INTO study_progress (user_id, data, updated_at) VALUES ($1, $2, now()) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at",
      [user.id, JSON.stringify(parsed.data.data)],
    );
    send(res, 200, { saved: true });
  } catch {
    send(res, 502, { error: "Study sync is unavailable. Your browser copy is still saved." });
  }
}
