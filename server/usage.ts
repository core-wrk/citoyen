import { readFile, writeFile } from "node:fs/promises";
import { localMode } from "./access.js";
import { databaseRequest } from "./supabase.js";
import { send, type ApiResponse } from "./http.js";

const path = new URL("../.local-usage.json", import.meta.url);
let localQueue: Promise<unknown> = Promise.resolve();
export async function reserveMonthlyRequest(
  user: { id: string; token: string },
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
      const response = await databaseRequest(
        "rpc/reserve_ai_request",
        user.token,
        { method: "POST", body: "{}" },
      );
      if (!response.ok) {
        send(res, 503, { error: "Usage tracking is unavailable." });
        return false;
      }
      if ((await response.json()) === true) return true;
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
