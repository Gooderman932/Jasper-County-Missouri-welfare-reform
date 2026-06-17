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

export const BUCKETS = {
  raw: 'raw-documents',
  redacted: 'redacted-documents',
  audio: 'audio-notes',
  exports: 'generated-exports',
  tempOcr: 'temp-ocr',
} as const;

export const DATABASE = DATABASE_ID;
