# Implement the accepted architecture

## Goal

Make the existing study app maintainable and ready for private multi-device use using React/Vite/TypeScript, shared validation, Supabase and Vercel. The architecture decision is approved; implementation proceeds within that scope.

## Changes

1. Record the accepted architecture and create the React/Vite/TypeScript build.
2. Preserve the curriculum and study rules; move each practice into a focused React component.
3. Move recording and playback into a lifecycle-aware module that stops streams when the learner changes exercises.
4. Use Supabase's session library, require invited sign-in in the hosted app, and isolate browser progress by account.
5. Share validated data contracts across browser and API; isolate provider calls and add ordered SQL migrations.
6. Test study rules, malformed requests, account isolation, and microphone cleanup; run `npm run verify` and inspect desktop/mobile layouts.
7. Continue approved hosting only after checks pass and account access is available; record any external setup or physical-device checks still needed.

## Done when

`npm run verify` passes. A production build contains all seven study screens. Account switching cannot copy one user's records to another. Navigating away from recording stops its media tracks. Hosted unauthenticated users see sign-in rather than personal study screens. Cloud credentials are absent from source and frontend bundles except the intentionally public Supabase URL/key.

## Risks

Replacing UI state can affect timers or audio cleanup; targeted tests cover both. Provider-backed sign-in and physical iPhone microphone behavior require external setup and device verification; local mocks do not prove those outcomes.

## Implementation results

The React frontend, shared contracts, SDK session handling, account-specific caches, focused API modules and initial SQL migration are implemented. Existing curriculum and study modes are retained. Automated checks cover account isolation, malformed requests, mock deadlines and recording teardown. Desktop and 390-pixel layouts were inspected in the app browser with no horizontal overflow.

On 16 October 2026, both provider command-line tools were authenticated, Supabase project `eqwbmmsvidbzneheporv` was linked, and Vercel project `core-wrk/citoyen` was created. Production has the public Supabase connection settings and the approved learner email `andrew@corewrk.com`; optional paid-provider keys were not configured. Public Supabase signup is disabled. The initial migration was applied; anonymous study-table reads are rejected. Independent authentication review found no blockers. API import paths were corrected after testing Vercel's packaged output. See [launch review](launch-review.md) for checks and a nonblocking progress-size issue. Deployment awaits GitHub repository confirmation. Hosted sign-in, cross-device sync and physical iPhone audio remain unverified.
