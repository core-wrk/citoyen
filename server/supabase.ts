import { createClient } from "@supabase/supabase-js";

export function supabaseSettings() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const publicKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const allowedEmails = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return {
    url,
    publicKey,
    allowedEmails,
    ready: Boolean(url && publicKey && allowedEmails.length),
  };
}

export function supabaseClient() {
  const { url, publicKey, ready } = supabaseSettings();
  if (!ready || !url || !publicKey)
    throw new Error("Private sign-in is not configured.");
  return createClient(url, publicKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function getInvitedUser(token: string) {
  const settings = supabaseSettings();
  if (!settings.ready || !token) return null;
  try {
    const { data, error } = await supabaseClient().auth.getUser(token);
    const user = data.user;
    return !error &&
      user &&
      settings.allowedEmails.includes(user.email?.toLowerCase() || "")
      ? user
      : null;
  } catch {
    return null;
  }
}

export function databaseRequest(
  path: string,
  token: string,
  init: RequestInit = {},
) {
  const { url, publicKey } = supabaseSettings();
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: publicKey!,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });
}
