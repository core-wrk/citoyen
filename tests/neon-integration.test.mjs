import test from "node:test";
import assert from "node:assert/strict";

const databaseUrl = process.env.CITOYEN_TEST_DATABASE_URL;
test("PostgreSQL accounts, recovery, progress isolation, and request allowance", { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || !/^\/citoyen_test_[0-9a-f]{8}$/.test(target.pathname)) {
    throw new Error("Integration tests require a fresh local database named citoyen_test_ followed by eight hexadecimal characters.");
  }
  Object.assign(process.env, {
    NODE_ENV: "production", DATABASE_URL: databaseUrl,
    BETTER_AUTH_URL: "https://citoyen.test", BETTER_AUTH_SECRET: "synthetic-secret-0123456789-0123456789",
    ALLOWED_EMAILS: "owner@example.com,brother@example.com", RESEND_API_KEY: "synthetic-key", RESEND_FROM_EMAIL: "citoyen@example.com",
  });
  const { auth } = await import("../server/auth.ts");
  const { database } = await import("../server/database.ts");
  const { default: progress } = await import("../api/progress.ts");
  const { reserveMonthlyRequest } = await import("../server/usage.ts");
  const db = database();
  const previousFetch = globalThis.fetch;
  let recoveryUrl;
  globalThis.fetch = async (input, options) => {
    if (String(input).startsWith("https://api.resend.com/")) {
      const payload = JSON.parse(options.body);
      recoveryUrl = payload.text.match(/https:\/\/\S+/)[0];
      return Response.json({ id: "synthetic-email" });
    }
    return previousFetch(input, options);
  };
  const response = () => ({ statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } });
  const call = (path, body, cookie = "") => auth().handler(new Request(`https://citoyen.test/api/auth/${path}`, { method: "POST", headers: { "content-type": "application/json", origin: "https://citoyen.test", cookie }, body: JSON.stringify(body) }));
  try {
    const existing = await db.query('SELECT (SELECT count(*) FROM "user") + (SELECT count(*) FROM "rateLimit") + (SELECT count(*) FROM verification) + (SELECT count(*) FROM ai_monthly_usage) AS count');
    if (Number(existing.rows[0].count) !== 0) throw new Error("Integration tests require an empty, freshly migrated database.");
    for (const name of ["owner", "brother", "stranger"]) await auth().api.createUser({ body: { email: `${name}@example.com`, name, password: "synthetic-password" } });
    const denied = await call("sign-in/email", { email: "stranger@example.com", password: "synthetic-password" });
    assert.equal(denied.status, 401);
    const signup = await call("sign-up/email", { email: "new@example.com", name: "new", password: "synthetic-password" });
    assert.notEqual(signup.status, 200);
    const recovery = await call("request-password-reset", { email: "owner@example.com", redirectTo: "/?reset-password=1" });
    assert.equal(recovery.status, 200);
    const redirect = await auth().handler(new Request(recoveryUrl));
    const token = new URL(redirect.headers.get("location")).searchParams.get("token");
    assert.ok(token);
    const reset = await call("reset-password", { token, newPassword: "new-synthetic-password" });
    assert.equal(reset.status, 200);
    const reused = await call("reset-password", { token, newPassword: "another-synthetic-password" });
    assert.notEqual(reused.status, 200);
    await call("request-password-reset", { email: "owner@example.com", redirectTo: "/?reset-password=1" });
    await db.query("UPDATE verification SET \"expiresAt\" = now() - interval '1 minute' WHERE identifier LIKE 'reset-password:%'");
    const expired = await auth().handler(new Request(recoveryUrl));
    assert.equal(new URL(expired.headers.get("location")).searchParams.get("error"), "INVALID_TOKEN");
    const sessions = [];
    for (const name of ["owner", "brother"]) {
      const login = await call("sign-in/email", { email: `${name}@example.com`, password: name === "owner" ? "new-synthetic-password" : "synthetic-password" });
      assert.equal(login.status, 200);
      const body = await login.json();
      const cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
      sessions.push({ id: body.user.id, cookie });
    }
    const owner = sessions[0], brother = sessions[1];
    const draft = "x".repeat(5000);
    const data = { attempts: Array.from({ length: 40 }, (_, i) => ({ id: String(i), skill: "writing", title: "Writing", correct: 0, total: 0, at: "2026-10-14T12:00:00.000Z", text: draft })), drafts: { W01: draft }, updatedAt: null };
    const saved = response();
    await progress({ method: "PUT", headers: { cookie: owner.cookie, "x-citoyen-user": owner.id }, body: { data } }, saved);
    assert.equal(saved.statusCode, 200);
    const read = response();
    await progress({ method: "GET", headers: { cookie: brother.cookie, "x-citoyen-user": brother.id } }, read);
    assert.equal(read.body.data, null);
    const crossed = response();
    await progress({ method: "PUT", headers: { cookie: brother.cookie, "x-citoyen-user": owner.id }, body: { data } }, crossed);
    assert.equal(crossed.statusCode, 409);
    const restored = response();
    await progress({ method: "GET", headers: { cookie: owner.cookie, "x-citoyen-user": owner.id } }, restored);
    assert.equal(restored.body.data.attempts.length, 40);
    assert.equal((await call("sign-out", {}, owner.cookie)).status, 200);
    const signedOut = response();
    await progress({ method: "GET", headers: { cookie: owner.cookie, "x-citoyen-user": owner.id } }, signedOut);
    assert.equal(signedOut.statusCode, 401);
    await db.query("INSERT INTO ai_monthly_usage VALUES (date_trunc('month', now() AT TIME ZONE 'UTC')::date, 99)");
    const results = await Promise.all([reserveMonthlyRequest(owner, response()), reserveMonthlyRequest(brother, response())]);
    assert.equal(results.filter(Boolean).length, 1);
  } finally { globalThis.fetch = previousFetch; await db.end(); }
});
