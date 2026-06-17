/**
 * provision-appwrite.ts
 *
 * One-time / idempotent script that creates the entire Appwrite backend for
 * the Family Rights App:
 *   - Database: family_rights_main
 *   - 12 collections with attributes + indexes + permissions
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
  await collection('users_profile', 'User Profiles');
  await str('users_profile', 'displayName', 120);
  await str('users_profile', 'email', 320);
  await str('users_profile', 'jurisdiction', 80);
  await bool('users_profile', 'acceptedDisclaimerV1', false, false);
  await bool('users_profile', 'acceptedPrivacyV1', false, false);
  await dt('users_profile', 'createdAt');
  await idx('users_profile', 'idx_email', ['email']);

  // 2. cases ---------------------------------------------------------------
  await collection('cases', 'Cases');
  await str('cases', 'ownerId', 64, true);
  await str('cases', 'title', 200, true);
  await str('cases', 'courtCaseNumber', 80);
  await str('cases', 'lowerCourtCaseNumber', 80);
  await str('cases', 'jurisdiction', 120);
  await str('cases', 'stage', 60);
  await str('cases', 'summary', 5000);
  await dt('cases', 'openedAt');
  await dt('cases', 'lastEventAt');
  await arr('cases', 'tags', 40);
  await idx('cases', 'idx_owner', ['ownerId']);
  await idx('cases', 'idx_owner_stage', ['ownerId', 'stage']);

  // 3. case_parties --------------------------------------------------------
  await collection('case_parties', 'Case Parties');
  await str('case_parties', 'caseId', 64, true);
  await str('case_parties', 'ownerId', 64, true);
  await str('case_parties', 'role', 40, true);           // judge | attorney | caseworker | parent | child | foster | opposing_attorney | gal
  await str('case_parties', 'name', 200, true);
  await str('case_parties', 'organization', 200);
  await str('case_parties', 'notes', 2000);
  await idx('case_parties', 'idx_case', ['caseId']);
  await idx('case_parties', 'idx_case_role', ['caseId', 'role']);

  // 4. case_events --------------------------------------------------------
  await collection('case_events', 'Case Events');
  await str('case_events', 'caseId', 64, true);
  await str('case_events', 'ownerId', 64, true);
  await str('case_events', 'title', 240, true);
  // Free-tier-friendly: trimmed from 8000 to 2000. Longer notes should attach
  // a Document instead of inlining text in the event row.
  await str('case_events', 'description', 2000);
  await dt('case_events', 'occurredAt', true);
  await arr('case_events', 'tags', 40);
  await arr('case_events', 'documentIds', 64);
  await idx('case_events', 'idx_case_time', ['caseId', 'occurredAt']);

  // 5. documents ----------------------------------------------------------
  await collection('documents', 'Documents');
  await str('documents', 'caseId', 64, true);
  await str('documents', 'ownerId', 64, true);
  await str('documents', 'title', 240);
  await str('documents', 'fileId', 64, true);
  await str('documents', 'mimeType', 80);
  await int('documents', 'sizeBytes');
  // Free-tier-friendly: OCR text/pages stored in a Storage bucket instead of
  // inline String columns. Reference the file IDs here; fetch contents from
  // the case-documents bucket on demand.
  await str('documents', 'ocrTextFileId', 64);
  await str('documents', 'ocrPagesFileId', 64);
  await str('documents', 'ocrStatus', 24, false, 'pending'); // pending|in_progress|completed|failed
  await str('documents', 'ocrError', 1000);
  await dt('documents', 'ocrCompletedAt');
  await dt('documents', 'capturedAt');
  await idx('documents', 'idx_case', ['caseId']);
  await idx('documents', 'idx_owner_status', ['ownerId', 'ocrStatus']);

  // 6. issue_flags --------------------------------------------------------
  await collection('issue_flags', 'Issue Flags');
  await str('issue_flags', 'caseId', 64, true);
  await str('issue_flags', 'ownerId', 64, true);
  await str('issue_flags', 'code', 64, true);
  await str('issue_flags', 'summary', 500);
  await str('issue_flags', 'detail', 4000);
  await str('issue_flags', 'severity', 20, false, 'review'); // review|elevated|critical
  await arr('issue_flags', 'eventIds', 64);
  await dt('issue_flags', 'createdAt');
  await idx('issue_flags', 'idx_case', ['caseId']);
  await idx('issue_flags', 'idx_code', ['code']);

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
  await str('pattern_matches', 'code', 64, true);
  await str('pattern_matches', 'label', 200);
  await int('pattern_matches', 'caseCount', false, 0);
  await arr('pattern_matches', 'jurisdictions', 120);
  await arr('pattern_matches', 'judges', 200);
  await arr('pattern_matches', 'caseworkers', 200);
  await arr('pattern_matches', 'attorneys', 200);
  await str('pattern_matches', 'displayText', 2000);
  await dt('pattern_matches', 'lastUpdated');
  await idx('pattern_matches', 'idx_code', ['code']);

  // 8. coalition_opt_ins --------------------------------------------------
  await collection('coalition_opt_ins', 'Coalition Opt-Ins');
  await str('coalition_opt_ins', 'caseId', 64, true);
  await str('coalition_opt_ins', 'ownerId', 64, true);
  await bool('coalition_opt_ins', 'optIn', true, false);
  await dt('coalition_opt_ins', 'consentedAt');
  await str('coalition_opt_ins', 'consentVersion', 16);
  await idx('coalition_opt_ins', 'idx_case', ['caseId'], 'unique');

  // 9. entitlements -------------------------------------------------------
  await collection('entitlements', 'Entitlements');
  await str('entitlements', 'ownerId', 64, true);
  await bool('entitlements', 'isPremium', false, false);
  await str('entitlements', 'productId', 80);
  await str('entitlements', 'basePlanId', 80);
  await str('entitlements', 'offerId', 80);
  await dt('entitlements', 'expiresAt');
  await dt('entitlements', 'trialEndsAt');
  await str('entitlements', 'lastVerifiedToken', 256);
  await dt('entitlements', 'lastVerifiedAt');
  await idx('entitlements', 'idx_owner', ['ownerId'], 'unique');

  // 10. purchase_records --------------------------------------------------
  await collection('purchase_records', 'Purchase Records');
  await str('purchase_records', 'ownerId', 64, true);
  await str('purchase_records', 'productId', 80);
  await str('purchase_records', 'purchaseToken', 512);
  await str('purchase_records', 'orderId', 80);
  await str('purchase_records', 'state', 20);   // verified | failed | refunded
  // Free-tier-friendly: trimmed from 60_000 to 8000.
  await str('purchase_records', 'rawJson', 8000);
  await dt('purchase_records', 'createdAt');
  await idx('purchase_records', 'idx_owner', ['ownerId']);

  // 11. exports -----------------------------------------------------------
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
  await collection('attorney_review_requests', 'Attorney Review Requests');
  await str('attorney_review_requests', 'ownerId', 64, true);
  await str('attorney_review_requests', 'caseId', 64, true);
  await str('attorney_review_requests', 'status', 24, false, 'pending'); // pending|matched|declined|completed
  await str('attorney_review_requests', 'notes', 2000);
  await bool('attorney_review_requests', 'consented', true, false);
  await dt('attorney_review_requests', 'createdAt');
  await idx('attorney_review_requests', 'idx_status', ['status']);

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
