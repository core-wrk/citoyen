import { useEffect, useState } from "react";
import { LISTENING, READINGS } from "../content/exercises";
import type { Progress } from "../hooks/useProgress";
import { speakFrench } from "../lib/audio";
import { Choices, ErrorNotice, Heading } from "./ui";

export function Comprehension({
  kind,
  progress,
}: {
  kind: "listening" | "reading";
  progress: Progress;
}) {
  const items = kind === "listening" ? LISTENING : READINGS;
  const [index, setIndex] = useState(0),
    [choice, setChoice] = useState<number | null>(null),
    [checked, setChecked] = useState(false),
    [transcript, setTranscript] = useState(false),
    [speed, setSpeed] = useState(1),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [index],
  );
  const item = items[index];
  function select(i: number) {
    setIndex(i);
    setChoice(null);
    setChecked(false);
    setTranscript(false);
  }
  return (
    <>
      <Heading
        eyebrow="FRENCH PRACTICE"
        title={kind === "listening" ? "Listening" : "Reading"}
      >
        {kind === "listening"
          ? "Listen first, then answer what you understood."
          : "Read the text and answer the question."}
      </Heading>
      <div className="content-layout">
        <section className="content-panel">
          <h2>{item.title}</h2>
          {kind === "listening" ? (
            <>
              <div className="button-row">
                <button
                  className="primary-button"
                  onClick={() => {
                    try {
                      speakFrench(item.text, speed);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Listen in French
                </button>
                <label>
                  Speed{" "}
                  <select
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  >
                    <option value="0.8">Slow</option>
                    <option value="1">Normal</option>
                    <option value="1.2">Fast</option>
                  </select>
                </label>
                <button
                  className="secondary-button"
                  onClick={() => setTranscript((v) => !v)}
                >
                  {transcript ? "Hide" : "Show"} transcript
                </button>
              </div>
              {transcript && (
                <p className="reading-passage" lang="fr">
                  {item.text}
                </p>
              )}
            </>
          ) : (
            <p className="reading-passage" lang="fr">
              {item.text}
            </p>
          )}
          <ErrorNotice message={error} />
          <p className="question-text" lang="fr">
            {item.question}
          </p>
          <Choices
            options={item.options}
            value={choice}
            answer={checked ? item.answer : undefined}
            disabled={checked}
            onChange={setChoice}
          />
          {checked && <div className="feedback-box">{item.explanation}</div>}
          <div className="quiz-controls">
            <button
              className="primary-button"
              disabled={choice === null || checked}
              onClick={() => {
                setChecked(true);
                progress.addAttempt({
                  skill: kind,
                  title: item.title,
                  correct: Number(choice === item.answer),
                  total: 1,
                });
              }}
            >
              Check answer
            </button>
            <button
              className="secondary-button"
              onClick={() => select((index + 1) % items.length)}
            >
              Next exercise
            </button>
          </div>
          {kind === "listening" && (
            <p className="setup-note">
              Playback uses your device’s French voice. Audio quality and
              available voices vary by browser.
            </p>
          )}
        </section>
        <aside className="side-panel">
          <h3>Practice set</h3>
          <div className="session-list">
            {items.map((entry, i) => (
              <button
                key={entry.id}
                className={`session-button ${index === i ? "is-active" : ""}`}
                onClick={() => select(i)}
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
