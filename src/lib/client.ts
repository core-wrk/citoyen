import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  feedbackSchema,
  type AppConfig,
  type Feedback,
} from "../../shared/contracts";

export class ApiClient {
  readonly auth: SupabaseClient | null;
  constructor(readonly config: AppConfig) {
    this.auth = config.supabase
      ? createClient(config.supabase.url, config.supabase.publicKey, {
          auth: {
            storageKey: "citoyen.auth.v2",
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        })
      : null;
  }
  async request<T>(
    path: string,
    init: RequestInit = {},
    expectedUserId?: string,
  ): Promise<T> {
    const session = this.auth
      ? (await this.auth.auth.getSession()).data.session
      : null;
    if (expectedUserId && session?.user.id !== expectedUserId)
      throw new Error(
        "Your account changed before this request. Please sign in again.",
      );
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
        ...init.headers,
      },
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload.error || "The request could not be completed.");
    return payload as T;
  }
  async signIn(email: string, password: string) {
    const result = await this.request<{
      accessToken: string;
      refreshToken: string;
    }>("/api/auth", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const { error } = await this.auth!.auth.setSession({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    });
    if (error) throw error;
  }
  async feedback(
    kind: "writing" | "speaking",
    text: string,
    prompt: string,
  ): Promise<Feedback> {
    if (!this.config.languageFeedbackConfigured)
      return {
        local: true,
        summary: "Self-review: automatic language feedback is not connected.",
        improvements: [
          "Did you answer every part of the question?",
          "Give a reason and a specific example.",
          kind === "writing"
            ? "Check verb endings, agreement and sentence structure."
            : "Replay your recording and listen for clear word endings.",
        ],
      };
    const result = await this.request<{ feedback: unknown }>(
      "/api/speaking-feedback",
      { method: "POST", body: JSON.stringify({ kind, text, prompt }) },
    );
    return feedbackSchema.parse(result.feedback);
  }
}
