# Private launch review — 16 October 2026

An independent reviewer checked sign-in, account switching, queued progress writes, API authorization, database policies and public configuration. No authentication or account-isolation blocker was found. All 30 existing tests passed.

The Vercel packaging check separately found that compiled API imports lacked the file extensions required by Node. Relative imports in the API and server now use `.js` extensions. `npm run verify` passes, and all five packaged API handlers load with native Node.

One nonblocking issue remains: the progress API rejects snapshots above 200,000 characters, although the data schema permits larger histories. A valid 40-attempt snapshot with long answers exceeded that limit. Such records remain saved in the browser but stop syncing to other devices. Resolve the snapshot size mismatch before extended use with long written answers.

The initial database migration has been applied to Supabase project `eqwbmmsvidbzneheporv`. Anonymous reads of both study tables return HTTP 401, and the hosted Auth settings confirm public signup is disabled. Vercel project `core-wrk/citoyen` has the public connection settings and approved learner email; optional paid-provider keys are absent.

Production deployment is approved but is waiting for confirmation of the GitHub repository. Learner password creation, hosted sign-in, cross-device sync and physical iPhone microphone checks remain unverified.
