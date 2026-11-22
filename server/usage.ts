import { readFile, writeFile } from "node:fs/promises";
import { localMode } from "./access.js";
import { database } from "./database.js";
import { send, type ApiResponse } from "./http.js";

const path = new URL("../.local-usage.json", import.meta.url);
let localQueue: Promise<unknown> = Promise.resolve();
export async function reserveMonthlyRequest(
  user: { id: string },
  res: ApiResponse,
) {
  if (localMode() && user.id === "local") {
    const reservation = localQueue.then(async () => {
      const month = new Date().toISOString().slice(0, 7);
      let usage = { month, requests: 0 };
      try {
        usage = JSON.parse(await readFile(path, "utf8"));
      } catch {}
      if (usage.month !== month) usage = { month, requests: 0 };
      if (usage.requests >= 100) return false;
      await writeFile(
        path,
        JSON.stringify({ month, requests: usage.requests + 1 }),
        { mode: 0o600 },
      );
      return true;
    });
    localQueue = reservation.catch(() => {});
    if (await reservation) return true;
  } else {
    try {
      const result = await database().query(`
        INSERT INTO ai_monthly_usage (month_start, request_count)
        VALUES (date_trunc('month', now() AT TIME ZONE 'UTC')::date, 1)
        ON CONFLICT (month_start) DO UPDATE
          SET request_count = ai_monthly_usage.request_count + 1
          WHERE ai_monthly_usage.request_count < 100
        RETURNING request_count
      `);
      if (result.rowCount) return true;
    } catch {
      send(res, 503, { error: "Usage tracking is unavailable." });
      return false;
    }
  }
  send(res, 429, {
    error:
      "The shared monthly allowance of 100 feedback and pronunciation sessions has been reached.",
  });
  return false;
}
