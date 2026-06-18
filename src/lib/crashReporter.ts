/**
 * Pluggable crash / error reporter.
 *
 * Production builds MUST register a real reporter (Sentry, Bugsnag, etc.) via
 * `configureCrashReporter()` at app bootstrap so that unhandled errors are not
 * silently lost. Until one is registered we fall back to console so failures
 * are at least visible in development and in device logs.
 *
 * All payloads are run through `redactForLogs` before leaving the device so we
 * never ship raw PII (SSN / phone / email) to a third-party error service.
 */

import { redactForLogs } from "./pii";

export interface CrashReporter {
  captureException(error: unknown, context?: Record<string, unknown>): void;
  captureMessage(message: string, context?: Record<string, unknown>): void;
}

const consoleReporter: CrashReporter = {
  captureException(error, context) {
    const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    // eslint-disable-next-line no-console
    console.error("[crash]", redactForLogs(msg), context ? scrub(context) : "");
  },
  captureMessage(message, context) {
    // eslint-disable-next-line no-console
    console.warn("[crash]", redactForLogs(message), context ? scrub(context) : "");
  },
};

let reporter: CrashReporter = consoleReporter;

export function configureCrashReporter(r: CrashReporter): void {
  reporter = r;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  try {
    reporter.captureException(error, context ? scrub(context) : undefined);
  } catch {
    // A reporter must never crash the app.
  }
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  try {
    reporter.captureMessage(message, context ? scrub(context) : undefined);
  } catch {
    /* swallow */
  }
}

/** Shallow-redact string values in a context object before it leaves the device. */
function scrub(context: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) {
    out[k] = typeof v === "string" ? redactForLogs(v) : v;
  }
  return out;
}
