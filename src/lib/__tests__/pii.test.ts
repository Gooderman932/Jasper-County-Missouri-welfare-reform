import { maskSSN, maskPhone, maskEmail, maskAccountNumber, redactForLogs } from '../pii';

describe('pii masking', () => {
  it('masks SSN to last 4', () => {
    expect(maskSSN('123-45-6789')).toBe('***-**-6789');
    expect(maskSSN('123456789')).toBe('***-**-6789');
  });

  it('handles short / empty SSN safely', () => {
    expect(maskSSN('12')).toBe('***-**-****');
    expect(maskSSN('')).toBe('');
    expect(maskSSN(null)).toBe('');
    expect(maskSSN(undefined)).toBe('');
  });

  it('masks phone to last 4', () => {
    expect(maskPhone('(417) 555-1234')).toBe('(***) ***-1234');
    expect(maskPhone('')).toBe('');
  });

  it('masks email keeping domain', () => {
    expect(maskEmail('matthew@example.com')).toBe('ma***@example.com');
    expect(maskEmail('a@b.com')).toBe('a@b.com');
    expect(maskEmail('not-an-email')).toBe('***');
  });

  it('masks account numbers to last 4', () => {
    expect(maskAccountNumber('1234567890')).toBe('****7890');
    expect(maskAccountNumber('12')).toBe('****');
  });
});

describe('redactForLogs', () => {
  it('strips SSNs, phones, and emails from free text', () => {
    const input = 'SSN 123-45-6789 phone 417-555-1234 email a@b.com';
    const out = redactForLogs(input);
    expect(out).toContain('[REDACTED-SSN]');
    expect(out).toContain('[REDACTED-PHONE]');
    expect(out).toContain('[REDACTED-EMAIL]');
    expect(out).not.toContain('123-45-6789');
    expect(out).not.toContain('a@b.com');
  });
});
