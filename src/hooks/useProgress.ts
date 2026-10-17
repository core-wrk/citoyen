import { useEffect, useRef, useState } from "react";
import {
  studyDataSchema,
  emptyData,
  type Attempt,
  type StudyData,
} from "../../shared/contracts";
import { mergeProgress, readProgress, writeProgress } from "../lib/progress";
import type { ApiClient } from "../lib/client";

export function useProgress(client: ApiClient, userId: string | null) {
  const [data, setData] = useState(() => readProgress(localStorage, userId));
  const [status, setStatus] = useState(
    userId ? "Connecting your progress…" : "Saved on this device",
  );
  const [ready, setReady] = useState(!userId);
  const current = useRef(data);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  current.current = data;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    client
      .request<{ data: unknown }>("/api/progress", {}, userId)
      .then((result) => {
        if (!active) return;
        const cloud = result.data
          ? studyDataSchema.parse(result.data)
          : emptyData();
        setData(mergeProgress(current.current, cloud));
        setReady(true);
        setStatus("Private account · synced");
      })
      .catch((error) => {
        if (active) setStatus(error.message);
      });
    return () => {
      active = false;
    };
  }, [client, userId]);
  useEffect(() => {
    try {
      writeProgress(localStorage, userId, data);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "This browser could not save your progress.",
      );
    }
    if (!userId || !ready) return;
    let active = true;
    const timer = setTimeout(() => {
      // Serialize writes so an older slow response cannot overwrite a later draft.
      queue.current = queue.current
        .catch(() => {})
        .then(() =>
          client.request(
            "/api/progress",
            { method: "PUT", body: JSON.stringify({ data }) },
            userId,
          ),
        )
        .then(() => {
          if (active) setStatus("Private account · synced");
        })
        .catch(() => {
          if (active)
            setStatus(
              "Saved on this device. Cloud sync will retry after your next change or sign-in.",
            );
        });
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [data, client, userId, ready]);
  function addAttempt(input: Omit<Attempt, "id" | "at">) {
    const attempt: Attempt = {
      ...input,
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
    };
    setData((old) => ({
      ...old,
      attempts: [attempt, ...old.attempts].slice(0, 200),
      updatedAt: attempt.at,
    }));
  }
  function saveDraft(id: string, value: string) {
    setData((old) => ({
      ...old,
      drafts: { ...old.drafts, [id]: value },
      updatedAt: new Date().toISOString(),
    }));
  }
  return { data, addAttempt, saveDraft, status, ready };
}
export type Progress = ReturnType<typeof useProgress>;
