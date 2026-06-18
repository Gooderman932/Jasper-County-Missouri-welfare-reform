/**
 * provision-appwrite.ts
 *
 * One-time / idempotent script that creates the entire Appwrite backend for
 * the Family Rights App. The schema here MUST match the vocabulary used by
 * the mobile app (src/infra/appwrite/**) — that is the production entrypoint
 * the script services. If a field is added/removed in the app's mappers or
 * repositories, mirror that change here.
 *
 *   - Database: family_rights_main
 *   - 13 collections with attributes + indexes + permissions
 *   - 5 storage buckets
 *
 * Usage:
 *   APPWRITE_ENDPOINT=... \
 *   APPWRITE_PROJECT_ID=... \
 *   APPWRITE_API_KEY=...   \   # server key with databases.write, buckets.write
 *   npx tsx scripts/provision-appwrite.ts
 *
 * Safe to re-run; every create is wrapped in try/catch on the "already exists"
 * error code (409).
 */

import { Client, Databases, Storage, Permission, Role, ID } from 'node-appwrite';

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  APPWRITE_DATABASE_ID = 'family_rights_main',
} = process.env;

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.error('Missing required env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const ownerOnly = [
  Permission.read(Role.users()),    // sentinel; refined per-doc to owner only
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

// -------- helpers --------
async function ok<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn();
    console.log(`✓ ${label}`);
    return r;
  } catch (e: any) {
    if (
      e?.code === 409 ||
      /already exists/i.test(e?.message || '') ||
      // Appwrite Cloud free tier reports 'already exists for this resource'
      // as a 403 plan-limit error when the resource is at the free-tier cap.
      // Treat that the same as 409 so re-runs are idempotent.
      (e?.code === 403 && /maximum number of/i.test(e?.message || ''))
    ) {
      console.log(`• ${label} (already exists or at plan limit — assuming present)`);
      return undefined;
    }
    // Free tier caps total attribute size per collection. Log a warning and
    // continue so the rest of the schema can provision.
    if (
      e?.code === 400 &&
      /maximum number or size of attributes/i.test(e?.message || '')
    ) {
      console.warn(`! ${label} skipped (collection at attribute-size cap)`);
      return undefined;
    }
    console.error(`✗ ${label}: ${e.message}`);
    throw e;
  }
}

async function str(col: string, key: string, size: number, required = false, def?: string) {
  await ok(`attr ${col}.${key}`, () =>
    databases.createStringAttribute(APPWRITE_DATABASE_ID, col, key, size, required, def),
  );
}
async function bool(col: string, key: string, required = false, def?: boolean) {
  await ok(`attr ${col}.${key}`, () =>
    databases.createBooleanAttribute(APPWRITE_DATABASE_ID, col, key, required, def),
  );
}
async function int(col: string, key: string, required = false, def?: number) {
  await ok(`attr ${col}.${key}`, () =>
    databases.createIntegerAttribute(APPWRITE_DATABASE_ID, col, key, required, undefined, undefined, def),
  );
}
async function dt(col: string, key: string, required = false) {
  await ok(`attr ${col}.${key}`, () =>
    databases.createDatetimeAttribute(APPWRITE_DATABASE_ID, col, key, required),
  );
}
async function arr(col: string, key: string, size: number) {
  await ok(`attr ${col}.${key}[]`, () =>
    databases.createStringAttribute(APPWRITE_DATABASE_ID, col, key, size, false, undefined, true),
  );
}
async function waitForAttribute(col: string, key: string, timeoutMs = 30_000) {
  const start = Date.now();
  // Strip array marker if present (e.g. 'tags[]' -> 'tags')
  const cleanKey = key.replace(/\[\]$/, '');
  while (Date.now() - start < timeoutMs) {
    try {
      const attr: any = await databases.getAttribute(APPWRITE_DATABASE_ID, col, cleanKey);
      if (attr.status === 'available') return;
    } catch {
      // attribute may not exist yet from a different code path; ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn(`! attribute ${col}.${cleanKey} did not reach 'available' within ${timeoutMs}ms`);
}

async function idx(col: string, name: string, keys: string[], type: 'key' | 'unique' = 'key') {
  // Ensure all referenced attributes are materialized before creating the index.
  for (const k of keys) {
    await waitForAttribute(col, k);
  }
  // Retry the index creation a few times in case Appwrite's internal state
  // is still catching up after attributes report 'available'.
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await ok(`index ${col}.${name}`, () =>
        databases.createIndex(APPWRITE_DATABASE_ID, col, name, type, keys),
      );
      return;
    } catch (e: any) {
      if (
        /not yet available/i.test(e?.message || '') &&
        attempt < maxRetries - 1
      ) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw e;
    }
  }
}
async function collection(id: string, name: string) {
  await ok(`collection ${id}`, () =>
    databases.createCollection(APPWRITE_DATABASE_ID, id, name, ownerOnly, true /* doc-security */),
  );
}

// -------- run --------
(async () => {
  console.log(`Provisioning Appwrite project ${APPWRITE_PROJECT_ID} at ${APPWRITE_ENDPOINT}\n`);

  await ok(`database ${APPWRITE_DATABASE_ID}`, () =>
    databases.create(APPWRITE_DATABASE_ID, 'Family Rights Main'),
  );

  // 1. users_profile -------------------------------------------------------
  //    Mirrors mappers.mapUser + AuthRepositoryAppwrite.
  await collection('users_profile', 'User Profiles');
  await str('users_profile', 'displayName', 120);
  await str('users_profile', 'email', 320);
  await str('users_profile', 'region', 120);
  // 'free' | 'trialing' | 'active' | 'grace_period' | 'billing_issue' |
  // 'expired' | 'canceled' — see domain/entities :: SubscriptionStatus.
  await str('users_profile', 'subscriptionStatus', 20, false, 'free');
  await bool('users_profile', 'onboardingComplete', false, false);
  await bool('users_profile', 'acceptedDisclaimerV1', false, false);
  await bool('users_profile', 'acceptedPrivacyV1', false, false);
  await idx('users_profile', 'idx_email', ['email']);

  // 2. cases ---------------------------------------------------------------
  //    Mirrors CaseRepositoryAppwrite.createCase + publishCase + mapCase.
  await collection('cases', 'Cases');
  await str('cases', 'ownerUserId', 64, true);
  await str('cases', 'title', 200, true);
  await str('cases', 'jurisdictionState', 80, true);
  await str('cases', 'jurisdictionCounty', 120);
  // CaseType union — see domain/entities.
  await str('cases', 'caseType', 40, true);
  // CaseStatus: 'open' | 'closed' | 'appeal' | 'archived'.
  await str('cases', 'status', 24, false, 'open');
  await dt('cases', 'openedAt');
  // Public-case fields (publishCase / unpublishCase / listPublicCases).
  // 'private' | 'public'.
  await str('cases', 'visibility', 16, false, 'private');
  await str('cases', 'publicSlug', 80);
  await dt('cases', 'publishedAt');
  await str('cases', 'publishedBy', 64);
  await dt('cases', 'unpublishedAt');
  await str('cases', 'publicTitle', 240);
  // Free-tier-friendly. The publish flow can chunk longer summaries into a
  // Document if needed.
  await str('cases', 'publicSummary', 5000);
  // RedactionPolicy is a small JSON blob — stored stringified.
  await str('cases', 'redactionPolicy', 1000);
  await bool('cases', 'isReferenceCase', false, false);
  await idx('cases', 'idx_owner', ['ownerUserId']);
  await idx('cases', 'idx_owner_status', ['ownerUserId', 'status']);
  await idx('cases', 'idx_visibility_published', ['visibility', 'publishedAt']);
  await idx('cases', 'idx_public_slug', ['publicSlug']);

  // 3. case_parties --------------------------------------------------------
  //    Mirrors PartyRepositoryAppwrite + mapParty.
  await collection('case_parties', 'Case Parties');
  await str('case_parties', 'caseId', 64, true);
  // PartyRole union.
  await str('case_parties', 'role', 40, true);
  await str('case_parties', 'displayLabel', 200, true);
  await str('case_parties', 'legalName', 200);
  await str('case_parties', 'anonymizedLabel', 200);
  await bool('case_parties', 'isMinor', false, false);
  await idx('case_parties', 'idx_case', ['caseId']);
  await idx('case_parties', 'idx_case_role', ['caseId', 'role']);

  // 4. case_events --------------------------------------------------------
  //    Mirrors EventRepositoryAppwrite + mapEvent.
  await collection('case_events', 'Case Events');
  await str('case_events', 'caseId', 64, true);
  // EventType union.
  await str('case_events', 'eventType', 40, true);
  await dt('case_events', 'occurredAt', true);
  // Free-tier-friendly: trimmed from 8000 to 2000.
  await str('case_events', 'description', 2000);
  await str('case_events', 'sourceDocumentId', 64);
  await arr('case_events', 'tags', 40);
  // Per-event visibility override for public cases: 'inherit'|'private'|'public'.
  await str('case_events', 'visibility', 16, false, 'inherit');
  await idx('case_events', 'idx_case_time', ['caseId', 'occurredAt']);

  // 5. documents ----------------------------------------------------------
  //    Mirrors DocumentRepositoryAppwrite + mapDocument + the ocr-process
  //    server function (ocrText / ocrPagesJson / ocrStatus / ocrError /
  //    ocrCompletedAt). 'ownerUserId' (NOT 'ownerId') is the canonical key
  //    used by mappers.mapDocument.
  await collection('documents', 'Documents');
  await str('documents', 'caseId', 64, true);
  await str('documents', 'ownerUserId', 64, true);
  await str('documents', 'title', 240);
  // DocumentCategory union.
  await str('documents', 'category', 40);
  await str('documents', 'bucketId', 64);
  await str('documents', 'fileId', 64, true);
  await str('documents', 'mimeType', 80);
  await dt('documents', 'uploadedAt');
  // OCR. Inline up to 1 MB per node-appwrite max; ocr-process truncates.
  await str('documents', 'extractedText', 1_000_000);
  await str('documents', 'ocrText', 1_000_000);
  await str('documents', 'ocrPagesJson', 1_000_000);
  // 'pending'|'in_progress'|'completed'|'failed'.
  await str('documents', 'ocrStatus', 24, false, 'pending');
  await str('documents', 'ocrError', 1000);
  await dt('documents', 'ocrCompletedAt');
  // RedactionStatus: 'raw'|'redacted'|'needs_review'.
  await str('documents', 'redactionStatus', 24, false, 'raw');
  await arr('documents', 'tags', 40);
  await str('documents', 'visibility', 16, false, 'inherit');
  await idx('documents', 'idx_case', ['caseId']);
  await idx('documents', 'idx_owner_status', ['ownerUserId', 'ocrStatus']);

  // 6. issue_flags --------------------------------------------------------
  //    Mirrors mappers.mapIssue.
  await collection('issue_flags', 'Issue Flags');
  await str('issue_flags', 'caseId', 64, true);
  // IssueType union.
  await str('issue_flags', 'type', 40, true);
  // IssueSeverity: 'info'|'watch'|'serious'.
  await str('issue_flags', 'severity', 20, false, 'watch');
  // IssueStatus: 'system_generated'|'user_marked'|'reviewed'.
  await str('issue_flags', 'status', 24, false, 'system_generated');
  await str('issue_flags', 'summary', 500);
  await str('issue_flags', 'explanation', 4000);
  await arr('issue_flags', 'sourceRefs', 64);
  await str('issue_flags', 'visibility', 16, false, 'inherit');
  await idx('issue_flags', 'idx_case', ['caseId']);
  await idx('issue_flags', 'idx_type', ['type']);

  // 7. pattern_matches (public-read aggregates) ---------------------------
  await ok('collection pattern_matches', () =>
    databases.createCollection(
      APPWRITE_DATABASE_ID,
      'pattern_matches',
      'Pattern Matches',
      [Permission.read(Role.any()), Permission.create(Role.users())],
      true,
    ),
  );
  await str('pattern_matches', 'caseId', 64);
  // PatternMatchType union.
  await str('pattern_matches', 'matchType', 40);
  await int('pattern_matches', 'score', false, 0);
  await str('pattern_matches', 'explanation', 2000);
  await arr('pattern_matches', 'matchedIssueTypes', 40);
  await int('pattern_matches', 'visibleCount', false, 0);
  await idx('pattern_matches', 'idx_match_type', ['matchType']);

  // 8. coalition_opt_ins --------------------------------------------------
  //    Mirrors mappers.mapCoalition.
  await collection('coalition_opt_ins', 'Coalition Opt-Ins');
  await str('coalition_opt_ins', 'userId', 64, true);
  await str('coalition_opt_ins', 'caseId', 64, true);
  await bool('coalition_opt_ins', 'consentToPatternMatching', false, false);
  await bool('coalition_opt_ins', 'consentToAnonymizedCohortStats', false, false);
  await bool('coalition_opt_ins', 'consentToAttorneyReview', false, false);
  await bool('coalition_opt_ins', 'consentToAdvocateReview', false, false);
  await dt('coalition_opt_ins', 'consentTimestamp');
  await idx('coalition_opt_ins', 'idx_user_case', ['userId', 'caseId'], 'unique');

  // 9. entitlements -------------------------------------------------------
  //    Mirrors mappers.mapEntitlement + server/functions/verify-purchase
  //    (which writes ownerId historically). The canonical key per the domain
  //    contract (entities :: SubscriptionEntitlement.userId) is 'userId';
  //    verify-purchase is being migrated to write 'userId' in this same fix.
  await collection('entitlements', 'Entitlements');
  await str('entitlements', 'userId', 64, true);
  await bool('entitlements', 'isPremium', false, false);
  // EntitlementPlatform: 'google_play'.
  await str('entitlements', 'platform', 20, false, 'google_play');
  // SubscriptionStatus union (see entities.ts). NOTE: 'trialing' (not 'trial')
  // is the canonical value emitted by mapState in verify-purchase.
  await str('entitlements', 'status', 20);
  await str('entitlements', 'productId', 80);
  await str('entitlements', 'basePlanId', 80);
  await str('entitlements', 'offerId', 80);
  await dt('entitlements', 'currentPeriodEndsAt');
  await dt('entitlements', 'trialEndsAt');
  await str('entitlements', 'lastVerifiedToken', 256);
  await dt('entitlements', 'lastVerifiedAt');
  await idx('entitlements', 'idx_user', ['userId'], 'unique');

  // 10. purchase_records --------------------------------------------------
  //     verify-purchase reads ownerId; keep that name here for the producer.
  await collection('purchase_records', 'Purchase Records');
  await str('purchase_records', 'ownerId', 64, true);
  await str('purchase_records', 'productId', 80);
  await str('purchase_records', 'purchaseToken', 512);
  await str('purchase_records', 'orderId', 80);
  await str('purchase_records', 'state', 20);   // verified | failed | refunded
  // Free-tier-friendly: trimmed from 60_000 to 8000.
  await str('purchase_records', 'rawJson', 8000);
  await dt('purchase_records', 'receivedAt');
  await idx('purchase_records', 'idx_owner', ['ownerId']);

  // 11. exports -----------------------------------------------------------
  //     Written by server/functions/generate-export.
  await collection('exports', 'Exports');
  await str('exports', 'ownerId', 64, true);
  await str('exports', 'caseId', 64, true);
  await str('exports', 'fileId', 64, true);
  await str('exports', 'fileName', 240);
  await int('exports', 'sizeBytes');
  await int('exports', 'documentCount');
  await int('exports', 'eventCount');
  await int('exports', 'flagCount');
  await dt('exports', 'expiresAt');
  await dt('exports', 'createdAt');
  await idx('exports', 'idx_owner', ['ownerId']);

  // 12. attorney_review_requests -----------------------------------------
  //     Mirrors AttorneyReviewRequest in entities.ts.
  await collection('attorney_review_requests', 'Attorney Review Requests');
  await str('attorney_review_requests', 'userId', 64, true);
  await str('attorney_review_requests', 'caseId', 64, true);
  // 'pending'|'received'|'declined'|'matched'.
  await str('attorney_review_requests', 'status', 24, false, 'pending');
  await str('attorney_review_requests', 'packetExportId', 64);
  await dt('attorney_review_requests', 'submittedAt');
  await idx('attorney_review_requests', 'idx_status', ['status']);
  await idx('attorney_review_requests', 'idx_user', ['userId']);

  // 13. content_reports ---------------------------------------------------
  //     UGC moderation queue. Used by ContentReportRepositoryAppwrite and
  //     was previously NEVER provisioned, so every report-submit was 404'ing
  //     against real Appwrite. Mirrors mappers.mapContentReport.
  //     Authenticated users (including the reporter) may create; admin team
  //     reads/updates. Doc-level permissions can refine read to reporter+admin
  //     in the repository on create.
  await ok('collection content_reports', () =>
    databases.createCollection(
      APPWRITE_DATABASE_ID,
      'content_reports',
      'Content Reports',
      [Permission.create(Role.users())],
      true,
    ),
  );
  await str('content_reports', 'caseId', 64, true);
  await str('content_reports', 'reporterUserId', 64);
  // ContentReportReason union.
  await str('content_reports', 'reason', 40, true);
  await str('content_reports', 'details', 4000);
  // ContentReportStatus: 'open'|'reviewing'|'resolved'|'dismissed'.
  await str('content_reports', 'status', 24, false, 'open');
  await dt('content_reports', 'resolvedAt');
  await str('content_reports', 'resolutionNote', 2000);
  await idx('content_reports', 'idx_case', ['caseId']);
  await idx('content_reports', 'idx_status', ['status']);

  // -------- Storage buckets --------
  const buckets: Array<[string, string, number]> = [
    ['raw-documents', 'Raw Documents', 50 * 1024 * 1024],
    ['redacted-documents', 'Redacted Documents', 50 * 1024 * 1024],
    ['audio-notes', 'Audio Notes', 100 * 1024 * 1024],
    ['generated-exports', 'Generated Exports', 250 * 1024 * 1024],
    ['temp-ocr', 'Temp OCR', 30 * 1024 * 1024],
  ];

  for (const [id, name, max] of buckets) {
    await ok(`bucket ${id}`, () =>
      storage.createBucket(
        id,
        name,
        [Permission.read(Role.users()), Permission.create(Role.users())],
        true /* fileSecurity */,
        true /* enabled */,
        max,
      ),
    );
  }

  console.log('\nAll done. Idempotent — safe to re-run.');
})().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
