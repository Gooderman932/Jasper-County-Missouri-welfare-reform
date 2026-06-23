import {
  sanitizeText,
  stripTags,
  validateEmail,
  validateCaseNumber,
  validateUuid,
  detectInjectionAttempt,
  assertSafeInput,
  InputValidationError,
  MAX_TEXT_LENGTH,
  MAX_EMAIL_LENGTH,
} from '../inputSanitizer';

describe('sanitizeText', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(42)).toBe('');
    expect(sanitizeText({})).toBe('');
  });

  it('passes through clean text unchanged', () => {
    expect(sanitizeText('Hello, world!')).toBe('Hello, world!');
  });

  it('strips C0 control characters', () => {
    // NUL, BEL, BS, FF, etc. should be removed
    expect(sanitizeText('\x00hello\x07world\x0C')).toBe('helloworld');
  });

  it('preserves newline (LF), carriage return (CR), and tab (HT)', () => {
    const input = 'line1\nline2\r\nline3\t';
    expect(sanitizeText(input)).toBe(input);
  });

  it('strips DEL character (0x7F)', () => {
    expect(sanitizeText('abc\x7Fdef')).toBe('abcdef');
  });

  it('truncates to maxLength', () => {
    const long = 'a'.repeat(MAX_TEXT_LENGTH + 100);
    const result = sanitizeText(long);
    expect(result.length).toBe(MAX_TEXT_LENGTH);
  });

  it('respects a custom maxLength', () => {
    const result = sanitizeText('hello world', 5);
    expect(result).toBe('hello');
  });
});

describe('stripTags', () => {
  it('removes HTML tags', () => {
    expect(stripTags('<b>bold</b>')).toBe('bold');
    expect(stripTags('<script>alert(1)</script>')).toBe('alert(1)');
    expect(stripTags('<img src="x" onerror="evil()">')).toBe('');
  });

  it('leaves plain text unchanged', () => {
    expect(stripTags('no tags here')).toBe('no tags here');
  });
});

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('matthew@example.com')).toBe(true);
    expect(validateEmail('user+tag@sub.domain.org')).toBe(true);
    expect(validateEmail('a@b.io')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('user@domain')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(42)).toBe(false);
  });

  it('rejects overly long emails', () => {
    const long = 'a'.repeat(MAX_EMAIL_LENGTH) + '@example.com';
    expect(validateEmail(long)).toBe(false);
  });
});

describe('validateCaseNumber', () => {
  it('accepts SD-prefix appellate numbers', () => {
    expect(validateCaseNumber('SD38180')).toBe(true);
    expect(validateCaseNumber('SD123')).toBe(true);
  });

  it('accepts juvenile division docket numbers', () => {
    expect(validateCaseNumber('22AO-JU00003')).toBe(true);
    expect(validateCaseNumber('21A0-JU00003')).toBe(true);
    expect(validateCaseNumber('22AO-JU00288')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(validateCaseNumber('not-a-case')).toBe(false);
    expect(validateCaseNumber('SD')).toBe(false);
    expect(validateCaseNumber('')).toBe(false);
    expect(validateCaseNumber(null)).toBe(false);
  });
});

describe('validateUuid', () => {
  it('accepts valid UUIDv4', () => {
    expect(validateUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(validateUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
  });

  it('rejects non-UUID strings', () => {
    expect(validateUuid('not-a-uuid')).toBe(false);
    expect(validateUuid('550e8400e29b41d4a716446655440000')).toBe(false); // no dashes
  });

  it('rejects non-string values', () => {
    expect(validateUuid(null)).toBe(false);
    expect(validateUuid(42)).toBe(false);
  });
});

describe('detectInjectionAttempt', () => {
  it('returns clean for normal text', () => {
    expect(detectInjectionAttempt('Hello, Kody').clean).toBe(true);
    expect(detectInjectionAttempt('Case review for SD38180').clean).toBe(true);
  });

  it('detects SQL keywords', () => {
    const r = detectInjectionAttempt("'; DROP TABLE cases; --");
    expect(r.clean).toBe(false);
    expect(r.matchedLabels).toContain('sql_keyword');
    expect(r.matchedLabels).toContain('sql_comment');
  });

  it('detects SQL comment sequences', () => {
    expect(detectInjectionAttempt('admin --').clean).toBe(false);
    expect(detectInjectionAttempt('/* comment */').clean).toBe(false);
  });

  it('detects <script> tags', () => {
    const r = detectInjectionAttempt('<script>alert(1)</script>');
    expect(r.clean).toBe(false);
    expect(r.matchedLabels).toContain('script_tag');
  });

  it('detects event handler attributes', () => {
    const r = detectInjectionAttempt('<img onerror=alert(1)>');
    expect(r.clean).toBe(false);
    expect(r.matchedLabels).toContain('event_handler');
  });

  it('detects path traversal', () => {
    expect(detectInjectionAttempt('../../etc/passwd').clean).toBe(false);
  });

  it('detects null bytes', () => {
    expect(detectInjectionAttempt('abc\x00def').clean).toBe(false);
  });

  it('detects CRLF injection', () => {
    expect(detectInjectionAttempt('header\r\nX-Injected: value').clean).toBe(false);
  });

  it('is idempotent across multiple calls (no regex lastIndex leakage)', () => {
    const input = "'; DROP TABLE users; --";
    // Calling twice must return the same result (tests for stateful global regex bug)
    expect(detectInjectionAttempt(input).clean).toBe(false);
    expect(detectInjectionAttempt(input).clean).toBe(false);
  });
});

describe('assertSafeInput', () => {
  it('returns sanitized value for clean input', () => {
    expect(assertSafeInput('Hello world', 'notes')).toBe('Hello world');
  });

  it('throws InputValidationError for injection attempts', () => {
    expect(() => assertSafeInput("'; DROP TABLE cases; --", 'field')).toThrow(InputValidationError);
  });

  it('thrown error contains field name and reason', () => {
    try {
      assertSafeInput('<script>evil()</script>', 'description');
    } catch (err) {
      expect(err).toBeInstanceOf(InputValidationError);
      expect((err as InputValidationError).field).toBe('description');
      expect((err as InputValidationError).message).toMatch('description');
    }
  });

  it('respects custom maxLength', () => {
    const result = assertSafeInput('hello world', 'field', 5);
    expect(result).toBe('hello');
  });
});
