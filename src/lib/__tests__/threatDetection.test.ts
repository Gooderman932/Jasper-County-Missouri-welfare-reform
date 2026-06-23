import { ThreatDetector, globalThreatDetector, type ThreatEventType } from '../threatDetection';

function makeFreshDetector(opts?: { windowMs?: number; scoreThreshold?: number }) {
  return new ThreatDetector(opts);
}

const NOW = 1_000_000_000; // arbitrary fixed timestamp

describe('ThreatDetector.recordEvent / getSummary', () => {
  it('returns score 0 and not suspicious for a user with no events', () => {
    const d = makeFreshDetector();
    const s = d.getSummary('alice', NOW);
    expect(s.score).toBe(0);
    expect(s.suspicious).toBe(false);
    expect(s.indicators).toHaveLength(0);
  });

  it('counts events by type in eventCounts', () => {
    const d = makeFreshDetector();
    d.recordEvent('bob', 'auth.failure', undefined, NOW);
    d.recordEvent('bob', 'auth.failure', undefined, NOW + 1);
    const s = d.getSummary('bob', NOW + 2);
    expect(s.eventCounts['auth.failure']).toBe(2);
  });

  it('flags excessive auth failures (≥5) as suspicious', () => {
    const d = makeFreshDetector();
    for (let i = 0; i < 5; i++) {
      d.recordEvent('u', 'auth.failure', undefined, NOW + i);
    }
    const s = d.getSummary('u', NOW + 10);
    expect(s.indicators).toContain('excessive_auth_failures');
    expect(s.suspicious).toBe(true);
  });

  it('does not flag fewer than threshold auth failures', () => {
    const d = makeFreshDetector();
    for (let i = 0; i < 4; i++) {
      d.recordEvent('u', 'auth.failure', undefined, NOW + i);
    }
    expect(d.getSummary('u', NOW + 10).indicators).not.toContain('excessive_auth_failures');
  });

  it('flags a single MFA bypass attempt (threshold=1)', () => {
    const d = makeFreshDetector();
    d.recordEvent('u', 'auth.mfa_bypass', undefined, NOW);
    const s = d.getSummary('u', NOW + 1);
    expect(s.indicators).toContain('mfa_bypass_attempt');
    expect(s.suspicious).toBe(true);
  });

  it('flags excessive exports (≥10)', () => {
    const d = makeFreshDetector();
    for (let i = 0; i < 10; i++) {
      d.recordEvent('u', 'data.export', undefined, NOW + i);
    }
    expect(d.getSummary('u', NOW + 20).indicators).toContain('excessive_exports');
  });

  it('flags injection attempts immediately (threshold=1)', () => {
    const d = makeFreshDetector();
    d.recordEvent('u', 'input.injection', undefined, NOW);
    const s = d.getSummary('u', NOW + 1);
    expect(s.indicators).toContain('injection_attempts');
    expect(s.suspicious).toBe(true);
  });

  it('accumulates score from multiple indicators', () => {
    const d = makeFreshDetector();
    for (let i = 0; i < 5; i++) d.recordEvent('u', 'auth.failure', undefined, NOW + i);
    d.recordEvent('u', 'input.injection', undefined, NOW + 10);
    const s = d.getSummary('u', NOW + 20);
    // excessive_auth_failures (55) + injection_attempts (60) = 115
    expect(s.score).toBeGreaterThanOrEqual(100);
  });

  it('summary includes ISO timestamps', () => {
    const d = makeFreshDetector();
    const s = d.getSummary('u', NOW);
    expect(typeof s.windowStartIso).toBe('string');
    expect(typeof s.evaluatedAtIso).toBe('string');
    expect(Number.isNaN(Date.parse(s.windowStartIso))).toBe(false);
    expect(Number.isNaN(Date.parse(s.evaluatedAtIso))).toBe(false);
  });
});

describe('ThreatDetector.isSuspicious', () => {
  it('returns false when below threshold', () => {
    const d = makeFreshDetector();
    expect(d.isSuspicious('u', NOW)).toBe(false);
  });

  it('returns true when at or above threshold', () => {
    const d = makeFreshDetector({ scoreThreshold: 10 });
    d.recordEvent('u', 'unusual.time', undefined, NOW); // weight 10
    expect(d.isSuspicious('u', NOW + 1)).toBe(true);
  });
});

describe('ThreatDetector sliding window', () => {
  it('ignores events outside the window', () => {
    const windowMs = 60_000;
    const d = makeFreshDetector({ windowMs });
    // Record 5 auth failures at time NOW
    for (let i = 0; i < 5; i++) {
      d.recordEvent('u', 'auth.failure', undefined, NOW + i);
    }
    // Evaluate 2 windows later — events are outside the window
    const summary = d.getSummary('u', NOW + 2 * windowMs);
    expect(summary.eventCounts['auth.failure'] ?? 0).toBe(0);
    expect(summary.indicators).not.toContain('excessive_auth_failures');
  });
});

describe('ThreatDetector.clearUser', () => {
  it('clears all events for a user', () => {
    const d = makeFreshDetector();
    for (let i = 0; i < 5; i++) d.recordEvent('u', 'auth.failure', undefined, NOW + i);
    expect(d.isSuspicious('u', NOW + 10)).toBe(true);
    d.clearUser('u');
    expect(d.isSuspicious('u', NOW + 10)).toBe(false);
  });

  it('does not affect other users', () => {
    const d = makeFreshDetector();
    for (let i = 0; i < 5; i++) d.recordEvent('alice', 'auth.failure', undefined, NOW + i);
    d.recordEvent('bob', 'auth.failure', undefined, NOW);
    d.clearUser('alice');
    expect(d.getSummary('bob', NOW + 1).eventCounts['auth.failure']).toBe(1);
  });
});

describe('ThreatDetector.pruneExpired', () => {
  it('removes events outside the window without affecting recent ones', () => {
    const windowMs = 60_000;
    const d = makeFreshDetector({ windowMs });
    // Old events recorded at NOW (before the window)
    for (let i = 0; i < 5; i++) {
      d.recordEvent('u', 'auth.failure', undefined, NOW + i);
    }
    const future = NOW + 2 * windowMs; // 2 minutes later — old events expired
    d.pruneExpired(future);
    // Recent event recorded just before evaluation point
    d.recordEvent('u', 'auth.success', undefined, future - 1);
    expect(d.getSummary('u', future).eventCounts['auth.failure'] ?? 0).toBe(0);
    expect(d.getSummary('u', future).eventCounts['auth.success']).toBe(1);
  });
});

describe('globalThreatDetector singleton', () => {
  it('is exported and is an instance of ThreatDetector', () => {
    expect(globalThreatDetector).toBeInstanceOf(ThreatDetector);
  });
});

describe('multiple event types in combination', () => {
  const THREAT_TYPES: ThreatEventType[] = [
    'auth.failure',
    'auth.success',
    'auth.mfa_bypass',
    'data.export',
    'data.bulk_read',
    'data.delete',
    'admin.access',
    'unusual.time',
    'rapid.request',
    'input.injection',
  ];

  it('accepts all defined event types without throwing', () => {
    const d = makeFreshDetector();
    THREAT_TYPES.forEach((type, i) => {
      expect(() => d.recordEvent('u', type, undefined, NOW + i)).not.toThrow();
    });
  });
});
