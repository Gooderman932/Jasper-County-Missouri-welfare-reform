// Appwrite Function: delete-account
// Runtime: Node 18
//
// Purges ALL data owned by the authenticated caller:
//   • Every document in ownerUserId-indexed collections
//   • Every document in caseId-indexed collections linked to the user's cases
//   • Every storage file in raw-documents bucket uploaded by the user
//   • The Appwrite user account itself
//
// Security: must be called from a valid user session (not an API key).
// The user's identity comes from req.headers['x-appwrite-user-id'] which
// Appwrite injects from the validated session JWT — cannot be spoofed.
//
// Env vars required (set in Appwrite Console → Functions → delete-account):
//   APPWRITE_FUNCTION_PROJECT_ID   (auto-injected by Appwrite)
//   APPWRITE_API_KEY               admin key — needed to delete the Appwrite account
//   APPWRITE_ENDPOINT              e.g. https://cloud.appwrite.io/v1
//   APPWRITE_DATABASE_ID           (default: family_rights_main)
//   APPWRITE_BUCKET_RAW            (default: raw-documents)

const sdk = require('node-appwrite');

const COLLECTIONS_BY_OWNER = [
  'cases',
  'documents',
  'exports',
  'entitlements',
  'purchase_records',
  'attorney_review_requests',
  'coalition_opt_ins',
  'content_reports',
  'users_profile',
];

// Collections that are keyed by caseId (no ownerUserId), deleted after cases are listed.
const COLLECTIONS_BY_CASE = [
  'case_parties',
  'case_events',
  'issue_flags',
  'pattern_matches',
];

async function deleteAllByOwner(databases, db, collection, field, value, log) {
  let deleted = 0;
  let lastId = null;
  while (true) {
    const queries = [sdk.Query.equal(field, value), sdk.Query.limit(100)];
    if (lastId) queries.push(sdk.Query.cursorAfter(lastId));
    const page = await databases.listDocuments(db, collection, queries);
    if (!page.documents.length) break;
    for (const doc of page.documents) {
      await databases.deleteDocument(db, collection, doc.$id);
      deleted++;
    }
    if (page.documents.length < 100) break;
    lastId = page.documents[page.documents.length - 1].$id;
  }
  log(`Deleted ${deleted} docs from ${collection}`);
  return deleted;
}

async function deleteAllByCaseIds(databases, db, collection, caseIds, log) {
  if (!caseIds.length) return;
  let deleted = 0;
  // Appwrite Query.equal supports arrays for IN queries.
  const chunks = [];
  for (let i = 0; i < caseIds.length; i += 25) chunks.push(caseIds.slice(i, i + 25));
  for (const chunk of chunks) {
    let lastId = null;
    while (true) {
      const queries = [sdk.Query.equal('caseId', chunk), sdk.Query.limit(100)];
      if (lastId) queries.push(sdk.Query.cursorAfter(lastId));
      const page = await databases.listDocuments(db, collection, queries);
      if (!page.documents.length) break;
      for (const doc of page.documents) {
        await databases.deleteDocument(db, collection, doc.$id);
        deleted++;
      }
      if (page.documents.length < 100) break;
      lastId = page.documents[page.documents.length - 1].$id;
    }
  }
  log(`Deleted ${deleted} docs from ${collection}`);
}

module.exports = async ({ req, res, log, error }) => {
  const userId = req.headers['x-appwrite-user-id'];
  if (!userId) {
    error('Unauthenticated — missing x-appwrite-user-id header');
    return res.json({ ok: false, error: 'unauthenticated' }, 401);
  }

  const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? 'https://cloud.appwrite.io/v1';
  const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const API_KEY = process.env.APPWRITE_API_KEY;
  const DB = process.env.APPWRITE_DATABASE_ID ?? 'family_rights_main';
  const BUCKET = process.env.APPWRITE_BUCKET_RAW ?? 'raw-documents';

  const client = new sdk.Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new sdk.Databases(client);
  const storage = new sdk.Storage(client);
  const users = new sdk.Users(client);

  try {
    // 1. Collect case IDs before deleting cases (needed for child-collection purge).
    const caseIds = [];
    {
      let lastId = null;
      while (true) {
        const q = [sdk.Query.equal('ownerUserId', userId), sdk.Query.limit(100), sdk.Query.select(['$id'])];
        if (lastId) q.push(sdk.Query.cursorAfter(lastId));
        const page = await databases.listDocuments(DB, 'cases', q);
        for (const doc of page.documents) caseIds.push(doc.$id);
        if (page.documents.length < 100) break;
        lastId = page.documents[page.documents.length - 1].$id;
      }
    }
    log(`Found ${caseIds.length} cases to delete`);

    // 2. Collect storage file refs from documents before deleting them.
    const fileRefs = [];
    {
      let lastId = null;
      while (true) {
        const q = [sdk.Query.equal('ownerUserId', userId), sdk.Query.limit(100), sdk.Query.select(['$id', 'bucketId', 'fileId'])];
        if (lastId) q.push(sdk.Query.cursorAfter(lastId));
        const page = await databases.listDocuments(DB, 'documents', q);
        for (const doc of page.documents) fileRefs.push({ bucketId: doc.bucketId, fileId: doc.fileId });
        if (page.documents.length < 100) break;
        lastId = page.documents[page.documents.length - 1].$id;
      }
    }

    // 3. Delete owner-indexed collections.
    for (const col of COLLECTIONS_BY_OWNER) {
      const field = col === 'entitlements' || col === 'purchase_records' ? 'userId' : 'ownerUserId';
      try {
        await deleteAllByOwner(databases, DB, col, field, userId, log);
      } catch (e) {
        error(`Error purging ${col}: ${e.message}`);
      }
    }

    // 4. Delete caseId-indexed collections.
    for (const col of COLLECTIONS_BY_CASE) {
      try {
        await deleteAllByCaseIds(databases, DB, col, caseIds, log);
      } catch (e) {
        error(`Error purging ${col}: ${e.message}`);
      }
    }

    // 5. Delete storage files.
    let filesDeleted = 0;
    for (const { bucketId, fileId } of fileRefs) {
      try {
        await storage.deleteFile(bucketId, fileId);
        filesDeleted++;
      } catch (e) {
        error(`Failed to delete file ${fileId}: ${e.message}`);
      }
    }
    log(`Deleted ${filesDeleted} storage files`);

    // 6. Delete the Appwrite user account (point of no return).
    await users.delete(userId);
    log(`Deleted Appwrite account for user ${userId}`);

    return res.json({ ok: true });
  } catch (e) {
    error(`delete-account failed: ${e.message}`);
    return res.json({ ok: false, error: e.message }, 500);
  }
};
