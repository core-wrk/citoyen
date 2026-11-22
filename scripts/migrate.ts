import { readdir, readFile } from "node:fs/promises";
import { loadEnv } from "vite";
import { database } from "../server/database.js";

Object.assign(process.env, { ...loadEnv(process.env.NODE_ENV || "development", process.cwd(), ""), ...process.env });
const pool = database();
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(hashtext('citoyen_migrations'))");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const file of (await readdir("migrations")).filter((name) => name.endsWith(".sql")).sort()) {
    const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (applied.rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(`migrations/${file}`, "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(hashtext('citoyen_migrations'))");
  client.release();
  await pool.end();
}
