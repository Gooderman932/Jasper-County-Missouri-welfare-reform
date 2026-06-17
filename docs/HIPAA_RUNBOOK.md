# HIPAA Runbook — Family Rights App

Operational checklist for HIPAA / state-equivalent compliance.

## Before production deploy

- [ ] Confirm Appwrite project region is in the United States (Missouri-compliant). Document region in this file.
- [ ] Sign Business Associate Agreement (BAA) with Appwrite Cloud (or self-host).
- [ ] Sign BAA with any subprocessors (Resend / Twilio if used).
- [ ] Set `APPWRITE_ENCRYPTION_KEY` to a 32-byte random secret in Appwrite Console → Settings.
- [ ] Provision the `audit_log` collection per `server/schemas/audit_log.sql` permissions table.
- [ ] Enable forced HTTPS on every domain serving the app.
- [ ] Verify Resend DMARC/SPF on the sending domain.

## Every release

- [ ] Run `npm test` — must pass, no `--passWithNoTests` reliance in security-critical modules.
- [ ] Run `npm audit --production` and triage any high/critical.
- [ ] Review `audit_log` write coverage: any new PHI-touching endpoint must call `logAudit()`.

## Quarterly

- [ ] Rotate `APPWRITE_API_KEY`, `APPWRITE_ENCRYPTION_KEY`, Google Play service-account key.
- [ ] Risk assessment per HIPAA §164.308(a)(1)(ii)(A).
- [ ] Review user access list and prune inactive accounts.
- [ ] Test backup restoration (Appwrite functions + DB export).
- [ ] Validate breach-notification plan with attorney of record.

## Incident response

1. Contain — disable the affected key in Appwrite; rotate.
2. Preserve — copy the `audit_log` window before the incident.
3. Notify — affected individuals within 60 days of discovery.
4. Document — incident report into `docs/incidents/YYYY-MM-DD-summary.md`.

## Region & subprocessor record

| Service | Region | BAA on file? | Last verified |
|---------|--------|--------------|---------------|
| Appwrite | _TBD_ | _TBD_ | _TBD_ |
| Google Play Billing | US | N/A (consumer billing) | 2026-06-17 |
| Resend (transactional email) | US | _TBD_ | _TBD_ |
