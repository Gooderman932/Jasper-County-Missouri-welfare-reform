# Family Rights App

> Android-first case-intelligence app for parents and family-defense advocates navigating child-welfare proceedings, dependency review, and termination of parental rights (TPR).
>
> Built around the **Jasper County, Missouri** welfare-reform context — and seeded with the real, ongoing appellate matter **State ex rel. M.P.G., No. SD38180 (Mo. Ct. App. S.D.)** as Case #1.

---

## What this app is

A clean-architecture Expo / React Native application that lets a parent:

1. **Build a structured case** — parties, attorneys, judges, caseworkers, hearings, timeline events.
2. **Capture evidence** — emails (`.eml`), PDFs, transcripts, photos, audio notes, screenshots. Stored in Appwrite with owner-only document-level security.
3. **Run a pattern-matching engine** that flags possible procedural and substantive concerns worth attorney review — e.g. notice-defects, counsel-no-show, reasonable-efforts gaps, ICPC-blocked-by-pending-charges, AFSA 15-of-22 invocations, address/service defects.
4. **Generate exports** — case-summary markdown + timeline.csv + bundled-document ZIP suitable for handing to counsel, an appellate clerk, or a civil-rights attorney.
5. **Request attorney review** (premium) — sends a structured review packet to an attorney-portal queue.
6. **Coalition-match** (premium, opt-in only) — anonymized pattern fingerprints can be shared with other consenting users to surface jurisdiction-level patterns.

All flags are phrased as **"possible … to review"**. The app NEVER renders a legal conclusion, never replaces counsel, and is not legal advice. See [docs/SECURITY.md](docs/SECURITY.md) for the full disclaimer.

---

## Status

**Pre-production / open code release.** The codebase is feature-complete enough to:

- Run end-to-end in development against a self-hosted Appwrite instance.
- Build an Android `.aab` via EAS for Google Play internal-testing.
- Seed the SD38180 case on first sign-in (3 PDFs + 1 transcript + 76 .eml files = 80 documents, 7 caseworkers, full party list, full timeline, ~12 issue flags).

Outstanding items before a real Play Store release are listed in [docs/ROADMAP.md](docs/ROADMAP.md).

---

## Architecture (TL;DR)

Clean architecture / hexagonal:

```
src/
  domain/        ← entities, repository interfaces, use cases (ZERO SDK imports)
  infra/         ← Appwrite + react-native-iap + OCR + exports + seed adapters
  app/           ← screens, navigation, hooks, theme (React Native)
  shared/        ← constants, types, utils
server/
  functions/     ← Appwrite Functions: verify-purchase, ocr-process, pattern-match, generate-export
admin-portal/    ← Vite + React + TS attorney-review console
scripts/
  provision-appwrite.ts  ← idempotent provisioning (12 collections + 5 buckets)
assets/seed-case-sd38180/  ← seeded appellate-record documents
```

Path aliases: `@app/*`, `@domain/*`, `@infra/*`, `@shared/*` (see `tsconfig.json` and `babel.config.js`).

**Database ID:** `family_rights_main`. Document security is enabled on every collection; the default permission grants only `Permission.read(Role.user(ownerId))` etc. The single exception is `pattern_matches`, which is public-read for coalition matching but holds only anonymized fingerprints.

Full architectural detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Quick start (development)

### Prerequisites

- Node 18+
- Expo CLI (`npm i -g expo`)
- EAS CLI (`npm i -g eas-cli`) — only for Android builds
- A self-hosted Appwrite instance (v1.5+ recommended) with a project created
- A Google Cloud Vision API key (or a different OCR provider — swap the adapter in `src/infra/ocr/`)

### 1. Install

```bash
git clone https://github.com/gooderman932/Jasper-County-Missouri-welfare-reform.git
cd Jasper-County-Missouri-welfare-reform
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Fill in APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY,
# GOOGLE_CLOUD_VISION_API_KEY, etc.
```

Edit `app.json` → `expo.extra.appwriteEndpoint` and `appwriteProjectId` to match your Appwrite project. Leave the `databaseId` as `family_rights_main` unless you have a reason to change it.

### 3. Provision Appwrite

This creates 12 collections and 5 buckets, idempotently. Safe to re-run:

```bash
npm run provision:appwrite
```

### 4. Deploy server functions

Each of these is a standalone Appwrite Function (Node 18):

- `server/functions/verify-purchase/` — Google Play Developer API receipt verification → writes/updates `entitlements`.
- `server/functions/ocr-process/` — runs Google Cloud Vision on a `raw-documents` upload, writes redacted text to `redacted-documents` and an `ocr_results` row.
- `server/functions/pattern-match/` — aggregates a case's issue codes into a `pattern_matches` document (anonymized for coalition matching).
- `server/functions/generate-export/` — assembles `case-summary.md` + `timeline.csv` + the bundled evidence into a ZIP into `generated-exports`.

Deploy each with the Appwrite CLI:

```bash
cd server/functions/verify-purchase && appwrite deploy function
# repeat for the other three
```

Set each function's environment variables to match your project + the keys in `.env`.

### 5. Run the app

```bash
npm start
# then press 'a' for Android emulator or scan the QR with Expo Go
```

On first sign-in, if the signed-in user has **zero cases**, the seed module
`src/infra/seed/sd38180.ts` runs and creates the full SD38180 appellate record
under that user.

### 6. Run the admin portal (optional)

```bash
cd admin-portal
npm install
npm run dev
```

Tabs: attorney_review_requests, exports, ocr_failures, pattern_matches. Restricted to members of `ADMIN_TEAM_ID`.

---

## Building for Google Play

See [docs/PLAY_CONSOLE.md](docs/PLAY_CONSOLE.md) for the full submission walk-through, including:

- Subscription product: `premium_monthly_599` ($5.99/mo)
- Base plan: `monthly-autorenew`
- Introductory offer: `freetrial-1m` (1-month free trial)
- Internal-testing track via `eas submit --platform android`
- Required disclosures (data safety, account deletion URL)

```bash
npm run build:android       # production .aab
npm run submit:android      # uploads to internal track
```

---

## Free vs Premium

| Feature                       | Free                  | Premium ($5.99/mo, 1-mo trial) |
|-------------------------------|-----------------------|-------------------------------|
| Cases                         | 1                     | Unlimited                     |
| Evidence per case             | Unlimited             | Unlimited                     |
| Review modules                | 2 (notice, counsel)   | All (12+)                     |
| OCR                           | —                     | ✓                             |
| Pattern engine                | Read-only summary     | Full flags + recommendations  |
| Exports (PDF/ZIP)             | —                     | ✓                             |
| Attorney review queue         | —                     | ✓                             |
| Coalition matching (opt-in)   | —                     | ✓                             |

Premium gating is implemented via `isPremium(entitlement)` in `src/app/hooks/useApp.tsx`. Entitlements are server-verified via the `verify-purchase` function — the client cannot self-grant premium.

---

## Seeded case (Case #1: SD38180)

This codebase ships with a real, in-progress appellate matter pre-loaded for the repository owner:

- **Cause:** State ex rel. M.P.G., **No. SD38180** (Mo. Ct. App. S.D.) — appeal from juvenile case **No. 22AO-JU00288** (Jasper Co., companion case 22AO-JU00287)
- **Appellant:** Matthew Preston Goodman ("M.P.G."), Baxter Springs, KS
- **Child:** K.C.G. ("Kody," b. 10/13/2018) | **Sibling:** T.R.A. ("Trace")
- **Mother:** B.L.M. ("Dawndee")
- **Trial judge:** Hon. Angela Austin Vorhees (same judge as 2019 paternity decree)
- **TPR trial:** 6/27/2023, 10:03am–3:24pm, Joplin Juvenile Justice Center, transcribed by Sharon K. Rogers / Holliday Reporting (131 pp.)
- **80 seeded documents**: 3 appellate PDFs (Motion for Reconsideration, Order Denying Transfer, Rule 83.04 Notice) + 1 full TPR-hearing transcript + 76 contemporaneous emails (DSS supervisor admissions, NXDOMAIN bounces to MO Courts' published JO complaint inbox, attorney-non-communication chain, ICPC-blocked-by-pending-charges admission, AFSA 15-of-22 invocation, Wolf-Miller-took-prosecutor admission, etc.).

The seed is run on first sign-in when the signed-in user has zero cases (`seedSD38180IfFirstRun`). See `src/infra/seed/sd38180.ts` for the full party list, timeline, issue flags, and document bundle.

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — clean-architecture layout, data model, Appwrite schema, function contracts
- [docs/PLAY_CONSOLE.md](docs/PLAY_CONSOLE.md) — Play Console subscription configuration + submission flow
- [docs/SECURITY.md](docs/SECURITY.md) — data security, owner-only permissions, legal disclaimers, consent gates
- [docs/ROADMAP.md](docs/ROADMAP.md) — known gaps, planned work, and how to contribute

---

## License

The code in this repository is released under the MIT License — see `LICENSE` if present, otherwise treat as MIT.

The **seeded SD38180 case documents** in `assets/seed-case-sd38180/` are the property of the appellant Matthew Preston Goodman and are included for the public-interest purpose of documenting the underlying welfare-reform matter. They are not licensed for redistribution outside the context of this repository.

---

## Disclaimer

**This application is not legal advice.** It is an evidence-organization and pattern-flagging tool. Every flag is phrased as "possible … to review" and is intended to assist a parent in conversation with a licensed attorney. Nothing the app outputs is a legal conclusion. Coalition matching and attorney review are opt-in and require explicit consent.

If you are in an active child-welfare or TPR proceeding, **retain counsel.** This app is not a substitute for a lawyer.
