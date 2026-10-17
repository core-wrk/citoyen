import { signInSchema } from "../shared/contracts.js";
import { supabaseClient, supabaseSettings } from "../server/supabase.js";
import { send, type ApiRequest, type ApiResponse } from "../server/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST")
    return send(res, 405, { error: "Method not allowed." });
  const settings = supabaseSettings();
  if (!settings.ready)
    return send(res, 503, { error: "Private sign-in is not configured." });
  const parsed = signInSchema.safeParse(req.body);
  if (!parsed.success)
    return send(res, 400, {
      error: "Enter a valid email address and password.",
    });
  if (!settings.allowedEmails.includes(parsed.data.email))
    return send(res, 403, {
      error: "This email address has not been invited to the study app.",
    });
  try {
    const { data, error } = await supabaseClient().auth.signInWithPassword(
      parsed.data,
    );
    if (error || !data.session)
      return send(res, 401, { error: "Email or password was not accepted." });
    if (!settings.allowedEmails.includes(data.user?.email?.toLowerCase() || ""))
      return send(res, 403, { error: "This account has not been invited." });
    send(res, 200, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      email: data.user!.email,
    });
  } catch {
    send(res, 502, { error: "Sign-in is temporarily unavailable." });
  }
}
