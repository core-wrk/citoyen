import { useEffect, useState } from "react";
import { WRITING_PROMPTS } from "../content/exercises";
import type { Feedback } from "../../shared/contracts";
import type { Progress } from "../hooks/useProgress";
import type { ApiClient } from "../lib/client";
import { speakFrench } from "../lib/audio";
import { ErrorNotice, FeedbackView, Heading } from "./ui";

export function Writing({
  progress,
  client,
}: {
  progress: Progress;
  client: ApiClient;
}) {
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const [index, setIndex] = useState(0),
    [feedback, setFeedback] = useState<Feedback | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const item = WRITING_PROMPTS[index],
    text = progress.data.drafts[item.id] || "",
    count = text.trim().split(/\s+/).filter(Boolean).length;
  async function review() {
    setBusy(true);
    setError("");
    try {
      const result = await client.feedback(
        "writing",
        text,
        item.prompt +
          (item.minWords
            ? ` Target: ${item.minWords}–${item.maxWords} words.`
            : ""),
      );
      setFeedback(result);
      progress.addAttempt({
        skill: "writing",
        title: item.title,
        correct: 0,
        total: 0,
        text,
        feedback: result,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading eyebrow="WRITTEN FRENCH" title="Writing">
        Practise a short message, an experience, or a supported opinion.
      </Heading>
      <div className="content-layout">
        <section className="content-panel">
          <h2>{item.title}</h2>
          <p className="question-text" lang="fr">
            {item.prompt}
          </p>
          <label className="response-title" htmlFor="writing-answer">
            Your answer in French
          </label>
          <textarea
            id="writing-answer"
            className="writing-input"
            lang="fr"
            value={text}
            maxLength={5000}
            disabled={busy}
            onChange={(e) => {
              progress.saveDraft(item.id, e.target.value);
              setFeedback(null);
            }}
          />
          <div className="draft-meta">
            <span>Draft saved on this device</span>
            <span>
              {count} words
              {item.minWords
                ? ` · target ${item.minWords}–${item.maxWords}`
                : ""}
            </span>
          </div>
          <div className="button-row">
            <button
              className="primary-button"
              onClick={review}
              disabled={busy || count < 5}
            >
              {busy
                ? "Reviewing…"
                : client.config.languageFeedbackConfigured
                  ? "Get language feedback"
                  : "Self-review answer"}
            </button>
            <button
              className="secondary-button"
              disabled={!text || busy}
              onClick={() => {
                try {
                  speakFrench(text);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Listen to my answer
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                progress.saveDraft(item.id, "");
                setFeedback(null);
              }}
            >
              Clear draft
            </button>
          </div>
          {client.config.languageFeedbackConfigured && (
            <p className="setup-note">
              Requesting feedback sends this answer to OpenAI. Your draft
              remains saved if feedback fails.
            </p>
          )}
          <ErrorNotice message={error} />
          <FeedbackView feedback={feedback} />
        </section>
        <aside className="side-panel">
          <h3>Writing prompts</h3>
          <div className="session-list">
            {WRITING_PROMPTS.map((entry, i) => (
              <button
                key={entry.id}
                className={`session-button ${i === index ? "is-active" : ""}`}
                disabled={busy}
                onClick={() => {
                  setIndex(i);
                  setFeedback(null);
                  setError("");
                }}
              >
                {entry.title}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
