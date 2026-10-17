import type { Pronunciation } from "../../shared/contracts";

export function speakFrench(text: string, speed = 1) {
  if (!("speechSynthesis" in window))
    throw new Error("Speech playback is unavailable in this browser.");
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = speed;
  const voice = speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith("fr"));
  if (voice) utterance.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: {
          length: number;
          [n: number]: {
            isFinal: boolean;
            [n: number]: { transcript: string };
          };
        };
      }) => void)
    | null;
  start(): void;
  stop(): void;
}
type RecognitionConstructor = new () => BrowserRecognition;
export const browserRecognition = () => {
  const browser = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
};

export interface RecordingOptions {
  signal: AbortSignal;
  service: "local" | "browser" | "azure";
  reference: string;
  seconds: number;
  onAudio(blob: Blob): void;
  onTranscript(text: string): void;
  onAssessment(value: Pronunciation): void;
  onStopped(): void;
  onError(message: string): void;
  onReady?(stop: () => void): void;
  getToken(): Promise<{ token: string; region: string }>;
}

// The abort signal also covers a microphone permission request that resolves after navigation.
export async function startRecording(
  options: RecordingOptions,
  getMedia = () => navigator.mediaDevices.getUserMedia({ audio: true }),
) {
  const { signal } = options;
  const stream = await getMedia();
  if (signal.aborted) {
    stream.getTracks().forEach((t) => t.stop());
    return () => {};
  }
  let recorder: MediaRecorder | undefined;
  let browser: BrowserRecognition | undefined;
  let azure:
    | import("microsoft-cognitiveservices-speech-sdk").SpeechRecognizer
    | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const pieces: BlobPart[] = [];
  const segments: Pronunciation[] = [];
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    try {
      if (recorder?.state === "recording") recorder.stop();
    } catch {}
    try {
      browser?.stop();
    } catch {}
    try {
      azure?.stopContinuousRecognitionAsync(
        () => azure?.close(),
        () => azure?.close(),
      );
    } catch {
      azure?.close();
    }
    stream.getTracks().forEach((t) => t.stop());
    signal.removeEventListener("abort", stop);
    if (!signal.aborted) options.onStopped();
  }
  signal.addEventListener("abort", stop, { once: true });
  try {
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
      (type) => MediaRecorder.isTypeSupported(type),
    );
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data.size) pieces.push(event.data);
    };
    recorder.onstop = () => {
      if (!signal.aborted && pieces.length)
        options.onAudio(
          new Blob(pieces, { type: recorder?.mimeType || "audio/mp4" }),
        );
    };
    recorder.start(300);
    timer = setTimeout(stop, options.seconds * 1000);
    options.onReady?.(stop);
    if (options.service === "browser") {
      const Constructor = browserRecognition();
      if (Constructor) {
        browser = new Constructor();
        browser.lang = "fr-FR";
        browser.continuous = true;
        browser.interimResults = false;
        browser.onresult = (event) => {
          if (signal.aborted) return;
          for (let i = event.resultIndex; i < event.results.length; i++)
            if (event.results[i].isFinal)
              options.onTranscript(event.results[i][0].transcript);
        };
        browser.start();
      }
    }
    if (options.service === "azure") {
      try {
        const [SDK, credentials] = await Promise.all([
          import("microsoft-cognitiveservices-speech-sdk"),
          options.getToken(),
        ]);
        if (signal.aborted || stopped) return stop;
        const config = SDK.SpeechConfig.fromAuthorizationToken(
          credentials.token,
          credentials.region,
        );
        config.speechRecognitionLanguage = "fr-FR";
        azure = new SDK.SpeechRecognizer(
          config,
          SDK.AudioConfig.fromStreamInput(stream),
        );
        new SDK.PronunciationAssessmentConfig(
          options.reference,
          SDK.PronunciationAssessmentGradingSystem.HundredMark,
          SDK.PronunciationAssessmentGranularity.Word,
          true,
        ).applyTo(azure);
        azure.recognized = (_sender, event) => {
          if (signal.aborted) return;
          if (event.result.text) options.onTranscript(event.result.text);
          try {
            const raw = JSON.parse(
              event.result.properties.getProperty(
                SDK.PropertyId.SpeechServiceResponse_JsonResult,
              ),
            );
            const best = raw.NBest?.[0];
            if (best?.PronunciationAssessment) {
              segments.push({
                accuracy: best.PronunciationAssessment.AccuracyScore,
                fluency: best.PronunciationAssessment.FluencyScore,
                errors: (best.Words || [])
                  .filter(
                    (word: {
                      PronunciationAssessment?: { ErrorType: string };
                    }) =>
                      word.PronunciationAssessment?.ErrorType ===
                      "Mispronunciation",
                  )
                  .map((word: { Word: string }) => word.Word),
              });
              options.onAssessment({
                accuracy:
                  segments.reduce((s, p) => s + (p.accuracy || 0), 0) /
                  segments.length,
                fluency:
                  segments.reduce((s, p) => s + (p.fluency || 0), 0) /
                  segments.length,
                errors: segments.flatMap((p) => p.errors || []),
              });
            }
          } catch {}
        };
        azure.canceled = () => {
          if (!signal.aborted && !stopped)
            options.onError(
              "Cloud assessment was interrupted. Your local recording is still available.",
            );
        };
        azure.startContinuousRecognitionAsync(
          () => {},
          () => {
            if (!signal.aborted)
              options.onError(
                "Cloud assessment could not start. Record locally and type your transcript.",
              );
          },
        );
      } catch {
        if (!signal.aborted)
          options.onError(
            "Cloud assessment is unavailable. This recording stays local; type your transcript afterward.",
          );
      }
    }
  } catch (error) {
    stop();
    throw error;
  }
  return stop;
}
