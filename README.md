# Citoyen

A private French civic exam, B2 language and naturalisation interview study app for Chrome on Mac and Safari/Chrome on iPhone.

The accepted [architecture decision](docs/architecture-decision.md) uses React/Vite/TypeScript, shared Zod validation, focused API modules, Supabase Auth/PostgreSQL and Vercel. It adopts useful app-template patterns while retaining a small managed backend.

## Start studying locally

Use Node.js 22 or later:

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. Quizzes, listening, reading, writing, local recording/replay and personal browser progress work without cloud credentials. The browser provides French text-to-speech. Transcription and pronunciation assessment require explicit consent for each recording. Uploaded audio can be replayed locally; its transcript can be reviewed for word choice. Cloud pronunciation assessment currently uses live microphone input.

Copy `.env.example` to `.env` if enabling private sync or optional feedback. Keys remain untracked and server-side. The browser receives only the public Supabase URL/key and a temporary Azure token. Writing/transcript feedback sends text to OpenAI when requested. Both AI providers may charge for use. Without keys, the app provides self-review prompts and does not claim to assess pronunciation.

Old personal browser history is preserved under its existing storage key. Cloud accounts use separate browser records. Legacy sessions require signing in again. Personal study history is not automatically imported into an account because that could mix different learners' records. Simultaneous editing on two devices is not supported: the latest saved draft snapshot wins; use one active device at a time.

## Private hosted setup

1. Create a Supabase project and disable public signup. Create only invited accounts in its dashboard; passwords must be set securely by the account owner.
2. Link the Supabase CLI to that project and apply the committed migration in `supabase/migrations` using `supabase db push`. The migration creates private progress storage and the shared monthly request counter. It was applied to the Citoyen project on 16 October 2026.
3. In Vercel, deploy this directory with the checked-in configuration. The build is `npm run build`, the frontend output is `dist`, and API functions stay under `/api` on the same origin.
4. Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (or the legacy `SUPABASE_ANON_KEY`) and `ALLOWED_EMAILS` on the server. The hosted app requires an invited sign-in before study screens open. Supabase's SDK handles session persistence, refresh and sign-out; the API checks the invitation and user identity on each protected request. Learners do not need Vercel accounts.
5. Add `OPENAI_API_KEY` for language feedback, or `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` for live pronunciation assessment. These are optional and never frontend environment variables.

To invite the two brothers-in-law later, create their Supabase accounts and add their emails to `ALLOWED_EMAILS`. Each person has separate attempts and drafts. Each device retains that account's cache after sign-out, but it is not displayed or merged into another account's study history.

SQL migrations belong in source control. Run future schema changes through new migration files rather than editing the deployed database by hand. This version retains the small per-user progress document; structured exercise/attempt tables, subscriptions and stored recordings are deferred until commercialization requires them. Vercel Hobby is for personal/noncommercial use; choose a commercial plan before selling the platform.

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
