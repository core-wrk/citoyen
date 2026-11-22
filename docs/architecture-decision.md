# Architecture decision for the Citoyen migration

The target stack is selected. The [migration plan](stack-migration-plan.md) is pending implementation. The [October implementation record](implementation-plan.md) describes the current Supabase and Vercel setup.

Citoyen is a private study app for civic quizzes, listening and reading, written and spoken answers, optional automated feedback, and progress across Mac and iPhone browsers.

## Decision

Keep React, Vite, TypeScript, and shared validation for saved data and API requests. Run the Node server on Render at its default HTTPS address. Serve the frontend and API on the same origin so the browser can use the same-site Better Auth session cookie on desktop and iPhone. [Render web services](https://render.com/docs/web-services) · [Better Auth security](https://better-auth.com/docs/reference/security)

Better Auth manages invited accounts and email-and-password sessions. Resend delivers password setup and recovery mail from `corewrk.com`. Neon Postgres stores Better Auth tables, study progress, and monthly request usage. The Node server checks the session and invitation before protected operations and uses the session’s user ID for progress queries. Database credentials stay on the server, and ordered SQL migrations live in this repository. [Better Auth PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql) · [Resend sender domains](https://resend.com/docs/dashboard/domains/introduction)

## Launch state

Render starts with a fresh Neon database and newly provisioned learner accounts. Browser storage belongs to the site address where it was saved, so existing browser copies remain on their original sites. Learners start with empty progress on Render. Public signup stays disabled and local personal study remains available without cloud credentials.

## Boundaries

Raw recordings stay in the browser unless a learner explicitly opts into Azure speech assessment. The API supplies a temporary Azure token, and requested text feedback still goes to OpenAI. Payments, subscriptions, stored recordings, background jobs, and commercial admin tools are outside the migration scope.
