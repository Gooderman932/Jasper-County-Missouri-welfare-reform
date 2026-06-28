// Appwrite Function: rtdn-handler
// Runtime: Node 18
//
// Handles Google Play Real-Time Developer Notifications (RTDN) pushed via
// Cloud Pub/Sub. When a user's subscription changes (renewed, canceled,
// billing issue, etc.) Play notifies this endpoint within seconds, allowing
// entitlements to be updated without waiting for the next client sync.
//
// Setup (one-time):
//   1. Create a Cloud Pub/Sub topic in your GCP project.
//   2. In Play Console → Monetization → Real-time developer notifications,
//      enable RTDN and enter the topic name.
//   3. Create a Pub/Sub push subscription pointed at this function's
//      Appwrite webhook URL (found in Appwrite Console → Functions → rtdn-handler
//      → Domains).
//   4. Validate the endpoint in Play Console.
//
// Env vars required:
//   APPWRITE_FUNCTION_PROJECT_ID   (auto-injected)
//   APPWRITE_API_KEY               admin key
//   APPWRITE_ENDPOINT
//   APPWRITE_DATABASE_ID           (default: family_rights_main)
//   GOOGLE_PLAY_PACKAGE_NAME       e.g. com.poordudeholdings.familyrights
//   GOOGLE_PLAY_SERVICE_ACCOUNT_B64  base64-encoded service-account JSON
//   PUBSUB_TOKEN                   (optional) shared secret to validate Pub/Sub push auth
//
// Pub/Sub push payload:
//   { message: { data: "<base64>", messageId: "...", publishTime: "..." } }
//
// The base64-decoded `data` is a DeveloperNotification JSON containing a
// subscriptionNotification with notificationType and purchaseToken.

const sdk = require('node-appwrite');
const https = require('https');

const NOTIFICATION_TYPES = {
  1: 'RECOVERED',
  2: 'RENEWED',
  3: 'CANCELED',
  4: 'PURCHASED',
  5: 'ON_HOLD',
  6: 'IN_GRACE_PERIOD',
  7: 'RESTARTED',
  8: 'PRICE_CHANGE_CONFIRMED',
  9: 'DEFERRED',
  10: 'PAUSED',
  11: 'PAUSE_SCHEDULE_CHANGED',
  12: 'REVOKED',
  13: 'EXPIRED',
};

// Maps Play subscription states to app entitlement statuses.
function notificationTypeToStatus(type) {
  switch (type) {
    case 1: return 'active';      // RECOVERED — billing fixed after grace period
    case 2: return 'active';      // RENEWED
    case 3: return 'canceled';    // CANCELED — still active until period ends
    case 4: return 'active';      // PURCHASED — new subscription
    case 5: return 'billing_issue'; // ON_HOLD
    case 6: return 'grace_period'; // IN_GRACE_PERIOD
    case 7: return 'active';      // RESTARTED
    case 8: return 'active';      // PRICE_CHANGE_CONFIRMED
    case 9: return 'active';      // DEFERRED — extends existing period
    case 10: return 'expired';    // PAUSED (treated as expired for feature access)
    case 11: return 'active';     // PAUSE_SCHEDULE_CHANGED
    case 12: return 'expired';    // REVOKED
    case 13: return 'expired';    // EXPIRED
    default: return null;
  }
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function getAccessToken(serviceAccountB64) {
  const sa = JSON.parse(Buffer.from(serviceAccountB64, 'base64').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const crypto = require('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, 'base64url');
  const jwt = `${header}.${payload}.${sig}`;

  const postData = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) } },
      (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => {
          const j = JSON.parse(body);
          if (j.access_token) resolve(j.access_token);
          else reject(new Error(`OAuth failed: ${body}`));
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = async ({ req, res, log, error }) => {
  // Optional shared secret for Pub/Sub push authentication.
  const expectedToken = process.env.PUBSUB_TOKEN;
  if (expectedToken) {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token !== expectedToken) {
      error('Invalid Pub/Sub token');
      return res.json({ ok: false }, 401);
    }
  }

  // Parse the Pub/Sub push envelope.
  let notification;
  try {
    const envelope = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const decoded = Buffer.from(envelope.message.data, 'base64').toString('utf8');
    notification = JSON.parse(decoded);
  } catch (e) {
    error(`Failed to parse Pub/Sub payload: ${e.message}`);
    // Return 200 so Pub/Sub does not retry a malformed message.
    return res.json({ ok: false, error: 'bad_payload' });
  }

  const sub = notification.subscriptionNotification;
  if (!sub) {
    // Could be a testNotification — acknowledge and return.
    log('Received non-subscription notification (test or one-time product); ignoring.');
    return res.json({ ok: true });
  }

  const { notificationType, purchaseToken } = sub;
  const typeName = NOTIFICATION_TYPES[notificationType] ?? `UNKNOWN_${notificationType}`;
  log(`RTDN: type=${typeName} purchaseToken=${purchaseToken?.slice(0, 16)}…`);

  const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? 'https://cloud.appwrite.io/v1';
  const PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const API_KEY = process.env.APPWRITE_API_KEY;
  const DB = process.env.APPWRITE_DATABASE_ID ?? 'family_rights_main';
  const PACKAGE = process.env.GOOGLE_PLAY_PACKAGE_NAME ?? 'com.poordudeholdings.familyrights';
  const SA_B64 = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_B64;

  const client = new sdk.Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  const databases = new sdk.Databases(client);

  // Find the userId from purchase_records by purchaseToken.
  let userId = null;
  try {
    const rows = await databases.listDocuments(DB, 'purchase_records', [
      sdk.Query.equal('purchaseToken', purchaseToken),
      sdk.Query.limit(1),
    ]);
    if (rows.documents.length) userId = rows.documents[0].userId;
  } catch (e) {
    error(`Could not look up purchase_records: ${e.message}`);
  }

  const newStatus = notificationTypeToStatus(notificationType);
  if (!newStatus) {
    log(`Notification type ${typeName} does not map to a status change; skipping.`);
    return res.json({ ok: true });
  }

  if (userId) {
    // Update entitlement directly for the known user.
    try {
      const rows = await databases.listDocuments(DB, 'entitlements', [
        sdk.Query.equal('userId', userId),
        sdk.Query.limit(1),
      ]);
      if (rows.documents.length) {
        await databases.updateDocument(DB, 'entitlements', rows.documents[0].$id, {
          status: newStatus,
          lastVerifiedAt: new Date().toISOString(),
        });
        log(`Updated entitlement for userId=${userId} → ${newStatus}`);
      }
    } catch (e) {
      error(`Failed to update entitlement: ${e.message}`);
    }
  } else if (SA_B64) {
    // No purchase_records row found — verify via Play API to learn the userId.
    // This handles the case where the token was issued before we stored the record.
    try {
      const accessToken = await getAccessToken(SA_B64);
      const productId = sub.subscriptionId ?? 'premium_monthly_599';
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases/subscriptionsv2/tokens/${purchaseToken}`;
      const { status, data } = await httpsGet(url, { Authorization: `Bearer ${accessToken}` });
      if (status === 200 && data.externalAccountIdentifiers?.externalAccountId) {
        const uid = data.externalAccountIdentifiers.externalAccountId;
        const rows = await databases.listDocuments(DB, 'entitlements', [sdk.Query.equal('userId', uid), sdk.Query.limit(1)]);
        if (rows.documents.length) {
          await databases.updateDocument(DB, 'entitlements', rows.documents[0].$id, {
            status: newStatus,
            lastVerifiedAt: new Date().toISOString(),
          });
          log(`Updated entitlement (via Play API) for userId=${uid} → ${newStatus}`);
        }
      } else {
        log(`Play API returned ${status} for token; could not determine userId.`);
      }
    } catch (e) {
      error(`Play API verification failed: ${e.message}`);
    }
  } else {
    log('No purchase_records match and no service account configured — cannot update entitlement.');
  }

  // Always return 200 so Pub/Sub does not retry unnecessarily.
  return res.json({ ok: true });
};
