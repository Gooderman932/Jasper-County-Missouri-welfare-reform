/**
 * Appwrite Function: ocr-process
 *
 * Trigger: HTTP (called by mobile app after upload) OR storage.<bucketId>.files.create event
 *
 * Responsibilities:
 *   1. Fetch a document file from Appwrite Storage (raw-documents bucket).
 *   2. Run OCR via Google Cloud Vision (DOCUMENT_TEXT_DETECTION) against the bytes.
 *   3. Persist the extracted text + bounding-box JSON back to the `documents`
 *      collection row (fields: ocrText, ocrPagesJson, ocrStatus, ocrError).
 *   4. Be idempotent — if ocrStatus === 'completed' do nothing.
 *
 * Environment variables (set in Appwrite Console → Function → Settings):
 *   APPWRITE_ENDPOINT             - e.g. https://appwrite.example.com/v1
 *   APPWRITE_PROJECT_ID
 *   APPWRITE_API_KEY              - server key with databases.read/write + files.read
 *   APPWRITE_DATABASE_ID          - default: family_rights_main
 *   APPWRITE_DOCUMENTS_COLLECTION - default: documents
 *   APPWRITE_RAW_BUCKET_ID        - default: raw-documents
 *   GOOGLE_CLOUD_VISION_API_KEY   - simple API-key auth to Vision REST
 *      (alternatively GOOGLE_APPLICATION_CREDENTIALS_JSON for service account)
 *
 * Request body (when invoked by app):
 *   { "documentId": "<appwrite-doc-row-id>", "fileId": "<storage-file-id>" }
 *
 * NOTE: Vision has a 20 MB per-request limit. Larger PDFs should be sent via
 * asyncBatchAnnotateFiles → GCS; this function handles the common single-page
 * photo / small-PDF path used in the mobile capture flow.
 */

const sdk = require('node-appwrite');

const MAX_INLINE_BYTES = 20 * 1024 * 1024;

module.exports = async ({ req, res, log, error }) => {
  try {
    const {
      APPWRITE_ENDPOINT,
      APPWRITE_PROJECT_ID,
      APPWRITE_API_KEY,
      APPWRITE_DATABASE_ID = 'family_rights_main',
      APPWRITE_DOCUMENTS_COLLECTION = 'documents',
      APPWRITE_RAW_BUCKET_ID = 'raw-documents',
      GOOGLE_CLOUD_VISION_API_KEY,
    } = process.env;

    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
      throw new Error('Missing Appwrite environment configuration');
    }
    if (!GOOGLE_CLOUD_VISION_API_KEY) {
      throw new Error('Missing GOOGLE_CLOUD_VISION_API_KEY');
    }

    // ----- Parse trigger -----
    let documentId;
    let fileId;

    const bodyRaw = req?.bodyRaw || req?.body || '';
    const eventHeader = req?.headers?.['x-appwrite-event'] || '';

    if (eventHeader.includes('storage.') && eventHeader.includes('.files.create')) {
      // Storage event payload is the file resource
      const evt = typeof bodyRaw === 'string' ? JSON.parse(bodyRaw) : bodyRaw;
      fileId = evt.$id;
      documentId = evt.$id; // app should set storage fileId == document row's fileId
    } else {
      const parsed = typeof bodyRaw === 'string' ? JSON.parse(bodyRaw || '{}') : (bodyRaw || {});
      documentId = parsed.documentId;
      fileId = parsed.fileId;
    }

    if (!documentId || !fileId) {
      return res.json({ ok: false, error: 'documentId and fileId are required' }, 400);
    }

    // ----- Initialise Appwrite -----
    const client = new sdk.Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setKey(APPWRITE_API_KEY);

    const databases = new sdk.Databases(client);
    const storage = new sdk.Storage(client);

    // Idempotency check
    let docRow;
    try {
      docRow = await databases.getDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_DOCUMENTS_COLLECTION,
        documentId,
      );
    } catch (e) {
      log(`Document row ${documentId} not yet readable: ${e.message}`);
    }

    if (docRow && docRow.ocrStatus === 'completed') {
      return res.json({ ok: true, skipped: 'already_completed', documentId });
    }

    // Mark in-progress so the UI can show a spinner
    if (docRow) {
      await databases.updateDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_DOCUMENTS_COLLECTION,
        documentId,
        { ocrStatus: 'in_progress', ocrError: null },
      );
    }

    // ----- Fetch file bytes -----
    const fileBuffer = await storage.getFileDownload(APPWRITE_RAW_BUCKET_ID, fileId);
    const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    if (buf.length > MAX_INLINE_BYTES) {
      throw new Error(
        `File exceeds ${MAX_INLINE_BYTES} bytes (got ${buf.length}). ` +
        'Large PDFs must be processed via asyncBatchAnnotateFiles (not implemented in this function).',
      );
    }

    const base64 = buf.toString('base64');

    // ----- Call Google Vision -----
    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(GOOGLE_CLOUD_VISION_API_KEY)}`;

    const visionPayload = {
      requests: [
        {
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints: ['en'] },
        },
      ],
    };

    const visionResp = await fetch(visionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visionPayload),
    });

    if (!visionResp.ok) {
      const txt = await visionResp.text();
      throw new Error(`Vision API HTTP ${visionResp.status}: ${txt.slice(0, 500)}`);
    }
    const visionJson = await visionResp.json();
    const annotation = visionJson?.responses?.[0]?.fullTextAnnotation;
    const ocrText = annotation?.text || '';
    const pages = annotation?.pages || [];

    // Compress pages to minimal bounding info to fit Appwrite attribute size
    const compactPages = pages.map((p, idx) => ({
      n: idx,
      width: p.width,
      height: p.height,
      blocks: (p.blocks || []).map((b) => ({
        bb: b.boundingBox?.vertices || [],
        conf: b.confidence,
      })),
    }));

    // ----- Persist results -----
    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      APPWRITE_DOCUMENTS_COLLECTION,
      documentId,
      {
        ocrText: ocrText.slice(0, 1_000_000), // attribute size guard
        ocrPagesJson: JSON.stringify(compactPages).slice(0, 1_000_000),
        ocrStatus: 'completed',
        ocrError: null,
        ocrCompletedAt: new Date().toISOString(),
      },
    );

    log(`OCR completed for document ${documentId} (${ocrText.length} chars)`);
    return res.json({ ok: true, documentId, chars: ocrText.length });
  } catch (e) {
    error(`ocr-process failed: ${e.message}\n${e.stack}`);
    // Best-effort: mark row failed
    try {
      const sdk2 = require('node-appwrite');
      const c = new sdk2.Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);
      const db = new sdk2.Databases(c);
      const parsed = typeof req?.bodyRaw === 'string'
        ? JSON.parse(req.bodyRaw || '{}')
        : (req?.body || {});
      if (parsed.documentId) {
        await db.updateDocument(
          process.env.APPWRITE_DATABASE_ID || 'family_rights_main',
          process.env.APPWRITE_DOCUMENTS_COLLECTION || 'documents',
          parsed.documentId,
          { ocrStatus: 'failed', ocrError: e.message.slice(0, 1000) },
        );
      }
    } catch (_) {/* swallow */}
    return res.json({ ok: false, error: e.message }, 500);
  }
};
