import test from "node:test";
import assert from "node:assert/strict";
import progressHandler from "../api/progress.ts";
import feedbackHandler from "../api/speaking-feedback.ts";

function response() {
  return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; } };
}

test("hosted progress and paid feedback reject unauthenticated access", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const progress = response();
    await progressHandler({ method: "GET", headers: {} }, progress);
    assert.equal(progress.statusCode, 401);
    const feedback = response();
    await feedbackHandler({ method: "POST", headers: {}, body: { kind: "speaking", text: "Bonjour", prompt: "" } }, feedback);
    assert.equal(feedback.statusCode, 401);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
