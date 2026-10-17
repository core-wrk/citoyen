# Architecture decision: structured app with a managed backend

Status: accepted by Andrew on 14 October 2026.

Citoyen starts as a private study app for Andrew, then two relatives. It may become a paid French exam preparation platform. The immediate requirements are civic quizzes, listening and reading, written and spoken answers, optional automated feedback, and private progress across Mac and iPhone browsers.

## Decision

Use React, Vite and TypeScript for the frontend. Use shared validation for saved study data and API requests, and keep API handlers small with provider code in focused server modules. Retain Supabase Auth and PostgreSQL for invited accounts and private progress, and Vercel for the static frontend and short API requests. Keep the API under the frontend's origin. Keep SQL changes as ordered, versioned migrations in this repository.

Learners sign in to Citoyen; they do not need hosting-provider accounts. Public signup is disabled for the private version. Server authorization and database row policies protect each learner's records. Hosted study screens require sign-in. Local personal study remains available without cloud credentials.

## Reasons

Managed authentication and PostgreSQL cover the current data and account requirements while reducing service maintenance. The existing audio flow streams directly from the browser to Azure after consent; the API supplies a temporary token, rather than keeping a server running for the recording. Text feedback and progress requests also fit short API calls.

React components and TypeScript provide useful boundaries for the existing interactive study modes. Shared validation and migrations improve correctness as the curriculum and saved data evolve. These advantages do not require moving authentication to Better Auth, the database to Neon, or the API to a persistent Render server.

## Alternatives and tradeoffs

The local app-template's full React/Vite + Hono + Better Auth + Drizzle/Neon + Cloudflare Pages/Render stack offers stronger infrastructure portability and consistent tooling across Core Wrk products. It also adds a separately operated API and authentication implementation. Its separate default frontend/API domains require a shared domain or proxy for cookie-based sign-in on Safari. Those costs are not justified by this app's current requirements.

Supabase-specific authentication and row policies make a future backend migration more involved. Provider calls will stay in focused modules. Vercel is a practical hosting choice, not a requirement imposed by React or Supabase. Paid commercial hosting and appropriate availability tiers will be selected before selling the product.

## Boundaries

Raw recordings remain in the page unless the learner explicitly opts into speech assessment. Payments, subscriptions, stored recordings, background processing, commercial admin tools and generalized storage adapters are deferred until requested. Reconsider the backend when measured workload requires long-running jobs, authentication ownership, or a demonstrated hosting constraint.

## Acceptance

All existing study modes work. Accounts cannot merge another account's local history. Invited users can sign in, sign out and recover progress on another device. Recording controls release the microphone on navigation. `npm run verify` runs real TypeScript checks, tests and a production frontend build. Physical iPhone audio and hosted authentication remain required checks before launch.
