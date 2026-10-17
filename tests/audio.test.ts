import { afterEach, expect, test, vi } from "vitest";
import { startRecording, type RecordingOptions } from "../src/lib/audio";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["audio"]) });
      this.onstop?.();
    }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  const abort = new AbortController();
  const options: RecordingOptions = {
    signal: abort.signal,
    service: "local",
    reference: "",
    seconds: 210,
    onAudio: vi.fn(),
    onTranscript: vi.fn(),
    onAssessment: vi.fn(),
    onStopped: vi.fn(),
    onError: vi.fn(),
    getToken: vi.fn(),
  };
  return { track, stream, abort, options };
}
test("leaving an exercise while permission is pending releases the late microphone stream", async () => {
  const { track, stream, abort, options } = setup();
  let resolve!: (stream: MediaStream) => void;
  const pending = startRecording(
    options,
    () =>
      new Promise<MediaStream>((r) => {
        resolve = r;
      }),
  );
  abort.abort();
  resolve(stream);
  await pending;
  expect(track.stop).toHaveBeenCalledOnce();
  expect(options.onAudio).not.toHaveBeenCalled();
  expect(options.getToken).not.toHaveBeenCalled();
});
test("navigation stops active recording and discards its audio callbacks", async () => {
  const { track, stream, abort, options } = setup();
  await startRecording(options, async () => stream);
  abort.abort();
  expect(track.stop).toHaveBeenCalledOnce();
  expect(options.onAudio).not.toHaveBeenCalled();
});
test("the recording deadline releases the microphone and keeps local replay audio", async () => {
  vi.useFakeTimers();
  const { track, stream, options } = setup();
  await startRecording(options, async () => stream);
  vi.advanceTimersByTime(210000);
  expect(track.stop).toHaveBeenCalledOnce();
  expect(options.onAudio).toHaveBeenCalledOnce();
  expect(options.getToken).not.toHaveBeenCalled();
});
