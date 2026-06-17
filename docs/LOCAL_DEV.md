# Local Development

This document covers running the Family Rights App locally for testing and
review — without needing Appwrite, an Android device, or Google Play Billing.

## Quick Start (Expo Web + in-memory SD38180 seed)

The fastest way to see the app: a browser-only build that auto-seeds the
SD38180 case data into in-memory repos. No backend, no auth flow.

```bash
cd family-rights-app
npm install                  # one-time
cp .env.local.example .env.local
npm run web:local            # http://localhost:8081
```

What you should see:

- App boots directly as "Local Dev User" — no sign-in screen.
- Home tab shows: 1 case (SD38180), 45 timeline events, 22 issue flags
  (11 serious / 10 watch / 1 info), all phrased as
  **possible … to review** findings.
- Documents bundled via `require(...)` won't actually upload on Web
  (this is expected — Expo Web doesn't pull native asset URIs); the seed
  loop catches and warns. Events and flags still seed cleanly.
- Refresh wipes the in-memory state and re-seeds on next boot.

## Environment flags

| Variable | Default | Effect |
| --- | --- | --- |
| `EXPO_PUBLIC_USE_MEMORY_REPOS` | unset | When `true`, the DI container returns in-memory repos and `App.tsx` auto-seeds SD38180 on first boot. Set in `.env.local`. |

## Other local entrypoints

```bash
# Generate the draft case-summary export (no app boot needed):
npm run summary:draft
# -> exports/case-summary-sd38180-DRAFT.md

# Run the typecheck (CI's first job):
npm run typecheck

# Run ESLint (CI's second job):
npm run lint
```

## Architecture notes for local mode

- `src/infra/seed/sd38180-data.ts` — pure-data module (no React Native
  imports). Both the seed and the case-summary script read from here.
- `src/infra/seed/sd38180.ts` — the on-device seeder. Calls the repo
  interfaces only — works against either Appwrite or in-memory repos.
- `src/infra/memory/index.ts` — in-memory implementations of every
  repository in the domain. Used only when the env flag is true.
- `src/app/hooks/useContainer.ts` — switches between Appwrite-backed and
  memory-backed adapters based on the env flag.

## What local mode does NOT cover

- **In-app purchases / Google Play Billing** — Web has no IAP. Use a dev
  build on an Android device when iterating on billing.
- **OCR / pattern-match cloud functions** — those live in Appwrite. Local
  mode returns empty results.
- **Real document uploads** — `Asset.fromModule` for `.eml` / `.pdf` assets
  doesn't resolve usefully on Web; the seeder catches and warns. The
  documents in `assets/seed-case-sd38180/` are still bundled as exhibits
  for the on-device build path.
- **Push notifications** — Expo Web doesn't get them; reminders are
  stored in memory only.

## Cleaning up

```bash
# Hard reset (kill any stuck Metro / Expo processes):
pkill -f "expo start" ; pkill -f metro

# Nuke caches if Metro misbehaves:
rm -rf .expo node_modules/.cache
```
