# Security, Privacy & Legal Guardrails

## Threat model

Users of this app are typically parents in an active child-welfare or TPR proceeding. The data they upload — emails, court orders, transcripts, child information — is:

- Personally identifying
- Often subject to juvenile-court confidentiality rules
- Of high adversarial interest (opposing counsel, agency staff, the court)
- Sometimes containing minors' identifying information

The app therefore treats every document as **owner-confidential** by default, with the single carefully-scoped exception of anonymized coalition fingerprints.

## Data-at-rest

All collections and buckets live in a self-hosted **Appwrite v1.5+** instance. Document-level security is enabled. The default permission set for any new owner-scoped row is:

```ts
[
  Permission.read(Role.user(ownerId)),
  Permission.update(Role.user(ownerId)),
  Permission.delete(Role.user(ownerId)),
]
```

There is no "all-users" or "any" read on any user document, ever. The only public-read collection is `pattern_matches`, which stores:

- A hash of `(jurisdiction, sortedIssueCodes)`
- A `count` integer
- A capped list of `recentJurisdictions` (state-level only, e.g. "MO")

No userIds, caseIds, document text, names, dates, or other re-identifying data is ever written there.

## Data-in-transit

- All Appwrite traffic uses TLS via the configured endpoint
- All Google Cloud Vision calls use TLS
- All Google Play Developer API calls (from `verify-purchase`) use TLS
- The mobile client uses `expo-secure-store` to hold the Appwrite session JWT

## Storage of secrets

- `.env` is **gitignored**
- `secrets/play-service-account.json` is **gitignored**
- `google-services.json`, `GoogleService-Info.plist`, `.keystore` files are **gitignored**
- The Appwrite API key with full server permissions is used only by `scripts/provision-appwrite.ts` and the server functions — never shipped in the app bundle

## Consent gates (must be re-affirmed; not buried in T&C)

| Action                          | Consent required                                 |
|---------------------------------|--------------------------------------------------|
| OCR a document                  | "Allow this document to be sent to a third-party OCR provider for text extraction?" |
| Attorney-review submission      | "Allow this case summary and selected documents to be shared with the attorney review team?" |
| Coalition matching              | "Allow an anonymized fingerprint of this case's issue codes to be added to the public pattern-matches index?" — explicit explanation of what is and is NOT shared |

Each consent is recorded as an `audit_log` row with timestamp, userId, action, and consented payload.

## Account deletion

Required by Google Play policy AND ethically required for this app's user base.

- In-app: Settings → Delete Account → re-auth → server purges all rows + files for that owner
- Web: hosted `/account/delete` flow performs the same purge
- After deletion, **pattern_matches** entries derived from the user's cases remain in aggregate (they were anonymized at write time) — this is disclosed in the privacy policy

## Legal-tool guardrails

The app NEVER outputs a legal conclusion. This is enforced both as a policy rule and as a code-review rule.

### Required phrasing

| ✗ Forbidden phrasing                       | ✓ Required phrasing                                       |
|--------------------------------------------|-----------------------------------------------------------|
| "DSS violated due process"                 | "Possible due-process concern worth attorney review"      |
| "The court erred"                          | "Possible procedural issue identified — discuss with counsel" |
| "You have a §1983 claim"                   | "Pattern includes elements an attorney may want to evaluate for a possible civil-rights claim" |
| "Reverse and remand"                       | "Outcome unknown; this evidence may be relevant on appeal" |

Every `issue_flag.summary` and `issue_flag.explanation` field is phrased this way. The seed module follows this rule explicitly.

### Disclaimer surfaces

The disclaimer text appears in at least these locations:

1. The onboarding screen, before first sign-in
2. The premium upsell screen, before purchase
3. The export footer of every generated case-summary.md
4. The attorney-review submission flow, before send
5. The README and Play Store listing

### Not a substitute for counsel

The app actively suggests retaining counsel:

- On first sign-in
- Each time a new high-severity flag is generated
- In every generated export

The premium "attorney review queue" routes to a third-party attorney panel — the app itself does not provide legal advice.

## Sensitive-content handling

### Children's identifying information

The seed and any user-created case use initials (e.g., "K.C.G.", "T.R.A.") in display strings wherever possible. Full names are stored only in the underlying party records, not in derived/display strings.

### Audio recordings

Audio notes go to the `audio-notes` bucket with owner-only permissions. The app's `expo-av` recorder requires explicit microphone consent on each session.

### Photos

The `expo-camera` and `expo-image-picker` flows ask for permission each time. Photos go to `raw-documents` with owner-only permissions and are never tagged with metadata beyond `caseId` and `uploadedAt`.

## Incident-response posture

For a self-hosted Appwrite instance:

1. Rotate the Appwrite API key
2. Revoke any compromised session JWTs via Appwrite Console
3. Inspect `audit_log` for the relevant time window
4. Notify affected users in-app and (if applicable) by email
5. File a breach notification under applicable state law if user PII was exposed

## Disclaimer (verbatim)

> **This application is not legal advice.** It is an evidence-organization and pattern-flagging tool designed to help parents and family-defense advocates prepare for conversations with licensed counsel. Every flag is phrased as a possibility worth attorney review and not as a legal conclusion. Nothing the app outputs — including exports, attorney-review packets, and coalition matches — replaces the judgment of a licensed attorney.
>
> If you are in an active child-welfare, dependency, or termination-of-parental-rights proceeding, **retain counsel.** This app is not a substitute for a lawyer.
