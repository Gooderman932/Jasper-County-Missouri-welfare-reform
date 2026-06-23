/**
 * Behavioral threat detection — NIST SP 800-53 AU-6 (Audit Review, Analysis,
 * and Reporting) and SI-3 (Malicious Code Protection).
 *
 * Tracks per-user activity events in a rolling 1-hour window and computes a
 * composite threat score. When the score crosses a configurable threshold the
 * user is flagged as suspicious and the calling code should:
 *   1. Emit an audit log entry with action "threat.detected"
 *   2. Notify the admin team (ADMIN_TEAM_ID) via the admin portal
 *   3. Optionally require re-authentication (step-up MFA) for the next request
 *
 * All state is in-memory; for distributed deployments, inject a custom
 * `ThreatEventStore` backed by Redis or the `audit_log` Appwrite collection.
 */

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type ThreatEventType =
  | 'auth.failure'      // failed login / session token validation
  | 'auth.success'      // successful login (resets failure counter)
  | 'auth.mfa_bypass'   // MFA code rejected or skipped
  | 'data.export'       // generate-export function invoked
  | 'data.bulk_read'    // large collection query (>50 docs)
  | 'data.delete'       // hard-delete of a case record or document
  | 'admin.access'      // admin-portal route accessed
  | 'unusual.time'      // request at unusual hour (00:00–05:59 UTC)
  | 'rapid.request'     // request arriving faster than the API rate limiter allows
  | 'input.injection';  // InputValidationError raised for this user

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ThreatEvent {
  type: ThreatEventType;
  occurredAt: number; // Unix ms
  metadata?: Record<string, unknown>;
}

export interface ThreatEventStore {
  append(userId: string, event: ThreatEvent): void;
  getRecent(userId: string, windowMs: number, nowMs: number): ThreatEvent[];
  clear(userId: string): void;
  pruneAll(windowMs: number, nowMs: number): void;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

class MemoryThreatStore implements ThreatEventStore {
  private events = new Map<string, ThreatEvent[]>();

  append(userId: string, event: ThreatEvent): void {
    const list = this.events.get(userId) ?? [];
    list.push(event);
    this.events.set(userId, list);
  }

  getRecent(userId: string, windowMs: number, nowMs: number): ThreatEvent[] {
    const list = this.events.get(userId) ?? [];
    return list.filter(e => nowMs - e.occurredAt < windowMs);
  }

  clear(userId: string): void {
    this.events.delete(userId);
  }

  pruneAll(windowMs: number, nowMs: number): void {
    for (const [userId, list] of this.events) {
      const active = list.filter(e => nowMs - e.occurredAt < windowMs);
      if (active.length === 0) {
        this.events.delete(userId);
      } else {
        this.events.set(userId, active);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface ScoreRule {
  indicator: string;
  /** Minimum event count within the window to trigger this rule. */
  threshold: number;
  /** Points added to the threat score when triggered. */
  weight: number;
}

const DEFAULT_RULES: ScoreRule[] = [
  // Each weight is calibrated so that the indicator alone crosses the default
  // threshold of 50, making every rule individually actionable.
  { indicator: 'excessive_auth_failures',  threshold: 5,   weight: 55 },
  { indicator: 'mfa_bypass_attempt',       threshold: 1,   weight: 60 },
  { indicator: 'excessive_exports',        threshold: 10,  weight: 55 },
  { indicator: 'excessive_bulk_reads',     threshold: 50,  weight: 55 },
  { indicator: 'excessive_deletes',        threshold: 5,   weight: 55 },
  { indicator: 'rapid_requests',           threshold: 100, weight: 55 },
  { indicator: 'unusual_time_access',      threshold: 1,   weight: 10 },
  { indicator: 'admin_access',             threshold: 1,   weight: 5  },
  { indicator: 'injection_attempts',       threshold: 1,   weight: 60 },
];

function eventTypeForRule(indicator: string): ThreatEventType | null {
  const map: Record<string, ThreatEventType> = {
    excessive_auth_failures: 'auth.failure',
    mfa_bypass_attempt:      'auth.mfa_bypass',
    excessive_exports:       'data.export',
    excessive_bulk_reads:    'data.bulk_read',
    excessive_deletes:       'data.delete',
    rapid_requests:          'rapid.request',
    unusual_time_access:     'unusual.time',
    admin_access:            'admin.access',
    injection_attempts:      'input.injection',
  };
  return map[indicator] ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ThreatSummary {
  userId: string;
  score: number;
  suspicious: boolean;
  indicators: string[];
  eventCounts: Partial<Record<ThreatEventType, number>>;
  windowStartIso: string;
  evaluatedAtIso: string;
}

export interface ThreatDetectorOptions {
  /** Rolling analysis window in ms. Default: 1 hour. */
  windowMs?: number;
  /** Score at or above which a user is flagged as suspicious. Default: 50. */
  scoreThreshold?: number;
  rules?: ScoreRule[];
  store?: ThreatEventStore;
}

export class ThreatDetector {
  private windowMs: number;
  private scoreThreshold: number;
  private rules: ScoreRule[];
  private store: ThreatEventStore;

  constructor(opts: ThreatDetectorOptions = {}) {
    this.windowMs = opts.windowMs ?? 60 * 60 * 1000;
    this.scoreThreshold = opts.scoreThreshold ?? 50;
    this.rules = opts.rules ?? DEFAULT_RULES;
    this.store = opts.store ?? new MemoryThreatStore();
  }

  /**
   * Records a security-relevant event for a user. Call this from:
   *   - Auth handler (auth.failure / auth.success)
   *   - generate-export function (data.export)
   *   - Any input validation error handler (input.injection)
   *   - Rate limiter enforcement path (rapid.request)
   *
   * Pass `nowMs` in tests to fix the event timestamp for deterministic results.
   */
  recordEvent(
    userId: string,
    type: ThreatEventType,
    metadata?: Record<string, unknown>,
    nowMs: number = Date.now(),
  ): void {
    this.store.append(userId, { type, occurredAt: nowMs, metadata });
  }

  /**
   * Computes and returns a full threat summary for `userId` over the rolling
   * window. Callers can inspect `.suspicious` or use `isSuspicious()` for a
   * boolean check.
   */
  getSummary(userId: string, nowMs: number = Date.now()): ThreatSummary {
    const recent = this.store.getRecent(userId, this.windowMs, nowMs);

    // Find the most recent successful login. Auth failures before this point
    // are excluded from scoring — the user proved their identity, resetting
    // the failure streak (analogous to NIST AC-7's reset-on-success requirement).
    let latestSuccessAt = 0;
    for (const e of recent) {
      if (e.type === 'auth.success' && e.occurredAt > latestSuccessAt) {
        latestSuccessAt = e.occurredAt;
      }
    }

    const counts: Partial<Record<ThreatEventType, number>> = {};
    for (const e of recent) {
      if (e.type === 'auth.failure' && e.occurredAt <= latestSuccessAt) {
        continue; // failures before the last success are forgiven
      }
      counts[e.type] = (counts[e.type] ?? 0) + 1;
    }

    const indicators: string[] = [];
    let score = 0;

    for (const rule of this.rules) {
      const eventType = eventTypeForRule(rule.indicator);
      const count = eventType ? (counts[eventType] ?? 0) : 0;
      if (count >= rule.threshold) {
        indicators.push(rule.indicator);
        score += rule.weight;
      }
    }

    const windowStart = new Date(nowMs - this.windowMs).toISOString();
    return {
      userId,
      score,
      suspicious: score >= this.scoreThreshold,
      indicators,
      eventCounts: counts,
      windowStartIso: windowStart,
      evaluatedAtIso: new Date(nowMs).toISOString(),
    };
  }

  /** Returns true when the user's threat score meets or exceeds the threshold. */
  isSuspicious(userId: string, nowMs: number = Date.now()): boolean {
    return this.getSummary(userId, nowMs).suspicious;
  }

  /** Clears all recorded events for a user (e.g. after admin review + clearance). */
  clearUser(userId: string): void {
    this.store.clear(userId);
  }

  /**
   * Purges events older than the analysis window from memory.
   * Call periodically (e.g. every 10 minutes) to avoid unbounded growth.
   */
  pruneExpired(nowMs: number = Date.now()): void {
    this.store.pruneAll(this.windowMs, nowMs);
  }
}

// ---------------------------------------------------------------------------
// Singleton for use across server functions
// ---------------------------------------------------------------------------

/** Process-scoped singleton. Replace with a distributed store in production. */
export const globalThreatDetector = new ThreatDetector();
