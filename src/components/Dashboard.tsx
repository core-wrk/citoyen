import { useState } from "react";
import type { Attempt, Page } from "../../shared/contracts";
import type { Progress } from "../hooks/useProgress";
import { FeedbackView } from "./ui";

export const PAGES: {
  id: Page;
  title: string;
  glyph: string;
  description: string;
}[] = [
  { id: "home", title: "Overview", glyph: "⌂", description: "" },
  {
    id: "civics",
    title: "Civic exam",
    glyph: "§",
    description:
      "Knowledge questions, situations, and a timed 40-question mock.",
  },
  {
    id: "listening",
    title: "Listening",
    glyph: "♫",
    description:
      "Hear French in daily situations, then check your understanding.",
  },
  {
    id: "reading",
    title: "Reading",
    glyph: "▤",
    description: "Read notices and messages, then answer questions.",
  },
  {
    id: "writing",
    title: "Writing",
    glyph: "✎",
    description: "Practise short notes and supported opinions.",
  },
  {
    id: "speaking",
    title: "Speaking",
    glyph: "◖",
    description: "Record, replay, and review your French answers.",
  },
  {
    id: "interview",
    title: "Interview",
    glyph: "◌",
    description: "Rehearse the conversation at the prefecture.",
  },
];
export function Dashboard({
  progress,
  navigate,
}: {
  progress: Progress;
  navigate(page: Page): void;
}) {
  const [selected, setSelected] = useState<Attempt | null>(null);
  const scores = progress.data.attempts
    .filter((a) => a.skill === "civics" && a.total)
    .map((a) => Math.round((a.correct / a.total) * 100));
  const best = scores.length ? Math.max(...scores) : null;
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">YOUR NEXT STEP, IN FRENCH</div>
          <h1>
            Bonjour.
            <br />
            Ready when you are.
          </h1>
          <p>
            Build confidence in the civic exam, everyday French, and the
            conversation ahead.
          </p>
          <button className="primary-button" onClick={() => navigate("civics")}>
            Start a study session
          </button>
        </div>
        <div className="hero-seal">
          <span className="seal-top">NATURALISATION</span>
          <span className="seal-number">40</span>
          <span className="seal-bottom">questions to practise</span>
        </div>
      </section>
      <div className="stat-row">
        {[
          [best === null ? "—" : `${best}%`, "Best civic result"],
          [progress.data.attempts.length, "Sessions completed"],
          ["B2", "French language target"],
        ].map(([value, label]) => (
          <div className="stat-block" key={label}>
            <div className="stat-copy">
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>
      <section>
        <div className="section-heading">
          <h2>Choose a practice</h2>
        </div>
        <div className="study-grid">
          {PAGES.slice(1).map((p) => (
            <button
              className="study-card"
              key={p.id}
              onClick={() => navigate(p.id)}
            >
              <div className="card-topline">
                <span className="card-icon">{p.glyph}</span>
                <span className="card-kicker">PRACTICE</span>
              </div>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <span className="card-arrow">↗</span>
            </button>
          ))}
        </div>
      </section>
      <section className="recent-section">
        <div className="section-heading">
          <h2>Last sessions</h2>
        </div>
        <div className="recent-list">
          {!progress.data.attempts.length ? (
            <p className="empty-note">
              Your completed sessions will appear here.
            </p>
          ) : (
            progress.data.attempts.slice(0, 10).map((a) => (
              <button
                className="recent-item recent-button"
                key={a.id}
                onClick={() => setSelected(a)}
              >
                <span className="recent-mark" />
                <span className="recent-main">
                  <strong>{a.title}</strong>
                  <small>{new Date(a.at).toLocaleDateString()}</small>
                </span>
                <span className="recent-score">
                  {a.total ? `${a.correct}/${a.total}` : "Saved"}
                </span>
              </button>
            ))
          )}
        </div>
      </section>
      {selected && (
        <div className="modal-backdrop">
          <section
            className="dialog modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Saved session"
          >
            <button
              className="dialog-close"
              autoFocus
              onClick={() => setSelected(null)}
            >
              Close
            </button>
            <h2>{selected.title}</h2>
            {selected.total > 0 && (
              <p>
                {selected.correct}/{selected.total}
              </p>
            )}
            <p className="transcript-box" lang="fr">
              {selected.text || selected.transcript}
            </p>
            <FeedbackView feedback={selected.feedback || null} />
          </section>
        </div>
      )}
    </>
  );
}
