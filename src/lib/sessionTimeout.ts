/**
 * Session timeout — HIPAA §164.312(a)(2)(iii) "Automatic Logoff" control.
 * After 30 minutes of inactivity the session is considered expired and
 * the user must re-authenticate.
 */

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export function isSessionExpired(lastActivityMs: number, nowMs: number = Date.now()): boolean {
  return nowMs - lastActivityMs >= SESSION_TIMEOUT_MS;
}

/**
 * Returns ms remaining until session expiry; <=0 means expired.
 */
export function msUntilExpiry(lastActivityMs: number, nowMs: number = Date.now()): number {
  return SESSION_TIMEOUT_MS - (nowMs - lastActivityMs);
}
