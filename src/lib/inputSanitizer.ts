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
 *
 * Note on CRLF injection: `detectInjectionAttempt` does NOT flag `\r\n`
 * because that is a normal line ending in multi-line free text from Windows
 * clients. CRLF injection concerns (HTTP header splitting) apply only to
 * single-line header fields; callers handling such fields should strip `\r`
 * explicitly before passing to downstream HTTP libraries.
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
  // and the DEL character (7F).
  // eslint-disable-next-line no-control-regex
  let out = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (out.length > maxLength) {
    out = out.slice(0, maxLength);
  }
  return out;
}

/**
 * Strips HTML/XML tags from a string using a simple regex.
 *
 * WARNING: This is a best-effort helper for plain-text fields and is NOT a
 * security-grade XSS filter — crafted inputs with nested or malformed tags can
 * bypass it. Do not rely on this alone for rendering user content in HTML
 * contexts; use a dedicated sanitization library (e.g. sanitize-html) there.
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
  // A deliberately conservative pattern — avoids exotic valid-but-rare forms.
  // Note: the hyphen is intentionally last in the character class to avoid
  // being interpreted as a range.
  return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(trimmed); // eslint-disable-line no-useless-escape
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

/**
 * Validates a UUID v4 string.
 *
 * Note: Appwrite's native `ID.unique()` generates 20-character alphanumeric
 * strings, not UUID v4. Use this function only for fields that explicitly
 * store UUID v4 values. For Appwrite document IDs, validate with
 * `/^[a-zA-Z0-9]{20}$/` or use `validateDocumentId` below.
 */
export function validateUuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Validates a document identifier that may be either a UUID v4 or an Appwrite
 * native ID (20-character base62 alphanumeric string produced by `ID.unique()`).
 */
export function validateDocumentId(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return validateUuid(value) || /^[a-zA-Z0-9]{20}$/.test(value);
}

// ---------------------------------------------------------------------------
// Injection detection
// ---------------------------------------------------------------------------

interface InjectionPattern {
  label: string;
  re: RegExp;
}

// Known HTML event-handler attribute names. Using an explicit list avoids
// the false-positive problem of `\bon\w+\s*=` matching "online =", "one =", etc.
const HTML_EVENT_HANDLERS =
  'onclick|ondblclick|onmousedown|onmouseup|onmousemove|onmouseover|onmouseout|' +
  'onkeydown|onkeyup|onkeypress|onload|onunload|onabort|onerror|onresize|' +
  'onscroll|onchange|onsubmit|onreset|onfocus|onblur|oncontextmenu|oninput|' +
  'onformdata|ondrag|ondrop|onpaste|oncut|oncopy';

const INJECTION_PATTERNS: InjectionPattern[] = [
  // SQL injection: keyword must appear in a SQL-structural context to avoid
  // flagging common English words ("select", "delete", "create", "grant", etc.).
  // Three patterns are detected:
  //   1. UNION SELECT  — almost never appears in normal prose
  //   2. EXEC/EXECUTE followed by "(" — stored-procedure call syntax
  //   3. SQL keyword preceded by ";" or '"' — classic injection after terminator
  {
    label: 'sql_injection',
    re: /\bUNION\s+SELECT\b|\bEXEC(UTE)?(\s+\w+)?\s*\(|[;"]\s*\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE)\b/i,
  },
  // SQL comment sequences (-- and /* */ are almost never in legitimate prose)
  { label: 'sql_comment', re: /--|\/\*|\*\// },
  // <script> tag (SVG inline scripts, JSONP callbacks, etc.)
  { label: 'script_tag', re: /<\s*script[^>]*>/i },
  // HTML event handler attributes — explicit allowlist to prevent false positives
  { label: 'event_handler', re: new RegExp(`\\b(${HTML_EVENT_HANDLERS})\\s*=`, 'i') },
  // Path traversal
  { label: 'path_traversal', re: /\.\.[/\\]/ },
  // Null byte injection (intentional control character match)
  // eslint-disable-next-line no-control-regex
  { label: 'null_byte', re: /\x00/ },
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
