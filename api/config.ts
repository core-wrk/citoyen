import { localMode } from "../server/access.js";
import { supabaseSettings } from "../server/supabase.js";
import { send, type ApiRequest, type ApiResponse } from "../server/http.js";
import type { AppConfig } from "../shared/contracts.js";

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET")
    return send(res, 405, { error: "Method not allowed." });
  const settings = supabaseSettings();
  const config: AppConfig = {
    localMode: localMode(),
    authConfigured: settings.ready,
    appReady: localMode() || settings.ready,
    speechConfigured: Boolean(
      process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION,
    ),
    languageFeedbackConfigured: Boolean(process.env.OPENAI_API_KEY),
    monthlyRequestAllowance: 100,
    supabase: settings.ready
      ? { url: settings.url!, publicKey: settings.publicKey! }
      : null,
  };
  send(res, 200, config);
}
