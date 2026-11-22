# Citoyen

A private French civic exam, B2 language and naturalisation interview study app for Chrome on Mac and Safari/Chrome on iPhone.

Citoyen uses React, Vite, TypeScript, shared Zod validation, and a Node API. The [architecture decision](docs/architecture-decision.md) and [migration plan](docs/stack-migration-plan.md) describe the move to Neon, Render, Resend, and Better Auth. This checkout uses the new services. Deployment to Render remains pending.

## Start studying locally

Use Node.js 22 or later:

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. Quizzes, listening, reading, writing, local recording/replay and personal browser progress work without cloud credentials. The browser provides French text-to-speech. Transcription and pronunciation assessment require explicit consent for each recording. Uploaded audio can be replayed locally; its transcript can be reviewed for word choice. Cloud pronunciation assessment currently uses live microphone input.

Copy `.env.example` to `.env` if enabling private sync or optional feedback. Keep secret keys untracked and server-side. The browser receives a temporary Azure token when pronunciation assessment is requested. Writing and transcript feedback sends text to OpenAI when requested. Both AI providers may charge for use. Without feedback keys, the app provides self-review prompts.

Old personal browser history is preserved under its existing storage key. Cloud accounts use separate browser records. Legacy sessions require signing in again. Personal study history is not automatically imported into an account because that could mix different learners' records. Simultaneous editing on two devices is not supported: the latest saved draft snapshot wins; use one active device at a time.

## Private hosting on Render

The application and migration commands are implemented. Production setup and deployment remain pending.

1. Create a fresh Neon Postgres database. Run `npm run db:migrate` with `DATABASE_URL` set to the direct Neon connection string before opening the app to learners. Set the web service's `DATABASE_URL` to its pooled Neon connection string. [Neon connection guide](https://neon.com/docs/connect/connect-from-any-app)
2. Set up one Render Node web service for both the frontend and API. Use `npm ci && npm run build`, with `npm start` serving `dist` and `/api` on the same address. The service binds to `0.0.0.0` using Render’s `PORT`. Use `/health` for the health check and the default HTTPS `onrender.com` address. [Render web service setup](https://render.com/docs/web-services)
3. Set `BETTER_AUTH_URL` to that HTTPS address. Keep `BETTER_AUTH_SECRET` and `ALLOWED_EMAILS` in the server environment. Add approved learner emails to `ALLOWED_EMAILS`, then run `npm run invite -- learner@example.com` in an environment with the same database and email settings. The command creates an account if needed and sends a password setup link. Public signup is disabled. Learners sign in with email and password. [Better Auth setup](https://better-auth.com/docs/installation)
4. Verify `corewrk.com` in Resend. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Render, with `citoyen@corewrk.com` as the proposed sender for password setup and recovery. [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
5. Optionally add `OPENAI_API_KEY` for language feedback or `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` for live pronunciation assessment. Keep all provider keys server-side.

Use a separate Neon role named `citoyen_app` for the web service. After creating the role and applying the migrations as the database owner, run the following as the owner. Keep the owner connection for migrations and use the new role's pooled connection for Render and the invitation command.

```sql
GRANT USAGE ON SCHEMA public TO citoyen_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "user", "session", account, verification, "rateLimit" TO citoyen_app;
GRANT SELECT, INSERT, UPDATE ON study_progress, ai_monthly_usage TO citoyen_app;
```

Apply any grants needed by future migrations before starting the updated service.

Invite learners again on the Render app. Their hosted attempts and drafts start empty, and old browser records stay on their original sites and devices. Each account has separate study history and browser cache.

Keep future SQL changes in versioned migration files. The migration retains the existing per-user progress document.

The app limits paid feedback and pronunciation sessions together to 100 requests per calendar month across invited accounts. This is a request allowance, not a guaranteed provider bill cap. Set provider-side budgets separately. Local usage is kept in the ignored `.local-usage.json` file.

## Study material and privacy

The timed civic mock follows the official format: 28 knowledge questions and 12 situation questions, with the knowledge questions selected by the official theme counts. The 40 knowledge prompts available for practice follow the Ministry of the Interior’s [public naturalisation question list](https://www.immigration.interieur.gouv.fr/documentation/guides-textes-et-brochures/questions-de-connaissance-pour-lexamen-civique-nationalite-francaise.html). You can also practise the 12 situation examples separately and review each explanation immediately. All answer choices and explanations are study aids, not an official answer key. The situation prompts are original because the official situation questions are not published. See the [official exam rules](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052381620) and [Ministry naturalisation page](https://www.immigration.interieur.gouv.fr/devenir-francais/procedures-dacces-a-nationalite-francaise) for the current requirements.

Listening audio is generated on your device by its French text-to-speech voice. Raw recordings stay in the browser tab and are discarded when you leave the exercise. If you enable cloud assessment, transcripts and answer text are sent to the configured provider for feedback and are saved to your private progress record. Review OpenAI and Microsoft retention terms before enabling those services.

## Checks and readiness

```sh
npm run verify
```

This runs real TypeScript checking, study/API tests, React behavior and audio lifecycle tests, and a production Vite build. A local production build can be served using `npm start`, which requires hosted authentication configuration.

Mocked tests do not prove hosted account setup or physical iPhone microphone behavior. Before launch, check invited sign-in/sign-out, cross-device progress, record/replay, French playback and consented pronunciation assessment on the actual Mac and iPhone. Browser permissions and audio codecs vary.
