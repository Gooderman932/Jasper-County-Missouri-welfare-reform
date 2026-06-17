# Architecture

## Layering

```
┌──────────────────────────────────────────────────────────────┐
│ src/app/        — React Native UI                            │
│   screens / navigation / hooks / theme / components          │
│   (depends on: domain use cases via dependency injection)    │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ src/domain/     — pure TypeScript, zero SDK imports          │
│   entities / value-objects / repositories (interfaces)       │
│   usecases / services                                        │
└──────────────────────────────────────────────────────────────┘
                            ▲
                            │  (interfaces implemented by)
                            │
┌──────────────────────────────────────────────────────────────┐
│ src/infra/      — adapters                                   │
│   appwrite/    Appwrite repositories + mappers + permissions │
│   billing/     react-native-iap adapter                      │
│   ocr/         Google Vision adapter                         │
│   exports/     ZIP / PDF / Markdown generators               │
│   notifications/  expo-notifications adapter                 │
│   storage/     SecureStore-backed key/value                  │
│   pattern/     pattern-match client                          │
│   seed/        SD38180 first-run seeder                      │
└──────────────────────────────────────────────────────────────┘
```

The **domain** layer has no `import` of `appwrite`, `expo-*`, `react-native`, or any SDK. It is unit-testable in pure Node. The **infra** layer is the only place SDKs appear. The **app** layer wires it all together via the `useApp()` hook.

Path aliases (configured in `tsconfig.json` and `babel.config.js`):

| Alias       | Path                          |
|-------------|-------------------------------|
| `@app/*`    | `src/app/*`                   |
| `@domain/*` | `src/domain/*`                |
| `@infra/*`  | `src/infra/*`                 |
| `@shared/*` | `src/shared/*`                |
| `@assets/*` | `assets/*` (Metro asset alias)|

## Data model

### Collections (database `family_rights_main`)

| Collection                  | Owner-scoped? | Notes                                          |
|-----------------------------|---------------|------------------------------------------------|
| `users`                     | yes           | Display name, locale, pinned cases             |
| `cases`                     | yes           | Title, jurisdiction, status, lower-court no.   |
| `parties`                   | yes (via case)| Role (parent, child, attorney, judge, …)       |
| `events`                    | yes (via case)| Timeline events with `at`, `type`, `desc`      |
| `documents`                 | yes (via case)| Storage refs to `raw-documents` bucket         |
| `ocr_results`               | yes (via case)| Per-document OCR text + provider              |
| `issue_flags`               | yes (via case)| Issue code, summary, explanation, sourceRefs   |
| `entitlements`              | yes           | Premium state, source = `play_billing`         |
| `attorney_review_requests`  | yes + admin   | Reviewable by `ADMIN_TEAM_ID` only             |
| `exports`                   | yes           | Generated-export metadata                      |
| `pattern_matches`           | **public-read** | Holds ONLY anonymized fingerprints           |
| `audit_log`                 | admin-only    | Append-only                                    |

Document-level security is on for every collection. The default permission for owner-scoped collections is:
```
Permission.read(Role.user(ownerId)),
Permission.update(Role.user(ownerId)),
Permission.delete(Role.user(ownerId)),
```

### Buckets

| Bucket                | Purpose                                       |
|-----------------------|-----------------------------------------------|
| `raw-documents`       | Original uploads (.eml, PDF, images, audio)   |
| `redacted-documents`  | OCR'd / redacted derivatives                  |
| `audio-notes`         | Voice memos                                   |
| `generated-exports`   | Output ZIPs and PDFs                          |
| `temp-ocr`            | Short-lived OCR-pipeline artifacts            |

## Server functions

Each function is an isolated Node 18 Appwrite Function with its own `package.json`.

### `verify-purchase`
- **Trigger:** client-side after `react-native-iap` returns a successful purchase
- **Input:** `{ userId, productId, purchaseToken }`
- **Action:** calls the Google Play Developer API `subscriptionsv2.get` → verifies receipt → upserts the `entitlements` row → returns the verified entitlement
- **Why server-side:** prevents the client from self-granting premium

### `ocr-process`
- **Trigger:** any new file in `raw-documents`
- **Input:** `{ fileId, userId, caseId }`
- **Action:** downloads file → calls Google Vision (or a swapped adapter) → writes plaintext to `redacted-documents` → writes an `ocr_results` row → updates the corresponding `documents` row's `hasOcr=true`
- **Failure mode:** writes an `audit_log` row + surfaces in the admin portal's `ocr_failures` tab

### `pattern-match`
- **Trigger:** invoked by the client after issue flags are computed for a case
- **Input:** `{ caseId, issueCodes: string[], jurisdiction: string }`
- **Action:** computes a stable hash from `(jurisdiction, sorted issueCodes)` and **upserts** an anonymized `pattern_matches` row — increments `count` and appends to `recentJurisdictions[]` (capped). No user-identifying data is written.
- **Consent gate:** only invoked when the user has explicitly opted into coalition matching

### `generate-export`
- **Trigger:** client request
- **Input:** `{ caseId, userId }`
- **Action:** loads the case + parties + events + documents → assembles `case-summary.md` + `timeline.csv` → ZIPs the bundled evidence from `raw-documents` → uploads the ZIP to `generated-exports` → writes an `exports` row → returns the file ID
- **Includes:** every seed document (PDFs + transcript + emails)

## Premium gating

`isPremium(entitlement)` is the single source of truth:
```ts
export function isPremium(e?: Entitlement): boolean {
  if (!e) return false;
  if (e.source !== 'play_billing') return false;
  if (e.status !== 'active' && e.status !== 'in_grace_period') return false;
  return new Date(e.expiresAt) > new Date();
}
```

All gated screens consult `useApp().isPremium`. The free tier surfaces an upsell sheet rather than a hard block, so the user always sees *what* premium would unlock for their case.

## Seeding

`seedSD38180IfFirstRun(deps)` runs from the post-sign-in hook in `useApp.tsx` when the signed-in user has zero cases. It creates:

- 1 case
- 1 child + 1 sibling + 1 mother + 1 appellant party
- 6+ attorneys/court personnel + 7 caseworkers
- ~25 timeline events
- ~12 issue flags (all phrased "possible … to review")
- 80 documents wired via Metro `require()` from `assets/seed-case-sd38180/`

Re-running is safe: the seeder checks for an existing case with the same lower-court number before inserting.

## Pattern engine — flag-phrasing rules

Every issue flag MUST be phrased as a question or possibility, not a conclusion. Examples from the SD38180 seed:

> ✓ "Possible address/service defect — notice mailed to non-existent address"
> ✓ "Counsel non-communication pattern worth attorney review"
> ✗ "DSS violated due process" ← NEVER

The reasoning is in [docs/SECURITY.md](SECURITY.md) under the *Legal-tool guardrails* section.

## Admin portal

A standalone Vite + React + TypeScript app under `admin-portal/`. Tabs:

- **Attorney Review Requests** — queue of premium-user review submissions, with case-summary preview and the ability to assign/close.
- **Exports** — every generated export with download links and a 30-day expiry indicator.
- **OCR Failures** — items in `audit_log` where the `ocr-process` function errored.
- **Pattern Matches** — anonymized coalition matches, jurisdiction × issue-code matrix.

Authentication is via Appwrite Teams membership — only members of `ADMIN_TEAM_ID` can sign in.
