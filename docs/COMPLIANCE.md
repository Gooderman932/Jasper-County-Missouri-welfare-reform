# Compliance Checklist — Jasper-County / Family Rights App

Tracks remediation status from the 2026-06-17 cross-portfolio audit. Domain: **case-management for dependency / TPR proceedings; PHI-adjacent + child-welfare data; HIPAA + state-equivalent privacy law**.

| Item | Status | Notes |
|------|--------|-------|
| Encryption at rest | runbook | `APPWRITE_ENCRYPTION_KEY` documented in `.env.example` and `docs/HIPAA_RUNBOOK.md` |
| Audit-log table | scaffolded | `server/schemas/audit_log.sql` template ready; deploy via `scripts/provision-appwrite.ts` follow-up |
| RBAC enforcement | scaffolded | `src/lib/authz.ts` helper added; every mutation must call `assertCanWrite(user, resource)` |
| Region: Missouri-compliant | runbook | confirm Appwrite project region in deployment runbook |
| Data retention policy | done | 3-year post-closure archival rule documented in `DATA_RETENTION.md` |
| PII masking (SSN last-4, phone last-4) | scaffolded | helper in `src/lib/pii.ts` |
| Stripe / Play Billing webhook signature verification | done | `server/functions/verify-purchase` calls Google Play API directly (not webhook); RevenueCat-style webhooks N/A |
| Reconciliation cron (entitlements ↔ Google Play) | follow-up | tracked as separate issue |
| Terms of Service / Privacy Policy | done | `PRIVACY.md` shipped |
| HIPAA Business Associate Agreement (BAA) | runbook | confirm BAA with Appwrite Cloud + Google Play |
| Session timeout 30 min | scaffolded | `src/lib/sessionTimeout.ts` constants + helper added |
| Dependabot | done | `.github/dependabot.yml` |
| CI gate (jest + tsc + secret scan) | done | `.github/workflows/ci.yml` upgraded |
| `SECURITY.md` | done | 48h SLA documented |

## Required environment variables

| Var | Purpose |
|-----|---------|
| `APPWRITE_ENDPOINT` | Appwrite project URL |
| `APPWRITE_PROJECT_ID` | Project identifier |
| `APPWRITE_API_KEY` | Server admin key (server-only, never client) |
| `APPWRITE_ENCRYPTION_KEY` | At-rest encryption key (HIPAA control) |
| `GOOGLE_PLAY_PACKAGE_NAME` | App identifier |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_B64` | Subscription verification |
| `EXPO_PUBLIC_APPWRITE_ENDPOINT` | Client endpoint |
| `EXPO_PUBLIC_APPWRITE_PROJECT_ID` | Client project id |

## HIPAA-specific obligations (active)

1. **Audit log every PHI access.** `audit_log` table is append-only; insert before returning data on any read of `case_records`, `issue_flags`, `documents`. Use `src/lib/audit.ts` helper.
2. **Role check before mutation.** Every Appwrite mutation must call `assertCanWrite(user, resource)`. The helper enforces `assignedAttorneyId` matching and admin override.
3. **Session timeout 30 min.** App resets auth on background→foreground after 30 minutes of inactivity.
4. **No SSN in plaintext.** `maskSSN()` and `maskPhone()` from `src/lib/pii.ts` are required for any UI display; raw values only in encrypted blob fields.
5. **Encryption at rest.** Confirm `APPWRITE_ENCRYPTION_KEY` is set in production console; if not available natively, use the app-level encryption helper in `src/lib/crypto.ts`.
6. **Data retention.** Cases closed >3 years are archived by `subscription-sweep` scheduled function (extend it; tracked as follow-up).
