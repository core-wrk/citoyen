import { useEffect, useRef, useState } from "react";
import { INTERVIEW_PROMPTS, SPEAKING_DRILLS } from "../content/exercises";
import { browserRecognition, speakFrench, startRecording } from "../lib/audio";
import { chooseSpeechService, phraseMatch } from "../lib/study";
import type { ApiClient } from "../lib/client";
import type { Progress } from "../hooks/useProgress";
import type { Feedback, Pronunciation } from "../../shared/contracts";
import { ErrorNotice, FeedbackView, Heading } from "./ui";

interface Prompt {
  id: string;
  title: string;
  text: string;
  kind: string;
  durationSeconds?: number;
}
function SpeechExercise({
  prompt,
  interview,
  client,
  progress,
}: {
  prompt: Prompt;
  interview: boolean;
  client: ApiClient;
  progress: Progress;
}) {
  const [transcript, setTranscript] = useState(""),
    [audio, setAudio] = useState<Blob | null>(null),
    [url, setUrl] = useState("");
  const [recording, setRecording] = useState(false),
    [starting, setStarting] = useState(false),
    [busy, setBusy] = useState(false);
  const [azureConsent, setAzureConsent] = useState(false),
    [browserConsent, setBrowserConsent] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null),
    [assessment, setAssessment] = useState<Pronunciation | null>(null),
    [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null),
    stop = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      abort.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  useEffect(() => {
    if (!audio) {
      setUrl("");
      return;
    }
    const value = URL.createObjectURL(audio);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [audio]);
  async function record() {
    abort.current?.abort();
    abort.current = new AbortController();
    const signal = abort.current.signal;
    setStarting(true);
    setAudio(null);
    setTranscript("");
    setFeedback(null);
    setAssessment(null);
    setError("");
    stop.current = null;
    const service = chooseSpeechService({
      azureAvailable: client.config.speechConfigured,
      azureConsent,
      browserAvailable: Boolean(browserRecognition()),
      browserConsent,
    });
    setAzureConsent(false);
    setBrowserConsent(false);
    try {
      await startRecording({
        signal,
        service,
        reference: prompt.kind === "reading" ? prompt.text : "",
        seconds: prompt.durationSeconds || 210,
        onReady: (callback) => {
          stop.current = callback;
          setStarting(false);
          setRecording(true);
        },
        onAudio: setAudio,
        onTranscript: (text) =>
          setTranscript((old) => `${old} ${text}`.trim().slice(0, 5000)),
        onAssessment: setAssessment,
        onStopped: () => {
          setRecording(false);
          setStarting(false);
        },
        onError: setError,
        getToken: () =>
          client.request("/api/azure-token", { method: "POST", body: "{}" }),
      });
    } catch (e) {
      if (!signal.aborted) {
        setStarting(false);
        setRecording(false);
        setError(
          (e as Error).name === "NotAllowedError"
            ? "Microphone permission was denied. Allow access in browser settings or upload a recording."
            : "The microphone could not start. Try another recording or upload audio.",
        );
      }
    }
  }
  function stopNow() {
    if (stop.current) stop.current();
    else {
      abort.current?.abort();
      setStarting(false);
    }
  }
  async function review() {
    setBusy(true);
    setError("");
    try {
      let pronunciation = assessment;
      if (!pronunciation && prompt.kind === "reading") {
        const match = phraseMatch(prompt.text, transcript);
        pronunciation = {
          transcriptionMatch: Math.round(match.accuracy * 100),
          missing: match.missing,
        };
        setAssessment(pronunciation);
      }
      const result = await client.feedback("speaking", transcript, prompt.text);
      setFeedback(result);
      progress.addAttempt({
        skill: interview ? "interview" : "speaking",
        title: prompt.title,
        correct: 0,
        total: 0,
        transcript,
        feedback: result,
        ...(pronunciation ? { pronunciation } : {}),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-panel">
      <h2>{prompt.title}</h2>
      <p className="prompt-card" lang="fr">
        {prompt.text}
      </p>
      <button
        className="text-button"
        onClick={() => {
          try {
            speakFrench(prompt.text);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Hear the {prompt.kind === "reading" ? "phrase" : "question"}
      </button>
      <div className="media-action">
        <p role="status">
          {starting
            ? "Waiting for microphone permission…"
            : recording
              ? "Recording · speak clearly"
              : "Ready to practise in your own words."}
        </p>
        {!recording && !starting && (
          <div className="speech-consents">
            {client.config.speechConfigured && (
              <label>
                <input
                  type="checkbox"
                  checked={azureConsent}
                  onChange={(e) => setAzureConsent(e.target.checked)}
                />{" "}
                Send this recording to Microsoft Azure for transcription and
                pronunciation assessment.
              </label>
            )}
            {browserRecognition() && (
              <label>
                <input
                  type="checkbox"
                  checked={browserConsent}
                  onChange={(e) => setBrowserConsent(e.target.checked)}
                />{" "}
                Allow my browser’s speech service to transcribe this recording;
                audio may be processed outside this device.
              </label>
            )}
          </div>
        )}
        <div className="button-row">
          <button
            className="primary-button"
            disabled={busy}
            onClick={recording || starting ? stopNow : record}
          >
            {starting
              ? "Cancel recording"
              : recording
                ? "Stop recording"
                : "Start recording"}
          </button>
          <label className="secondary-button">
            Upload audio
            <input
              aria-label="Upload audio"
              type="file"
              accept="audio/*"
              className="is-hidden"
              disabled={recording || starting || busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith("audio/")) {
                  setError("Choose an audio file.");
                  return;
                }
                abort.current?.abort();
                setAudio(file);
                setTranscript("");
                setAssessment(null);
                setFeedback(null);
              }}
            />
          </label>
        </div>
        {url && (
          <audio
            aria-label="Your recording"
            controls
            src={url}
            style={{ width: "100%", marginTop: 16 }}
          />
        )}
      </div>
      <p className="note-box">
        Audio stays in this page unless you opt into a speech service for that
        recording. Uploaded audio is available for local replay; add its
        transcript for word-choice feedback. Raw recordings are discarded when
        you leave this exercise.
        {prompt.durationSeconds &&
          ` Live recording limit: ${prompt.durationSeconds} seconds.`}
      </p>
      <label className="response-title" htmlFor="spoken-transcript">
        Your transcript — correct recognition errors before review
      </label>
      <textarea
        id="spoken-transcript"
        className="transcript-input"
        lang="fr"
        value={transcript}
        maxLength={5000}
        disabled={busy}
        onChange={(e) => {
          setTranscript(e.target.value);
          setFeedback(null);
        }}
      />
      <div className="button-row">
        <button
          className="primary-button"
          disabled={
            busy || recording || starting || transcript.trim().length < 3
          }
          onClick={review}
        >
          {busy
            ? "Reviewing…"
            : client.config.languageFeedbackConfigured
              ? "Review my answer"
              : "Save and self-review"}
        </button>
        <button
          className="secondary-button"
          disabled={recording || starting || busy}
          onClick={() => {
            abort.current?.abort();
            setAudio(null);
            setTranscript("");
            setAssessment(null);
            setFeedback(null);
          }}
        >
          Clear recording
        </button>
      </div>
      {client.config.languageFeedbackConfigured && (
        <p className="setup-note">
          Requesting feedback sends the transcript to OpenAI; it does not assess
          pronunciation from text.
        </p>
      )}
      <ErrorNotice message={error} />
      {assessment && (
        <div className="result-card">
          <h3>
            {assessment.accuracy !== undefined
              ? `French pronunciation · ${Math.round(assessment.accuracy)}/100`
              : `Transcript word match · ${assessment.transcriptionMatch}%`}
          </h3>
          <p>
            {assessment.accuracy !== undefined
              ? "Azure assessed your audio. This is a practice aid, not an official TCF score."
              : "This compares recognized words with the phrase. It is not a pronunciation or accent rating."}
          </p>
          {assessment.fluency !== undefined && (
            <p>Fluency: {Math.round(assessment.fluency)}/100</p>
          )}
          {Boolean(assessment.errors?.length || assessment.missing?.length) && (
            <p>
              Words to practise:{" "}
              {[
                ...(assessment.errors || []),
                ...(assessment.missing || []),
              ].join(", ")}
            </p>
          )}
        </div>
      )}
      <FeedbackView feedback={feedback} />
    </section>
  );
}

export function Speaking({
  interview = false,
  client,
  progress,
}: {
  interview?: boolean;
  client: ApiClient;
  progress: Progress;
}) {
  const [index, setIndex] = useState(0);
  const prompts: Prompt[] = interview
    ? INTERVIEW_PROMPTS.map((text, i) => ({
        id: `I${i}`,
        title: `Interview question ${i + 1}`,
        text,
        kind: "open",
      }))
    : SPEAKING_DRILLS;
  return (
    <>
      <Heading
        eyebrow={interview ? "ENTRETIEN DE NATURALISATION" : "SPOKEN FRENCH"}
        title={interview ? "Interview practice" : "Speaking"}
      >
        {interview
          ? "Use real details from your life. There is no single right answer."
          : "Record, replay, and improve your French one answer at a time."}
      </Heading>
      <div className="content-layout">
        <SpeechExercise
          key={prompts[index].id}
          prompt={prompts[index]}
          interview={interview}
          client={client}
          progress={progress}
        />
        <aside className="side-panel">
          <h3>{interview ? "Interview prompts" : "Speaking drills"}</h3>
          <div className="session-list">
            {prompts.map((p, i) => (
              <button
                key={p.id}
                className={`session-button ${index === i ? "is-active" : ""}`}
                onClick={() => setIndex(i)}
              >
                {p.title}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
