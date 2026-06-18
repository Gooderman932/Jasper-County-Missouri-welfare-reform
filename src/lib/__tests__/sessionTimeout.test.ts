import { isSessionExpired, msUntilExpiry, SESSION_TIMEOUT_MS } from '../sessionTimeout';

describe('sessionTimeout', () => {
  it('is not expired immediately after activity', () => {
    const now = 1_000_000;
    expect(isSessionExpired(now, now)).toBe(false);
  });

  it('is expired exactly at the timeout boundary', () => {
    const last = 0;
    expect(isSessionExpired(last, SESSION_TIMEOUT_MS)).toBe(true);
  });

  it('is not expired one ms before the boundary', () => {
    const last = 0;
    expect(isSessionExpired(last, SESSION_TIMEOUT_MS - 1)).toBe(false);
  });

  it('reports remaining time and goes non-positive once expired', () => {
    expect(msUntilExpiry(0, 0)).toBe(SESSION_TIMEOUT_MS);
    expect(msUntilExpiry(0, SESSION_TIMEOUT_MS)).toBeLessThanOrEqual(0);
  });
});
