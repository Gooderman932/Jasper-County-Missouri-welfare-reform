// Appwrite client singletons. The only file that talks to the SDK directly.
import { Client, Account, Databases, Storage, Functions } from 'react-native-appwrite';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

const ENDPOINT = extra.appwriteEndpoint ?? 'https://appwrite.example.com/v1';
const PROJECT_ID = extra.appwriteProjectId ?? '';
const DATABASE_ID = extra.appwriteDatabaseId ?? 'family_rights_main';

if (!PROJECT_ID) {
  // Fail fast in dev — but don't crash in prod if mis-configured; surface error in screens instead.
  // eslint-disable-next-line no-console
  console.warn('[appwrite] missing appwriteProjectId in app.json extra');
}

export const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

export const COLLECTIONS = {
  users_profile: 'users_profile',
  cases: 'cases',
  case_parties: 'case_parties',
  case_events: 'case_events',
  documents: 'documents',
  issue_flags: 'issue_flags',
  pattern_matches: 'pattern_matches',
  coalition_opt_ins: 'coalition_opt_ins',
  entitlements: 'entitlements',
  purchase_records: 'purchase_records',
  exports: 'exports',
  attorney_review_requests: 'attorney_review_requests',
  content_reports: 'content_reports',
} as const;

/** Admin team id for moderation grants (must match the team in Appwrite). */
export const ADMIN_TEAM_ID = extra.appwriteAdminTeamId ?? 'admin';

// Bucket routing.
//
// Free-tier Appwrite Cloud caps storage at exactly 1 bucket per project. To stay
// portable, every logical bucket id below can be overridden via expo extra; on
// free tier they all resolve to the single `raw-documents` bucket. Documents
// already store their bucketId per-row, so a later migration to paid Appwrite
// (where these become 5 physical buckets) is just a config flip + a copy job.
const BUCKET_RAW = extra.appwriteBucketRaw ?? 'raw-documents';
export const BUCKETS = {
  raw: BUCKET_RAW,
  redacted: extra.appwriteBucketRedacted ?? BUCKET_RAW,
  audio: extra.appwriteBucketAudio ?? BUCKET_RAW,
  exports: extra.appwriteBucketExports ?? BUCKET_RAW,
  tempOcr: extra.appwriteBucketTempOcr ?? BUCKET_RAW,
} as const;

export const DATABASE = DATABASE_ID;
