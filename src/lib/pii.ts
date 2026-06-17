/**
 * PII masking helpers. Required for HIPAA-adjacent data shown in the UI.
 *
 * Rule: never display full SSN, full phone, full account number, or full
 * Medicare/Medicaid number in any rendered surface. Raw values are stored
 * only in encrypted blob fields and accessed by the server through
 * `assertCanReadPHI` checks.
 */

export function maskSSN(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "***-**-****";
  return `***-**-${digits.slice(-4)}`;
}

export function maskPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "(***) ***-****";
  return `(***) ***-${digits.slice(-4)}`;
}

export function maskEmail(value: string | null | undefined): string {
  if (!value) return "";
  const [user, domain] = value.split("@");
  if (!domain) return "***";
  const visible = user.length <= 2 ? user[0] ?? "*" : `${user.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

export function maskAccountNumber(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "****";
  return `****${value.slice(-4)}`;
}

/**
 * Redacts a free-text blob of obvious PII markers. Use only for log lines /
 * crash reports — never for persisted business data.
 */
export function redactForLogs(value: string): string {
  return value
    .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, "[REDACTED-SSN]")
    .replace(/\b\d{3}[ .-]?\d{3}[ .-]?\d{4}\b/g, "[REDACTED-PHONE]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[REDACTED-EMAIL]");
}
