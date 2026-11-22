import React from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App } from "../src/App";
import { ApiClient } from "../src/lib/client";
import { Civics } from "../src/components/Civics";
import type { Progress } from "../src/hooks/useProgress";
import { emptyData, type AppConfig } from "../shared/contracts";
import { writeProgress } from "../src/lib/progress";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});
const config: AppConfig = {
  localMode: true,
  appReady: true,
  authConfigured: false,
  speechConfigured: false,
  languageFeedbackConfigured: false,
  monthlyRequestAllowance: 100,
};
test("hosted study screens stay behind sign-in", () => {
  render(<App client={new ApiClient({ ...config, localMode: false })} />);
  expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Start a study session" }),
  ).toBeNull();
});
test("local study includes all modes and saves a writing draft without cloud services", () => {
  render(<App client={new ApiClient(config)} />);
  for (const name of [
    "Civic exam",
    "Listening",
    "Reading",
    "Writing",
    "Speaking",
    "Interview",
  ])
    expect(screen.getByRole("button", { name })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Writing" }));
  fireEvent.change(screen.getByLabelText("Your answer in French"), {
    target: { value: "Je voudrais visiter le marché samedi." },
  });
  expect(
    JSON.parse(localStorage.getItem("citoyen.study.v1")!).drafts.W01,
  ).toContain("marché");
});
test("the mock submits once when its 45-minute deadline passes", () => {
  vi.useFakeTimers();
  const addAttempt = vi.fn();
  const progress: Progress = {
    data: emptyData(),
    addAttempt,
    saveDraft: vi.fn(),
    status: "",
    ready: true,
  };
  render(<Civics progress={progress} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Start 40-question mock" }),
  );
  act(() => vi.advanceTimersByTime(45 * 60 * 1000));
  expect(addAttempt).toHaveBeenCalledTimes(1);
  expect(addAttempt.mock.calls[0][0]).toMatchObject({
    skill: "civics",
    total: 40,
    correct: 0,
  });
  act(() => vi.advanceTimersByTime(10000));
  expect(addAttempt).toHaveBeenCalledTimes(1);
});

test("a timed civic mock survives navigation to another study screen", () => {
  render(<App client={new ApiClient(config)} />);
  fireEvent.click(screen.getByRole("button", { name: "Civic exam" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Start 40-question mock" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next question" }));
  expect(
    screen.getByRole("heading", { name: "Question 2 of 40" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reading" }));
  fireEvent.click(screen.getByRole("button", { name: "Civic exam" }));
  expect(
    screen.getByRole("heading", { name: "Question 2 of 40" }),
  ).toBeTruthy();
});

test("a signed-in account sees only its own saved history", async () => {
  const client = new ApiClient({ ...config, localMode: false, authConfigured: true });
  let current = { user: { id: "owner", email: "owner@example.com" } };
  const refetch = vi.fn(async () => { current = { user: { id: "brother", email: "brother@example.com" } }; });
  Object.defineProperty(client, "auth", { value: { useSession: () => ({ data: current, isPending: false, isRefetching: false, error: null, refetch }) } });
  vi.spyOn(client, "request").mockResolvedValue({ data: emptyData() });
  for (const [id, title] of [["owner", "Owner private session"], ["brother", "Brother private session"]]) {
    writeProgress(localStorage, id, { ...emptyData(), updatedAt: "2026-10-14T12:00:00.000Z", attempts: [{ id, title, skill: "writing", correct: 0, total: 0, at: "2026-10-14T12:00:00.000Z" }] });
  }
  render(<App client={client} />);
  await screen.findByText("Owner private session");
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "citoyen.account-change" })));
  expect(screen.queryByText("Owner private session")).toBeNull();
  await screen.findByText("Brother private session");
  expect(screen.queryByText("Owner private session")).toBeNull();
});
