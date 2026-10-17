import { useEffect, useRef, useState } from "react";
import { QUESTIONS, SCENARIO_QUESTIONS, THEMES } from "../content/questions";
import {
  createCivicExam,
  createScenarioPractice,
  scoreExam,
  shuffle,
} from "../lib/study";
import type { Question } from "../../shared/contracts";
import type { Progress } from "../hooks/useProgress";
import { Choices, Heading } from "./ui";

interface Practice {
  kind: "knowledge" | "scenario" | "mock";
  questions: Question[];
  deadline: number | null;
}
export function Civics({ progress }: { progress: Progress }) {
  const [theme, setTheme] = useState("all");
  const [practice, setPractice] = useState<Practice | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [remaining, setRemaining] = useState(2700);
  const saved = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  function finish() {
    if (!practice || saved.current) return;
    saved.current = true;
    const score = scoreExam(practice.questions, answersRef.current);
    progress.addAttempt({
      skill: "civics",
      title:
        practice.kind === "mock"
          ? "40-question civic mock"
          : practice.kind === "scenario"
            ? "12 situation practice"
            : "Knowledge practice",
      correct: score.correct,
      total: score.total,
    });
    setFinished(true);
  }
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (!practice?.deadline || finished) return;
    const update = () => {
      const seconds = Math.max(
        0,
        Math.ceil((practice.deadline! - Date.now()) / 1000),
      );
      setRemaining(seconds);
      if (!seconds) finishRef.current();
    };
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [practice, finished]);
  function start(kind: Practice["kind"]) {
    const questions =
      kind === "mock"
        ? createCivicExam(QUESTIONS, SCENARIO_QUESTIONS)
        : kind === "scenario"
          ? createScenarioPractice(SCENARIO_QUESTIONS)
          : shuffle(
              theme === "all"
                ? THEMES.flatMap((name) =>
                    shuffle(QUESTIONS.filter((q) => q.theme === name)).slice(
                      0,
                      2,
                    ),
                  )
                : QUESTIONS.filter((q) => q.theme === theme),
            );
    setPractice({
      kind,
      questions,
      deadline: kind === "mock" ? Date.now() + 2700000 : null,
    });
    setIndex(0);
    setAnswers({});
    setFinished(false);
    saved.current = false;
    setRemaining(2700);
  }
  if (!practice)
    return (
      <>
        <Heading eyebrow="CIVIC KNOWLEDGE" title="The French civic exam">
          Practise the five official themes, or try a timed 40-question mock.
        </Heading>
        <div className="filter-row">
          {["all", ...THEMES].map((name) => (
            <button
              key={name}
              className={`filter-chip ${theme === name ? "is-active" : ""}`}
              onClick={() => setTheme(name)}
            >
              {name === "all" ? "All themes" : name}
            </button>
          ))}
        </div>
        <section className="content-panel">
          <h2>Ready to practise?</h2>
          <div className="button-row">
            <button
              className="primary-button"
              onClick={() => start("knowledge")}
            >
              {theme === "all"
                ? "Start 10-question practice"
                : "Start theme practice"}
            </button>
            <button
              className="secondary-button"
              onClick={() => start("scenario")}
            >
              Practice 12 situations
            </button>
            <button className="secondary-button" onClick={() => start("mock")}>
              Start 40-question mock
            </button>
          </div>
          <p className="note-box">
            Knowledge prompts follow the official public list. Answer choices
            and explanations are study aids. The 12 situations are original
            practice examples, since official situation questions are not
            published. The mock uses 28 knowledge and 12 situation questions,
            lasts 45 minutes and has a passing threshold of 32/40.
          </p>
        </section>
      </>
    );
  const { questions, kind } = practice;
  const summary = scoreExam(questions, answers);
  if (finished)
    return (
      <>
        <Heading eyebrow="SESSION COMPLETE" title="Good work.">
          Review now to make the next round easier.
        </Heading>
        <section className="content-panel mock-summary">
          <div className="mock-score">
            {summary.correct}
            <small> / {summary.total}</small>
          </div>
          <p>
            {kind === "mock"
              ? summary.passed
                ? "You reached the official passing threshold of 32/40."
                : "The official passing score is 32/40."
              : "Review your answers, then try another round."}
          </p>
          <button className="primary-button" onClick={() => setPractice(null)}>
            Choose a practice
          </button>
          <div className="review-list">
            {questions
              .filter((q) => answers[q.id] !== q.answer)
              .map((q) => (
                <article className="review-item" key={q.id}>
                  <strong lang="fr">{q.question}</strong>
                  <p>
                    Your answer: {q.options[answers[q.id]] || "Not answered"}
                  </p>
                  <p>Suggested answer: {q.options[q.answer]}</p>
                  <p>{q.explanation}</p>
                </article>
              ))}
          </div>
        </section>
      </>
    );
  const q = questions[index],
    selected = answers[q.id] ?? null,
    checked = kind !== "mock" && selected !== null;
  return (
    <>
      <Heading
        eyebrow={kind === "mock" ? "TIMED MOCK" : "CIVIC PRACTICE"}
        title={
          kind === "scenario" ? "Practice situations" : "Civic exam practice"
        }
      >
        {kind === "mock"
          ? "No explanations until you finish."
          : "Read the explanation after each answer."}
      </Heading>
      <section className="content-panel">
        <div className="panel-head">
          <h2>
            Question {index + 1} of {questions.length}
          </h2>
          {kind === "mock" && (
            <span className="mock-clock" role="timer">
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        <p className="panel-subtitle">{q.theme}</p>
        <div className="progress-line">
          <span
            style={{ width: `${((index + 1) / questions.length) * 100}%` }}
          />
        </div>
        {q.type === "scenario" && (
          <p className="note-box">Original practice situation</p>
        )}
        <p className="question-text" lang="fr">
          {q.question}
        </p>
        <Choices
          options={q.options}
          value={selected}
          answer={checked ? q.answer : undefined}
          disabled={checked}
          onChange={(answer) =>
            setAnswers((old) => ({ ...old, [q.id]: answer }))
          }
        />
        {checked && (
          <div className="feedback-box">
            <strong>
              {selected === q.answer ? "Correct" : "Review this answer"}
            </strong>
            {q.explanation}
          </div>
        )}
        {q.source && (
          <a
            className="source-link"
            href={q.source.url}
            target="_blank"
            rel="noreferrer"
          >
            Official question list ↗
          </a>
        )}
        <div className="quiz-controls">
          {kind === "mock" && (
            <button
              className="secondary-button"
              disabled={!index}
              onClick={() => setIndex((i) => i - 1)}
            >
              Previous
            </button>
          )}
          <button
            className="primary-button"
            disabled={kind !== "mock" && !checked}
            onClick={() =>
              index === questions.length - 1 ? finish() : setIndex((i) => i + 1)
            }
          >
            {index === questions.length - 1
              ? "Finish practice"
              : "Next question"}
          </button>
        </div>
        {kind === "mock" && (
          <div className="question-jumps">
            {questions.map((q, i) => (
              <button
                key={q.id}
                className={`filter-chip ${index === i ? "is-active" : ""}`}
                aria-label={`Question ${i + 1}${answers[q.id] !== undefined ? ", answered" : ""}`}
                onClick={() => setIndex(i)}
              >
                {i + 1}
                {answers[q.id] !== undefined ? " ●" : ""}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
