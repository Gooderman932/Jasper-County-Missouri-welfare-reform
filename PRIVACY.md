# Privacy Policy

**Effective date:** 2026-06-17
**Operator:** Poor Dude Holdings LLC (Wyoming), through its operating subsidiaries.
**Application:** Family Rights App — case-record keeping for parents navigating child-welfare and termination-of-parental-rights (TPR) proceedings.

> Operator note: this document describes the data practices of the shipped
> application. It must still be reviewed and approved by counsel before
> publication. Items requiring operator/legal confirmation are marked **[verify]**.

## 1. Data we collect

- **Account data:** name, email, hashed password, account creation timestamp.
- **Application data:** case records (case title, jurisdiction, stage), parties (names and roles of family members, caseworkers, attorneys, judges), case timeline events, documents you upload (court filings, correspondence, evaluations) and the text extracted from them via OCR, issue flags generated from your documents, and your coalition-matching opt-in choice.
- **Payment data:** subscriptions are processed by Google Play Billing. We never receive or store card numbers; we store only the Google Play purchase token and the resulting entitlement status used to unlock premium features.
- **Telemetry:** error traces and crash reports (PII is stripped on-device before transmission — see `src/lib/crashReporter.ts`), plus server-side request logs used for fraud prevention and performance debugging.
- **Sensitive categories:** case material in this app can include protected health information (PHI) such as medical, mental-health, and drug-test records. We treat this data as PHI and apply the HIPAA-aligned controls described in Section 8 and `docs/HIPAA_RUNBOOK.md`.

## 2. Why we collect it

- To deliver the contracted service.
- To comply with applicable laws (cottage-food rules, HIPAA, state AI laws, etc.).
- To prevent fraud and abuse.
- To improve the product (telemetry only, never sold).

## 3. How long we keep it

| Category | Retention |
|----------|-----------|
| Account data | While account is active + 30 days after deletion request |
| Payment records | 7 years (IRS / Stripe requirements) |
| Audit logs | 7 years (regulatory minimum) |
| Application data (cases, documents, OCR text, flags) | While account is active; deleted within 30 days of an account-deletion request, subject to the PHI minimum below |
| Generated export bundles | 7 days, then automatically expired |
| PHI (if applicable) | 6 years minimum (HIPAA), deleted on lawful request thereafter |
| Telemetry | 90 days |

## 4. Who we share with

This application uses the following subprocessors. A Business Associate
Agreement (BAA) is required for any subprocessor that may handle PHI and must
be on file before production launch — see `docs/HIPAA_RUNBOOK.md`.

- **Payment processing** — Google Play Billing (subscription purchases). Google does not share card data with us.
- **Cloud / hosting / storage** — Appwrite (database, file storage, and serverless functions). **[verify]** region and BAA.
- **OCR** — Google Cloud Vision API, used to extract text from documents you upload so the app can analyze them. Document bytes are sent to Google Cloud Vision only to perform this extraction. **[verify]** BAA where PHI is involved.

We do **not** sell personal data to advertisers or data brokers, and we do
not use your case data to train third-party AI models.

## 5. Your rights

- **Access** — request a copy of your data.
- **Deletion** — request account deletion (GDPR Art. 17, CCPA).
- **Correction** — request fixes to inaccurate data.
- **Portability** — export your data in JSON.
- **Opt-out** — unsubscribe from marketing emails at any time (one-click in every email).

Submit requests to **privacy@poordudeholdings.com**. We respond within 30 days (CCPA) / 1 month (GDPR).

## 6. Children

We do not knowingly collect data from anyone under 13 (US) / 16 (EU). Contact us if a minor's data was submitted in error and we will delete it.

## 7. International transfers

Data may be processed in the United States. EU/UK users: we rely on the EU-US Data Privacy Framework / UK Extension and standard contractual clauses where required.

## 8. Security

- TLS 1.2+ in transit
- Encryption at rest for sensitive fields (PHI, financial, credentials)
- Role-based access control
- Quarterly secret rotation
- Audit logging of all sensitive operations
- Annual security reviews

Reports: see `SECURITY.md`.

## 9. Changes

We post the "Effective date" at the top of this document. Material changes are announced via email to active account holders 30 days before they take effect.

## 10. Contact

Poor Dude Holdings LLC
Wyoming, USA
privacy@poordudeholdings.com
