# Roadmap

## What ships in this commit

- ✅ Expo / React Native Android-first scaffold
- ✅ Clean-architecture domain layer with zero SDK coupling
- ✅ Appwrite repositories for 12 collections
- ✅ react-native-iap subscription skeleton with server-verified entitlements
- ✅ Google Cloud Vision OCR adapter
- ✅ Pattern-match engine + 4 server functions
- ✅ Admin portal (Vite + React + TS)
- ✅ Idempotent Appwrite provisioning script
- ✅ EAS configuration for Android production builds
- ✅ Full SD38180 seed (80 documents: 3 PDFs, 1 transcript, 76 .eml)

## Known gaps before a real production release

These are things this codebase deliberately stubs or leaves to deployment-time:

### Critical (do before Play submission)

- [ ] Privacy policy hosting + public URL
- [ ] Account-deletion web flow at a public URL
- [ ] Real Appwrite endpoint baked into `app.json` (currently placeholder)
- [ ] Real Google Cloud Vision API key in deployed function env (not in `.env.example`)
- [ ] Play service-account JSON at `secrets/play-service-account.json`
- [ ] App icon, adaptive icon, splash screen — replace placeholder PNGs in `assets/`
- [ ] Crash reporting (Sentry, Bugsnag, or equivalent)
- [ ] Analytics opt-in (privacy-preserving — e.g. PostHog self-hosted)

### High (do in the first month after launch)

- [ ] Real-time developer notifications (RTDN) handler for Play subscription lifecycle events
- [ ] Server-side OCR retry queue with exponential backoff
- [ ] Export-format expansion: native PDF (currently Markdown + ZIP)
- [ ] Audio transcription via Whisper or equivalent (currently raw audio storage only)
- [ ] Per-jurisdiction issue-code lookup tables (currently single MO-focused list)
- [ ] Attorney portal — read-only sister app for the attorney-review queue (currently just admin portal)

### Medium

- [ ] iOS build profile in `eas.json` and App Store Connect setup
- [ ] Web-app build for parents on desktops (Metro already supports web)
- [ ] Multi-language UI (currently English-only)
- [ ] Coalition-match dashboard view inside the app (currently surfaces only in admin portal)
- [ ] Localizable disclaimer surfaces

### Nice-to-have

- [ ] In-app annotation tool for documents (highlight, redact)
- [ ] Calendar export of timeline events (.ics)
- [ ] Bates-numbering for generated exports
- [ ] LLM-assisted summary of large transcripts (with consent gate)
- [ ] Side-by-side document comparison

## Contributing

This is an open-code repository for the public-interest purpose of documenting the SD38180 matter and the Jasper County welfare-reform context. Pull requests are welcome for:

- New jurisdictions' issue-code dictionaries
- Bug fixes
- Documentation improvements
- Tests (the codebase ships with skeletal jest configuration; coverage is currently low)

Please do **not** submit PRs that:

- Re-phrase issue flags as legal conclusions (see [SECURITY.md](SECURITY.md))
- Add user-identifying data to the `pattern_matches` schema
- Remove the disclaimer surfaces
- Add tracking / analytics that aren't opt-in

## Versioning

- `0.1.x` — pre-Play / dev builds
- `0.2.x` — internal-testing Play track
- `0.3.x` — closed-testing Play track
- `1.0.0` — production Play release

`versionCode` in `app.json` is bumped via `eas build --auto-submit` and EAS's `appVersionSource: "remote"`.

## Long-term direction

Two parallel directions:

1. **The Jasper-County-Missouri-welfare-reform thread** — keep the SD38180 seed and any future appellate / federal filings in `assets/seed-case-sd38180/`, so the repository functions as both an app and a permanent contemporaneous record.
2. **The general family-rights tool** — keep the codebase jurisdiction-agnostic by extracting issue-code tables and consent copy into per-jurisdiction packs in `src/domain/jurisdictions/<state>/`.

These should not conflict — the seed is one user's case, and the engine is general-purpose.
