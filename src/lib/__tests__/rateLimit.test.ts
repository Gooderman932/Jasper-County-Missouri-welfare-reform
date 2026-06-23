import { RateLimiter, loginRateLimiter } from '../rateLimit';

describe('RateLimiter', () => {
  const NOW = 1_000_000;

  function makeLimiter(maxAttempts = 3, windowMs = 60_000, lockoutMs = 120_000) {
    return new RateLimiter({ maxAttempts, windowMs, lockoutMs });
  }

  it('allows attempts within the limit', () => {
    const limiter = makeLimiter();
    expect(limiter.record('user1', NOW).allowed).toBe(true);
    expect(limiter.record('user1', NOW + 1).allowed).toBe(true);
    expect(limiter.record('user1', NOW + 2).allowed).toBe(true);
  });

  it('denies attempt that exceeds the limit and locks the key', () => {
    const limiter = makeLimiter(3);
    limiter.record('user1', NOW);
    limiter.record('user1', NOW + 1);
    limiter.record('user1', NOW + 2);
    const result = limiter.record('user1', NOW + 3); // 4th attempt
    expect(result.allowed).toBe(false);
    expect(result.lockedUntil).toBeGreaterThan(NOW + 3);
  });

  it('reports correct attemptsInWindow', () => {
    const limiter = makeLimiter(5, 60_000);
    limiter.record('user1', NOW);
    limiter.record('user1', NOW + 100);
    const r = limiter.record('user1', NOW + 200);
    expect(r.attemptsInWindow).toBe(3);
  });

  it('denies attempts while locked', () => {
    const limiter = makeLimiter(2, 60_000, 120_000);
    limiter.record('u', NOW);
    limiter.record('u', NOW + 1);
    limiter.record('u', NOW + 2); // triggers lockout
    // still locked 60 seconds later
    const r = limiter.record('u', NOW + 60_000);
    expect(r.allowed).toBe(false);
    expect(limiter.isLocked('u', NOW + 60_000)).toBe(true);
  });

  it('unlocks after lockout period expires', () => {
    const limiter = makeLimiter(2, 60_000, 120_000);
    limiter.record('u', NOW);
    limiter.record('u', NOW + 1);
    limiter.record('u', NOW + 2); // triggers lockout (lockoutMs = 120_000)
    // attempt after lockout expires
    expect(limiter.record('u', NOW + 130_000).allowed).toBe(true);
  });

  it('slides the window: old attempts fall out', () => {
    const limiter = makeLimiter(3, 60_000);
    // First two attempts at time 0
    limiter.record('u', NOW);
    limiter.record('u', NOW + 1);
    // Third attempt well after the window (70 seconds later) — first two have expired
    const r = limiter.record('u', NOW + 70_000);
    expect(r.allowed).toBe(true);
    expect(r.attemptsInWindow).toBe(1); // only the third attempt is in-window
  });

  it('reset() clears all state for a key', () => {
    const limiter = makeLimiter(1);
    limiter.record('u', NOW);
    limiter.record('u', NOW + 1); // exceeds limit → locked
    expect(limiter.isLocked('u', NOW + 1)).toBe(true);
    limiter.reset('u');
    expect(limiter.isLocked('u', NOW + 1)).toBe(false);
    expect(limiter.record('u', NOW + 2).allowed).toBe(true);
  });

  it('isLocked returns false before a lockout is triggered', () => {
    const limiter = makeLimiter(5);
    limiter.record('u', NOW);
    expect(limiter.isLocked('u', NOW)).toBe(false);
  });

  it('msUntilUnlock returns 0 when not locked', () => {
    const limiter = makeLimiter(5);
    expect(limiter.msUntilUnlock('u', NOW)).toBe(0);
  });

  it('msUntilUnlock returns positive ms when locked', () => {
    const limiter = makeLimiter(1, 60_000, 120_000);
    limiter.record('u', NOW);
    limiter.record('u', NOW + 1); // triggers lockout
    expect(limiter.msUntilUnlock('u', NOW + 2)).toBeGreaterThan(0);
  });

  it('isolates keys from each other', () => {
    const limiter = makeLimiter(2);
    limiter.record('u1', NOW);
    limiter.record('u1', NOW + 1);
    limiter.record('u1', NOW + 2); // u1 locked
    // u2 is unaffected
    expect(limiter.record('u2', NOW + 3).allowed).toBe(true);
  });
});

describe('loginRateLimiter (pre-configured NIST AC-7)', () => {
  it('is exported and has maxAttempts=5', () => {
    // Record 5 attempts — all should be allowed (limit is 5, lockout on 6th)
    const NOW = Date.now();
    for (let i = 0; i < 5; i++) {
      loginRateLimiter.record(`nist-test-${NOW}`, NOW + i);
    }
    const locked = loginRateLimiter.isLocked(`nist-test-${NOW}`, NOW + 5);
    // 5 attempts have not yet exceeded the max — not locked
    expect(locked).toBe(false);
  });
});
