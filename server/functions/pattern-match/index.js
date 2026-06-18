/**
 * Appwrite Function: pattern-match
 *
 * Trigger: HTTP (mobile app calls when user has opted into coalition matching)
 *          AND nightly cron (re-run aggregation across newly opted-in cases)
 *
 * Responsibilities:
 *   - Read ISSUE FLAGS from cases whose owners have set `coalition_opt_ins.optIn = true`.
 *   - Group by issue.code (e.g. NO_COUNSEL_AT_HEARING, WRONG_ADDRESS_NOTICE, ...).
 *   - For each issue code that appears in >= MIN_CASES distinct cases, write/upsert a
 *     row to `pattern_matches`:
 *        { code, caseCount, jurisdiction, judges, caseworkers, attorneys, lastUpdated }
 *   - Never store identifying child or parent info — only structural counts and the
 *     opt-in case IDs (which are themselves owned by the user; cross-user reads happen
 *     via the function's elevated key and are aggregated in memory before write).
 *
 * Env vars:
 *   APPWRITE_ENDPOINT / PROJECT_ID / API_KEY
 *   APPWRITE_DATABASE_ID            (default: family_rights_main)
 *   COL_ISSUE_FLAGS                 (default: issue_flags)
 *   COL_CASES                       (default: cases)
 *   COL_COALITION_OPTINS            (default: coalition_opt_ins)
 *   COL_PATTERN_MATCHES             (default: pattern_matches)
 *   COL_PARTIES                     (default: case_parties)
 *   MIN_CASES_FOR_PATTERN           (default: 3)
 *
 * Output: writes pattern_matches rows. Returns { ok, patternsWritten, opt_in_cases }.
 *
 * Legal guardrail: every pattern row has `displayText` phrased as
 *   "X cases in <jurisdiction> have flagged a possible <issue> issue for attorney review."
 * — never "X cases prove" or "X cases violate".
 */

const sdk = require('node-appwrite');

// Best-effort per-instance burst limiter (see verify-purchase for caveats).
const RATE_BUCKET = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  // Prune expired entries so the map can't grow unbounded in a warm instance.
  for (const [k, slot] of RATE_BUCKET) {
    if (now - slot.windowStart >= windowMs) RATE_BUCKET.delete(k);
  }
  const slot = RATE_BUCKET.get(key);
  if (!slot) {
    RATE_BUCKET.set(key, { count: 1, windowStart: now });
    return false;
  }
  slot.count += 1;
  return slot.count > max;
}

const ISSUE_LABELS = {
  NO_COUNSEL_AT_HEARING: 'right-to-counsel timing',
  WRONG_ADDRESS_NOTICE: 'service / notice to wrong address',
  COVERT_COUNSEL_APPOINTMENT: 'counsel appointed without parent knowledge',
  EVE_OF_TRIAL_CONSULTATION: 'first counsel contact on eve of trial',
  COUNSEL_CONFLICT_OF_INTEREST: 'possible counsel conflict of interest',
  SAME_JUDGE_THROUGHOUT: 'same judicial officer across related proceedings',
  CROSS_BORDER_REASONABLE_EFFORTS: 'cross-border reasonable-efforts adequacy',
  REPEATED_COUNSEL_NO_SHOW: 'repeated counsel non-appearance',
  GOAL_CHANGE_TIMING: 'permanency goal change timing',
  FIT_PARENT_PLACEMENT: 'fit-parent placement preference',
  TRANSFER_NOTICE_TIMING: 'appellate transfer notice timing',
};

module.exports = async ({ req, res, log, error }) => {
  try {
    const {
      APPWRITE_ENDPOINT,
      APPWRITE_PROJECT_ID,
      APPWRITE_API_KEY,
      APPWRITE_DATABASE_ID = 'family_rights_main',
      COL_ISSUE_FLAGS = 'issue_flags',
      COL_CASES = 'cases',
      COL_COALITION_OPTINS = 'coalition_opt_ins',
      COL_PATTERN_MATCHES = 'pattern_matches',
      COL_PARTIES = 'case_parties',
      MIN_CASES_FOR_PATTERN = '3',
    } = process.env;

    if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
      throw new Error('Missing Appwrite environment configuration');
    }

    // This is an expensive cross-case aggregation. The nightly cron sets
    // x-appwrite-trigger: schedule; only throttle ad-hoc HTTP invocations so a
    // client can't repeatedly trigger full re-aggregation.
    const trigger = req?.headers?.['x-appwrite-trigger'] || 'http';
    if (trigger !== 'schedule' && rateLimited('pattern-match:http', 3, 5 * 60_000)) {
      return res.json({ ok: false, error: 'Pattern matching was run recently. Try again later.' }, 429);
    }

    const minCases = parseInt(MIN_CASES_FOR_PATTERN, 10);

    const client = new sdk.Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setKey(APPWRITE_API_KEY);
    const databases = new sdk.Databases(client);

    // ----- 1. Find opted-in case IDs -----
    const optIns = await listAll(databases, APPWRITE_DATABASE_ID, COL_COALITION_OPTINS, [
      sdk.Query.equal('optIn', true),
    ]);
    const optInCaseIds = optIns.map((o) => o.caseId);
    log(`Pattern run: ${optInCaseIds.length} opted-in cases`);

    if (optInCaseIds.length < minCases) {
      return res.json({
        ok: true,
        patternsWritten: 0,
        optedInCases: optInCaseIds.length,
        note: `Need at least ${minCases} opted-in cases to identify a pattern.`,
      });
    }

    // ----- 2. Bulk load cases (for jurisdiction) and parties (for actor names) -----
    const caseRows = await listByIds(databases, APPWRITE_DATABASE_ID, COL_CASES, optInCaseIds);
    const caseMap = new Map(caseRows.map((c) => [c.$id, c]));

    const parties = await listAll(databases, APPWRITE_DATABASE_ID, COL_PARTIES, [
      sdk.Query.equal('caseId', optInCaseIds),
      sdk.Query.limit(1000),
    ]);

    // ----- 3. Bulk load issue flags from opted-in cases -----
    const flags = await listAll(databases, APPWRITE_DATABASE_ID, COL_ISSUE_FLAGS, [
      sdk.Query.equal('caseId', optInCaseIds),
      sdk.Query.limit(5000),
    ]);

    // ----- 4. Aggregate -----
    const byCode = new Map(); // code -> { caseSet, jurisdictionSet, judgeSet, caseworkerSet, attorneySet }
    for (const f of flags) {
      const code = f.code;
      if (!byCode.has(code)) {
        byCode.set(code, {
          caseSet: new Set(),
          jurisdictions: new Set(),
          judges: new Set(),
          caseworkers: new Set(),
          attorneys: new Set(),
        });
      }
      const slot = byCode.get(code);
      slot.caseSet.add(f.caseId);

      const c = caseMap.get(f.caseId);
      if (c?.jurisdiction) slot.jurisdictions.add(c.jurisdiction);

      const caseParties = parties.filter((p) => p.caseId === f.caseId);
      for (const p of caseParties) {
        if (p.role === 'judge') slot.judges.add(p.name);
        if (p.role === 'caseworker') slot.caseworkers.add(p.name);
        if (p.role === 'attorney' || p.role === 'opposing_attorney') slot.attorneys.add(p.name);
      }
    }

    // ----- 5. Persist -----
    let written = 0;
    for (const [code, slot] of byCode.entries()) {
      const caseCount = slot.caseSet.size;
      if (caseCount < minCases) continue;

      const jurisdictionList = [...slot.jurisdictions];
      const docId = sanitizeId(`pat_${code}_${jurisdictionList.join('_') || 'multi'}`);
      const payload = {
        code,
        label: ISSUE_LABELS[code] || code,
        caseCount,
        jurisdictions: jurisdictionList,
        judges: [...slot.judges].slice(0, 50),
        caseworkers: [...slot.caseworkers].slice(0, 50),
        attorneys: [...slot.attorneys].slice(0, 50),
        displayText:
          `${caseCount} opted-in cases${jurisdictionList.length ? ` in ${jurisdictionList.join(', ')}` : ''} ` +
          `have flagged a possible ${ISSUE_LABELS[code] || code} issue for attorney review. ` +
          `This is not a legal conclusion.`,
        lastUpdated: new Date().toISOString(),
      };

      try {
        await databases.updateDocument(APPWRITE_DATABASE_ID, COL_PATTERN_MATCHES, docId, payload);
      } catch (_) {
        try {
          await databases.createDocument(
            APPWRITE_DATABASE_ID, COL_PATTERN_MATCHES, docId, payload,
            // public read so any user can see aggregates (no PII)
            ['read("any")'],
          );
        } catch (e2) {
          error(`Failed to upsert pattern ${code}: ${e2.message}`);
          continue;
        }
      }
      written += 1;
    }

    return res.json({
      ok: true,
      patternsWritten: written,
      optedInCases: optInCaseIds.length,
      issuesEvaluated: byCode.size,
    });
  } catch (e) {
    error(`pattern-match failed: ${e.message}\n${e.stack}`);
    return res.json({ ok: false, error: 'Pattern matching failed. Please try again later.' }, 500);
  }
};

// ----- helpers -----
function sanitizeId(s) {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36);
}

async function listAll(db, dbId, colId, baseQueries) {
  const all = [];
  let cursor;
  while (true) {
    const queries = [...baseQueries, sdk.Query.limit(100)];
    if (cursor) queries.push(sdk.Query.cursorAfter(cursor));
    const page = await db.listDocuments(dbId, colId, queries);
    all.push(...page.documents);
    if (page.documents.length < 100) break;
    cursor = page.documents[page.documents.length - 1].$id;
  }
  return all;
}

async function listByIds(db, dbId, colId, ids) {
  if (ids.length === 0) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const page = await db.listDocuments(dbId, colId, [
      sdk.Query.equal('$id', chunk),
      sdk.Query.limit(100),
    ]);
    out.push(...page.documents);
  }
  return out;
}
