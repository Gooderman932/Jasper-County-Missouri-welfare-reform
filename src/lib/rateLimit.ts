/**
 * Sliding-window rate limiter — NIST SP 800-53 AC-7 (Unsuccessful Logon Attempts).
 *
 * AC-7 requires the system to:
 *   (a) enforce a limit on consecutive invalid access attempts, and
 *   (b) lock the account for a specified time period after the limit is reached.
 *
 * This implementation tracks arbitrary string keys (e.g. userId, IP address, or
 * email) so it can be applied to login attempts, export requests, and API calls.
 * All state is in-memory; for distributed deployments, replace with a Redis adapter
 * that swaps in via the `RateLimitStore` interface.
 */

export interface RateLimitStore {
  getTimestamps(key: string): number[];
  setTimestamps(key: string, timestamps: number[]): void;
  getLockUntil(key: string): number;
  setLockUntil(key: string, until: number): void;
  clearKey(key: string): void;
}

class MemoryStore implements RateLimitStore {
  private timestamps = new Map<string, number[]>();
  private lockUntil = new Map<string, number>();

  getTimestamps(key: string): number[] {
    return this.timestamps.get(key) ?? [];
  }
  setTimestamps(key: string, timestamps: number[]): void {
    this.timestamps.set(key, timestamps);
  }
  getLockUntil(key: string): number {
    return this.lockUntil.get(key) ?? 0;
  }
  setLockUntil(key: string, until: number): void {
    this.lockUntil.set(key, until);
  }
  clearKey(key: string): void {
    this.timestamps.delete(key);
    this.lockUntil.delete(key);
  }
}

export interface RateLimiterOptions {
  /** Maximum number of attempts allowed within `windowMs`. */
  maxAttempts: number;
  /** Rolling window duration in milliseconds. */
  windowMs: number;
  /**
   * Duration of lockout after the limit is exceeded, in milliseconds.
   * Defaults to `windowMs` when not specified.
   */
  lockoutMs?: number;
  store?: RateLimitStore;
}

export interface RateLimitResult {
  /** Whether this attempt is permitted. */
  allowed: boolean;
  /** Number of attempts recorded within the current window. */
  attemptsInWindow: number;
  /** Unix ms timestamp when the lockout expires; 0 if not locked. */
  lockedUntil: number;
}

export class RateLimiter {
  private maxAttempts: number;
  private windowMs: number;
  private lockoutMs: number;
  private store: RateLimitStore;

  constructor(opts: RateLimiterOptions) {
    this.maxAttempts = opts.maxAttempts;
    this.windowMs = opts.windowMs;
    this.lockoutMs = opts.lockoutMs ?? opts.windowMs;
    this.store = opts.store ?? new MemoryStore();
  }

  /**
   * Records a new attempt for `key` and returns whether it is permitted.
   * Call this on every authentication attempt, API request, or any operation
   * subject to rate limiting.
   */
  record(key: string, nowMs: number = Date.now()): RateLimitResult {
    const lockUntil = this.store.getLockUntil(key);
    if (nowMs < lockUntil) {
      return { allowed: false, attemptsInWindow: this.maxAttempts, lockedUntil: lockUntil };
    }

    const raw = this.store.getTimestamps(key);
    const windowStart = nowMs - this.windowMs;
    const active = raw.filter(t => t > windowStart);
    active.push(nowMs);
    this.store.setTimestamps(key, active);

    if (active.length > this.maxAttempts) {
      const until = nowMs + this.lockoutMs;
      this.store.setLockUntil(key, until);
      return { allowed: false, attemptsInWindow: active.length, lockedUntil: until };
    }

    return { allowed: true, attemptsInWindow: active.length, lockedUntil: 0 };
  }

  /** Returns true if the key is currently locked out. */
  isLocked(key: string, nowMs: number = Date.now()): boolean {
    return nowMs < this.store.getLockUntil(key);
  }

  /** Returns ms remaining in the lockout; 0 if not locked. */
  msUntilUnlock(key: string, nowMs: number = Date.now()): number {
    const until = this.store.getLockUntil(key);
    return Math.max(0, until - nowMs);
  }

  /** Clears all state for a key (e.g. after a successful authentication). */
  reset(key: string): void {
    this.store.clearKey(key);
  }
}

// ---------------------------------------------------------------------------
// Pre-configured limiters
// ---------------------------------------------------------------------------

/**
 * NIST AC-7: max 5 consecutive failed login attempts within 15 minutes
 * → 30-minute account lockout.
 */
export const loginRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 30 * 60 * 1000,
});

/**
 * Export rate limiter: max 10 export requests per hour per user.
 * Prevents bulk data exfiltration via the generate-export function.
 */
export const exportRateLimiter = new RateLimiter({
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
  lockoutMs: 60 * 60 * 1000,
});

/**
 * Admin-portal API rate limiter: max 100 requests per minute per IP.
 */
export const apiRateLimiter = new RateLimiter({
  maxAttempts: 100,
  windowMs: 60 * 1000,
  lockoutMs: 5 * 60 * 1000,
});
