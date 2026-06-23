/**
 * Input validation and sanitization — NIST SP 800-53 SI-10 (Information Input Validation).
 *
 * SI-10 requires the system to check the validity of information inputs for
 * accuracy, completeness, validity, and authenticity. Every field that arrives
 * from a user or external source must be run through this layer before being
 * stored, rendered, or passed to a downstream system.
 *
 * Responsibilities:
 *   - Strip dangerous control characters
 *   - Enforce field-level length limits
 *   - Detect injection attempt patterns (SQL, script, path traversal)
 *   - Validate domain-specific formats (email, case numbers)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_TEXT_LENGTH = 10_000;
export const MAX_SHORT_TEXT_LENGTH = 500;
export const MAX_EMAIL_LENGTH = 254; // RFC 5321 §4.5.3

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

/**
 * Strips ASCII control characters (except HT \x09, LF \x0A, CR \x0D) and
 * truncates to `maxLength`. Safe to call on any untrusted string field.
 */
export function sanitizeText(input: unknown, maxLength: number = MAX_TEXT_LENGTH): string {
  if (typeof input !== 'string') return '';
  // Remove C0 control characters except TAB (09), LF (0A), CR (0D)
  // and the DEL character (7F)
  let out = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (out.length > maxLength) {
    out = out.slice(0, maxLength);
  }
  return out;
}

/**
 * Strips HTML/XML tags from a string. Use when a field must be plain-text
 * only and the value will later be rendered in a web context.
 */
export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

// ---------------------------------------------------------------------------
// Format validation
// ---------------------------------------------------------------------------

/** Validates an email address per RFC 5321 / RFC 5322 common subset. */
export function validateEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > MAX_EMAIL_LENGTH) return false;
  // A deliberately conservative pattern — avoids exotic valid-but-rare forms
  return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(trimmed);
}

/**
 * Validates a Missouri court case number in the formats seen in Jasper County
 * child-welfare and appellate dockets:
 *   SD38180      — Southern District appellate cause number
 *   22AO-JU00003 — Juvenile division docket (year + division + type + sequence)
 *   21A0-JU00003 — Alternate alpha-zero prefix form
 */
export function validateCaseNumber(caseNo: unknown): boolean {
  if (typeof caseNo !== 'string') return false;
  const trimmed = caseNo.trim();
  const patterns = [
    /^SD\d{3,8}$/,                          // SD38180
    /^\d{2}[A-Z]{1,2}\d?-[A-Z]{2}\d{4,8}$/, // 22AO-JU00003, 21A0-JU00003
  ];
  return patterns.some(p => p.test(trimmed));
}

/** Validates a UUID v4 (used for Appwrite document IDs). */
export function validateUuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// ---------------------------------------------------------------------------
// Injection detection
// ---------------------------------------------------------------------------

interface InjectionPattern {
  label: string;
  re: RegExp;
}

const INJECTION_PATTERNS: InjectionPattern[] = [
  // SQL DML / DDL keywords — require word boundary so "select" in prose is ignored
  {
    label: 'sql_keyword',
    re: /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|CAST|CONVERT|DECLARE|TRUNCATE|GRANT|REVOKE)\b/i,
  },
  // SQL comment sequences
  { label: 'sql_comment', re: /--|\/\*|\*\// },
  // <script> tag (SVG inline scripts, JSONP callbacks, etc.)
  { label: 'script_tag', re: /<\s*script[^>]*>/i },
  // JavaScript event handler attributes
  { label: 'event_handler', re: /\bon\w+\s*=/i },
  // Path traversal
  { label: 'path_traversal', re: /\.\.[/\\]/ },
  // Null byte injection
  { label: 'null_byte', re: /\x00/ },
  // CRLF injection
  { label: 'crlf_injection', re: /\r\n|\r(?!\n)/ },
];

export interface InjectionScanResult {
  /** True when no injection patterns were detected. */
  clean: boolean;
  /** Labels of patterns that matched (empty when clean). */
  matchedLabels: string[];
}

/**
 * Scans `input` for known injection patterns and returns a result.
 * Does NOT modify the input — use `sanitizeText` for that.
 */
export function detectInjectionAttempt(input: string): InjectionScanResult {
  const matchedLabels: string[] = [];
  for (const { label, re } of INJECTION_PATTERNS) {
    if (re.test(input)) {
      matchedLabels.push(label);
    }
  }
  return { clean: matchedLabels.length === 0, matchedLabels };
}

// ---------------------------------------------------------------------------
// Combined assertion
// ---------------------------------------------------------------------------

export class InputValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`Input validation failed for '${field}': ${reason}`);
    this.name = 'InputValidationError';
  }
}

/**
 * Sanitizes, length-checks, and injection-scans a string field in one call.
 * Returns the sanitized value on success; throws `InputValidationError` on failure.
 *
 * Use at every external boundary — API request handler, form submission, etc.
 */
export function assertSafeInput(
  input: unknown,
  fieldName: string,
  maxLength: number = MAX_TEXT_LENGTH,
): string {
  const text = sanitizeText(input, maxLength);
  const { clean, matchedLabels } = detectInjectionAttempt(text);
  if (!clean) {
    throw new InputValidationError(fieldName, `suspicious pattern(s): ${matchedLabels.join(', ')}`);
  }
  return text;
}
