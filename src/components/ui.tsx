import type { Feedback } from "../../shared/contracts";

export function Heading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading-row">
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{children}</p>
    </div>
  );
}
export function FeedbackView({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;
  return (
    <div className="feedback-box">
      <strong>{feedback.local ? "Self-review" : "Language feedback"}</strong>
      <p>{feedback.summary}</p>
      {feedback.correctedText && (
        <p className="transcript-box" lang="fr">
          {feedback.correctedText}
        </p>
      )}
      {feedback.relevance && <p>{feedback.relevance}</p>}
      <ul>
        {feedback.improvements.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </div>
  );
}
export function Choices({
  options,
  value,
  answer,
  disabled,
  onChange,
}: {
  options: string[];
  value: number | null;
  answer?: number;
  disabled?: boolean;
  onChange(value: number): void;
}) {
  return (
    <div className="choice-list">
      {options.map((option, i) => (
        <button
          key={option}
          className={`choice ${value === i ? "is-selected" : ""} ${answer === i ? "is-correct" : ""} ${answer !== undefined && value === i && i !== answer ? "is-wrong" : ""}`}
          disabled={disabled}
          onClick={() => onChange(i)}
        >
          <span className="choice-key">{String.fromCharCode(65 + i)}</span>
          <span>{option}</span>
        </button>
      ))}
    </div>
  );
}
export function ErrorNotice({ message }: { message?: string | null }) {
  return message ? (
    <p className="small-error" role="alert">
      {message}
    </p>
  ) : null;
}
