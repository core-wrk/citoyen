import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { Resend } from "resend";
import { database } from "./database.js";

export function allowedEmails() {
  return (process.env.ALLOWED_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function authReady() {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_URL && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && allowedEmails().length);
}

function createAuth() {
  return betterAuth({
      database: database(),
      baseURL: process.env.BETTER_AUTH_URL,
      secret: process.env.BETTER_AUTH_SECRET,
      disabledPaths: ["/admin/create-user", "/admin/list-users", "/admin/set-role", "/admin/ban-user", "/admin/unban-user", "/admin/impersonate-user", "/admin/stop-impersonating", "/admin/remove-user", "/admin/set-user-password", "/admin/update-user", "/admin/get-user", "/admin/list-user-sessions", "/admin/revoke-user-session", "/admin/revoke-user-sessions"],
      plugins: [admin()],
      hooks: {
        before: createAuthMiddleware(async (context) => {
          if (context.path === "/sign-in/email" && !allowedEmails().includes(String(context.body?.email || "").trim().toLowerCase())) {
            throw new APIError("UNAUTHORIZED", { message: "Email or password was not accepted." });
          }
        }),
      },
      emailAndPassword: {
        enabled: true,
        disableSignUp: true,
        revokeSessionsOnPasswordReset: true,
        async sendResetPassword({ user, url }) {
          const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
            from: process.env.RESEND_FROM_EMAIL!,
            to: user.email,
            subject: "Set your Citoyen password",
            text: `Use this link to set your Citoyen password: ${url}`,
          });
          if (result.error) throw new Error("Password email could not be sent.");
        },
      },
      rateLimit: { enabled: true, storage: "database", window: 60, max: 30, customRules: { "/sign-in/email": { window: 60, max: 5 }, "/request-password-reset": { window: 60, max: 5 } } },
      advanced: { useSecureCookies: process.env.NODE_ENV === "production", ipAddress: { ipAddressHeaders: ["x-citoyen-client-ip"] } },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function auth() {
  if (!authReady()) throw new Error("Private sign-in is not configured.");
  return instance ??= createAuth();
}
