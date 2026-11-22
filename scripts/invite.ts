import { randomBytes } from "node:crypto";
import { loadEnv } from "vite";
import { z } from "zod";
import { allowedEmails, auth } from "../server/auth.js";
import { database } from "../server/database.js";

Object.assign(process.env, { ...loadEnv(process.env.NODE_ENV || "development", process.cwd(), ""), ...process.env });
const email = z.email().parse(process.argv[2]?.trim().toLowerCase());
if (!allowedEmails().includes(email)) throw new Error("Add this email to ALLOWED_EMAILS first.");
try {
  const existing = await database().query('SELECT id FROM "user" WHERE email = $1', [email]);
  if (!existing.rowCount) {
    await auth().api.createUser({ body: { email, name: email.split("@")[0], password: randomBytes(32).toString("hex") } });
  }
  await auth().api.requestPasswordReset({ body: { email, redirectTo: "/?reset-password=1" } });
  console.log(`Password setup requested for ${email}.`);
} finally {
  await database().end();
}
