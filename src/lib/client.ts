import { createAuthClient } from "better-auth/react";
import { feedbackSchema, type AppConfig, type Feedback } from "../../shared/contracts";

export class ApiClient {
  readonly auth: ReturnType<typeof createAuthClient> | null;
  constructor(readonly config: AppConfig) {
    this.auth = config.authConfigured ? createAuthClient() : null;
  }

  async request<T>(path: string, init: RequestInit = {}, expectedUserId?: string): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(expectedUserId ? { "x-citoyen-user": expectedUserId } : {}),
        ...init.headers,
      },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
    return payload as T;
  }

  async signIn(email: string, password: string) {
    const result = await this.auth!.signIn.email({ email, password });
    if (result.error) throw new Error(result.error.message || "Email or password was not accepted.");
    try { localStorage.setItem("citoyen.account-change", crypto.randomUUID()); } catch {}
  }

  async feedback(kind: "writing" | "speaking", text: string, prompt: string): Promise<Feedback> {
    if (!this.config.languageFeedbackConfigured) return {
      local: true,
      summary: "Self-review: automatic language feedback is not connected.",
      improvements: ["Did you answer every part of the question?", "Give a reason and a specific example.", kind === "writing" ? "Check verb endings, agreement and sentence structure." : "Replay your recording and listen for clear word endings."],
    };
    const result = await this.request<{ feedback: unknown }>("/api/speaking-feedback", {
      method: "POST", body: JSON.stringify({ kind, text, prompt }),
    });
    return feedbackSchema.parse(result.feedback);
  }
}
