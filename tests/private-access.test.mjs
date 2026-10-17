import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import authHandler from "../api/auth.ts";
import progressHandler from "../api/progress.ts";
import feedbackHandler from "../api/speaking-feedback.ts";

const environmentKeys = [
  "VERCEL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "ALLOWED_EMAILS",
];
const previousEnvironment = new Map(
  environmentKeys.map((key) => [key, process.env[key]]),
);
const previousFetch = globalThis.fetch;

afterEach(() => {
  for (const [key, value] of previousEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = previousFetch;
});

function configurePrivateAccess() {
  process.env.VERCEL = "1";
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  process.env.ALLOWED_EMAILS = "owner@example.com, brother@example.com";
}

function response() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
    },
  };
}

test("private sign-in rejects an email outside the allowlist before contacting Supabase", async () => {
  configurePrivateAccess();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("unexpected request");
  };
  const res = response();

  await authHandler(
    {
      method: "POST",
      body: { email: "stranger@example.com", password: "secret" },
    },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.equal(calls, 0);
});

test("private sign-in accepts an allowed email and returns its session", async () => {
  configurePrivateAccess();
  let requestedBody;
  globalThis.fetch = async (_url, options) => {
    requestedBody = JSON.parse(options.body);
    return Response.json({
      access_token: "test-session",
      refresh_token: "test-refresh",
      expires_in: 3600,
      user: { email: "owner@example.com" },
    });
  };
  const res = response();

  await authHandler(
    {
      method: "POST",
      body: { email: " OWNER@example.com ", password: "secret" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(requestedBody.email, "owner@example.com");
  assert.equal(requestedBody.password, "secret");
  assert.equal(res.body.email, "owner@example.com");
  assert.equal(res.body.accessToken, "test-session");
});

test("progress reads are scoped to the signed-in Supabase user", async () => {
  configurePrivateAccess();
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    if (String(url).endsWith("/auth/v1/user"))
      return Response.json({ id: "owner-id", email: "owner@example.com" });
    return Response.json([
      {
        data: {
          attempts: [],
          drafts: { W01: "My private draft" },
          updatedAt: null,
        },
      },
    ]);
  };
  const res = response();

  await progressHandler(
    { method: "GET", headers: { authorization: "Bearer test-session" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, {
    attempts: [],
    drafts: { W01: "My private draft" },
    updatedAt: null,
  });
  assert.ok(requested.some((url) => url.includes("user_id=eq.owner-id")));
});

test("hosted progress and paid feedback reject unauthenticated access", async () => {
  configurePrivateAccess();
  const res = response();
  await progressHandler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 401);
  const feedbackRes = response();
  await feedbackHandler(
    {
      method: "POST",
      headers: {},
      body: { kind: "speaking", text: "Bonjour", prompt: "" },
    },
    feedbackRes,
  );
  assert.equal(feedbackRes.statusCode, 401);
});

test("invalid study data is rejected before any database write", async () => {
  configurePrivateAccess();
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    return Response.json({ id: "owner-id", email: "owner@example.com" });
  };
  const res = response();
  await progressHandler(
    {
      method: "PUT",
      headers: { authorization: "Bearer test-session" },
      body: {
        data: { attempts: "invalid", drafts: [], updatedAt: "yesterday" },
      },
    },
    res,
  );
  assert.equal(res.statusCode, 400);
  assert.equal(requested.length, 1);
  assert.ok(requested[0].endsWith("/auth/v1/user"));
});

test("a removed invitation is rejected even with a valid Supabase session", async () => {
  configurePrivateAccess();
  globalThis.fetch = async () =>
    Response.json({ id: "stranger-id", email: "stranger@example.com" });
  const res = response();
  await progressHandler(
    { method: "GET", headers: { authorization: "Bearer valid-token" } },
    res,
  );
  assert.equal(res.statusCode, 401);
});
