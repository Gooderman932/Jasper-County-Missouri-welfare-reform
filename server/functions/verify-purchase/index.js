// Appwrite Function: verify-purchase
// Runtime: Node 18
// Verifies a Google Play purchase token and upserts the user's entitlement.
//
// Env vars required (set in Appwrite Console):
//   APPWRITE_FUNCTION_PROJECT_ID
//   APPWRITE_API_KEY
//   APPWRITE_DATABASE_ID         (e.g. family_rights_main)
//   GOOGLE_PLAY_PACKAGE_NAME
//   GOOGLE_PLAY_SERVICE_ACCOUNT_B64   (base64-encoded service-account JSON with
//                                       androidpublisher scope)
//
// Trigger: clients call functions.createExecution('verify-purchase', JSON({userId})).
// The function reads the most recent purchase_records for that user and checks each
// purchaseToken via the Google Play Developer API, then upserts entitlements with
// trial / active / grace_period / billing_issue / expired / canceled status.

const sdk = require('node-appwrite');
const https = require('https');

const COLLECTIONS = {
  purchase_records: 'purchase_records',
  entitlements: 'entitlements',
};

function getGoogleAccessToken(serviceAccount) {
  return new Promise((resolve, reject) => {
    const jwt = require('jsonwebtoken');
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      },
      serviceAccount.private_key,
      { algorithm: 'RS256' }
    );
    const body = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`;
    const req = https.request(
      {
        method: 'POST',
        host: 'oauth2.googleapis.com',
        path: '/token',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.access_token) resolve(parsed.access_token);
            else reject(new Error('No access_token: ' + data));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getSubscriptionV2(accessToken, pkg, purchaseToken) {
  return new Promise((resolve, reject) => {
    https
      .get(
        {
          host: 'androidpublisher.googleapis.com',
          path: `/androidpublisher/v3/applications/${pkg}/purchases/subscriptionsv2/tokens/${purchaseToken}`,
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        }
      )
      .on('error', reject);
  });
}

function mapState(g) {
  // Google subscriptionState -> our status
  switch (g.subscriptionState) {
    case 'SUBSCRIPTION_STATE_ACTIVE':
      return g.paidSubscriptionLineItem ? 'active' : 'trialing';
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':
      return 'grace_period';
    case 'SUBSCRIPTION_STATE_ON_HOLD':
    case 'SUBSCRIPTION_STATE_PAUSED':
      return 'billing_issue';
    case 'SUBSCRIPTION_STATE_CANCELED':
      return 'canceled';
    case 'SUBSCRIPTION_STATE_EXPIRED':
      return 'expired';
    default:
      return 'expired';
  }
}

module.exports = async function (context) {
  const { req, res, log, error } = context;
  try {
    const { userId } = JSON.parse(req.payload || req.body || '{}');
    if (!userId) return res.json({ ok: false, error: 'userId required' }, 400);

    const client = new sdk.Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);
    const db = new sdk.Databases(client);
    const DATABASE = process.env.APPWRITE_DATABASE_ID;

    const records = await db.listDocuments(DATABASE, COLLECTIONS.purchase_records, [
      sdk.Query.equal('userId', userId),
      sdk.Query.orderDesc('receivedAt'),
      sdk.Query.limit(5),
    ]);

    const serviceAccount = JSON.parse(
      Buffer.from(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')
    );
    const accessToken = await getGoogleAccessToken(serviceAccount);

    let best = null;
    for (const pr of records.documents) {
      const g = await getSubscriptionV2(accessToken, process.env.GOOGLE_PLAY_PACKAGE_NAME, pr.purchaseToken);
      if (g.error) { log('Token failed: ' + JSON.stringify(g.error)); continue; }
      const status = mapState(g);
      const trialEndsAt = g.startTime && g.lineItems?.[0]?.offerDetails?.basePlanId
        ? g.startTime
        : null;
      const currentPeriodEndsAt = g.lineItems?.[0]?.expiryTime ?? null;
      const item = {
        userId,
        platform: 'google_play',
        productId: pr.productId,
        basePlanId: g.lineItems?.[0]?.offerDetails?.basePlanId ?? 'monthly-autorenew',
        offerId: g.lineItems?.[0]?.offerDetails?.offerId ?? null,
        status,
        trialEndsAt,
        currentPeriodEndsAt,
        lastVerifiedAt: new Date().toISOString(),
      };
      if (!best || new Date(item.lastVerifiedAt) >= new Date(best.lastVerifiedAt)) best = item;
    }

    if (!best) {
      best = {
        userId,
        platform: 'google_play',
        productId: 'premium_monthly_599',
        basePlanId: 'monthly-autorenew',
        status: 'expired',
        lastVerifiedAt: new Date().toISOString(),
      };
    }

    // Upsert: list existing then update or create
    const existing = await db.listDocuments(DATABASE, COLLECTIONS.entitlements, [
      sdk.Query.equal('userId', userId),
      sdk.Query.limit(1),
    ]);
    if (existing.documents.length > 0) {
      await db.updateDocument(DATABASE, COLLECTIONS.entitlements, existing.documents[0].$id, best);
    } else {
      await db.createDocument(DATABASE, COLLECTIONS.entitlements, sdk.ID.unique(), best, [
        sdk.Permission.read(sdk.Role.user(userId)),
      ]);
    }
    return res.json({ ok: true, entitlement: best });
  } catch (err) {
    error(err.message);
    return res.json({ ok: false, error: err.message }, 500);
  }
};
