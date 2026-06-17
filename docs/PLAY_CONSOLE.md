# Google Play Console — Setup & Submission

## 1. Create the app

- **Name:** Family Rights
- **Package name:** `com.poordudeholdings.familyrights`
- **Default language:** English (US)
- **App or game:** App
- **Free or paid:** Free (with in-app purchases)

## 2. App content declarations

- **Privacy policy URL:** required. Host the privacy policy that covers:
  - Account creation via Appwrite
  - Document uploads (camera, files) stored in user-owned Appwrite buckets
  - Optional OCR processing via Google Cloud Vision
  - Optional coalition matching (opt-in, anonymized)
  - Premium subscription purchase data
- **Account deletion URL:** required (Play policy). The app must offer in-app deletion **and** a web URL that initiates deletion. Implement at `/account/delete` on a marketing site or via Appwrite Console membership.
- **Data safety form:** declare collection of: account ID, document uploads, audio recordings, purchase history. Mark each as "encrypted in transit" and "user can request deletion."
- **Content rating:** complete IARC questionnaire — likely **Everyone** (no violent/sexual content). Note: the app handles sensitive court matters but does not render any of that content publicly.
- **Target audience:** 18+ (parents and family-defense advocates). NOT designed for children.
- **News app declaration:** No.
- **COVID-19 contact tracing:** No.
- **Government app:** No.

## 3. Subscription product

Set up under **Monetize → Products → Subscriptions**.

| Field                 | Value                       |
|-----------------------|-----------------------------|
| Product ID            | `premium_monthly_599`       |
| Name                  | Family Rights Premium       |
| Description           | Unlimited cases, OCR, pattern engine, exports, attorney review queue, and coalition matching. |
| Status                | Active                      |

### Base plan

| Field                | Value                  |
|----------------------|------------------------|
| Base plan ID         | `monthly-autorenew`    |
| Billing period       | 1 month                |
| Auto-renewing        | Yes                    |
| Grace period         | 7 days                 |
| Account hold         | Enabled                |
| Resubscribe          | Enabled                |
| Price                | $5.99 USD              |

### Introductory offer (free trial)

| Field            | Value             |
|------------------|-------------------|
| Offer ID         | `freetrial-1m`    |
| Type             | Free trial        |
| Duration         | 1 month           |
| Eligibility      | New subscribers   |

These three IDs are referenced from `.env`, `app.json` (`expo.extra.premium*`), and `server/functions/verify-purchase/`.

## 4. Build + upload

```bash
# from repo root
npm run build:android    # produces production .aab via EAS
npm run submit:android   # uploads to internal-testing track as draft
```

EAS configuration in `eas.json` already points the production submit to:
- `serviceAccountKeyPath`: `./secrets/play-service-account.json`
- `track`: `internal`
- `releaseStatus`: `draft`

Put your Play service-account JSON at `secrets/play-service-account.json`. The `secrets/` folder is gitignored.

## 5. Real-time developer notifications (RTDN)

For robust subscription state, configure RTDN:

1. Create a Pub/Sub topic `play-rtdn-familyrights`
2. Grant the Play account publisher access
3. Subscribe an HTTPS endpoint that calls the `verify-purchase` function (or a sibling function `rtdn-handler`) to update `entitlements` rows on cancel / expire / refund / renew

## 6. Testing flow

1. Add testers to the **Internal testing** track
2. Add their Google accounts to the **License testing** allowlist (under Setup → License testing) so they can purchase without being billed
3. Testers install via the opt-in URL
4. App boots → seed runs → user can exercise free tier
5. Tester taps "Go Premium" → react-native-iap purchase flow → `verify-purchase` function writes the entitlement → app reflects premium state

## 7. Required disclosures inside the app

Required by Play policy for subscription apps. The app surfaces these in `src/app/screens/premium/PremiumScreen.tsx`:

- Price and billing period
- Free-trial length and what happens at trial end
- That the subscription auto-renews
- That it can be canceled in Play Store settings
- Link to Terms and Privacy Policy

## 8. Going to closed / open testing → production

- Closed testing requires ≥12 testers for ≥14 days (Play policy for new personal-developer accounts)
- Open testing is a public opt-in list
- Production review takes ~7–14 days first time. Subsequent updates are faster.

## 9. Account deletion (Play policy)

Implement BOTH:

- **In-app:** Settings → Delete account → calls a server function that purges the user's Appwrite document rows, storage files, and entitlement. Confirm with re-authentication.
- **Web:** A public URL (`https://…/account/delete`) that performs the same flow without requiring app install. Submit this URL in the Play Console under App Content → Account deletion.

## 10. Pre-launch checklist

- [ ] Privacy policy live and linked
- [ ] Account-deletion URL live and linked
- [ ] Data-safety form completed
- [ ] Subscription product + base plan + free-trial offer all Active
- [ ] Internal-testing build uploaded and self-tested
- [ ] License testers configured
- [ ] RTDN endpoint live (or planned post-launch)
- [ ] App icon + feature graphic + 2+ screenshots uploaded
- [ ] Crash-free rate >99% in pre-launch report
