import { beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach } from "vitest";
import { emptyData, type StudyData, type AppConfig } from "../shared/contracts";
import {
  mergeProgress,
  progressKey,
  readProgress,
  writeProgress,
} from "../src/lib/progress";
import { ApiClient } from "../src/lib/client";
import { useProgress } from "../src/hooks/useProgress";
import type { SupabaseClient } from "@supabase/supabase-js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());
const config: AppConfig = {
  localMode: false,
  appReady: true,
  authConfigured: true,
  speechConfigured: false,
  languageFeedbackConfigured: false,
  monthlyRequestAllowance: 100,
  supabase: null,
};
const data = (text: string, date = "2026-10-14T12:00:00.000Z"): StudyData => ({
  ...emptyData(),
  drafts: { W01: text },
  updatedAt: date,
});

test("guest and different account drafts remain in separate browser records", () => {
  writeProgress(localStorage, null, data("guest draft"));
  writeProgress(localStorage, "owner", data("private owner draft"));
  expect(readProgress(localStorage, "brother")).toEqual(emptyData());
  writeProgress(localStorage, "brother", data("brother draft"));
  expect(readProgress(localStorage, "owner").drafts.W01).toBe(
    "private owner draft",
  );
  expect(localStorage.getItem(progressKey("brother"))).not.toContain(
    "owner draft",
  );
});

test("legacy optional assessment fields do not discard the learner’s saved answers", () => {
  const previous = {
    ...data("My existing draft"),
    attempts: [
      {
        id: "a",
        skill: "speaking",
        title: "My answer",
        correct: 0,
        total: 0,
        at: "2026-10-14T12:00:00.000Z",
        transcript: "Bonjour, je suis Andrew.",
        pronunciation: null,
        feedback: { error: "The provider was unavailable." },
      },
    ],
  };
  localStorage.setItem(progressKey(null), JSON.stringify(previous));
  const result = readProgress(localStorage, null);
  expect(result.attempts[0].transcript).toBe("Bonjour, je suis Andrew.");
  expect(result.drafts.W01).toBe("My existing draft");
});

test("unsupported browser records are preserved rather than overwritten with an empty record", () => {
  const raw = '{"unexpected":"saved value"}';
  localStorage.setItem(progressKey("owner"), raw);
  expect(() => writeProgress(localStorage, "owner", emptyData())).toThrow(
    "preserved",
  );
  expect(localStorage.getItem(progressKey("owner"))).toBe(raw);
});

test("sync retains attempts from both devices and chooses the latest draft snapshot", () => {
  const earlier = data("old local draft");
  const later = data("newer cloud draft", "2026-10-14T13:00:00.000Z");
  earlier.attempts = [
    {
      id: "a",
      skill: "writing",
      title: "First",
      correct: 0,
      total: 0,
      at: earlier.updatedAt!,
    },
  ];
  later.attempts = [
    {
      id: "b",
      skill: "writing",
      title: "Second",
      correct: 0,
      total: 0,
      at: later.updatedAt!,
    },
  ];
  const result = mergeProgress(earlier, later);
  expect(result.drafts.W01).toBe("newer cloud draft");
  expect(result.attempts.map((a) => a.id)).toEqual(["b", "a"]);
});

test("a delayed request from the previous account cannot send its data with the new account token", async () => {
  const client = new ApiClient(config),
    network = vi.spyOn(globalThis, "fetch");
  Object.defineProperty(client, "auth", {
    value: {
      auth: {
        getSession: async () => ({
          data: {
            session: { user: { id: "brother" }, access_token: "brother-token" },
          },
        }),
      },
    } as unknown as SupabaseClient,
  });
  await expect(
    client.request(
      "/api/progress",
      { method: "PUT", body: JSON.stringify({ data: data("owner draft") }) },
      "owner",
    ),
  ).rejects.toThrow("account changed");
  expect(network).not.toHaveBeenCalled();
});

test("failed cloud loading never overwrites cloud records with the stale browser copy", async () => {
  const client = new ApiClient(config),
    request = vi
      .spyOn(client, "request")
      .mockRejectedValue(new Error("Study sync is unavailable."));
  writeProgress(localStorage, "owner", data("old browser copy"));
  const hook = renderHook(() => useProgress(client, "owner"));
  await waitFor(() =>
    expect(hook.result.current.status).toBe("Study sync is unavailable."),
  );
  act(() => hook.result.current.saveDraft("W01", "offline change"));
  expect(hook.result.current.ready).toBe(false);
  expect(request.mock.calls.every(([, init]) => !init?.method)).toBe(true);
});
