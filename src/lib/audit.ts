/**
 * Audit-log helper. Writes append-only records to the audit_log collection.
 *
 * Required by HIPAA §164.312(b) (Audit Controls). Call logAudit() before
 * returning PHI from any read endpoint and after every PHI mutation.
 */

import type { AuthedUser } from "./authz";

export interface AuditEntry {
  actor: AuthedUser | null;
  action: string; // e.g. "case.read", "case.update", "export.create"
  resourceType: string; // e.g. "case_record"
  resourceId: string | null;
  outcome: "success" | "denied" | "error";
  requestId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  extra?: Record<string, unknown>;
}

export interface AuditSink {
  write(entry: AuditEntry & { occurredAt: string }): Promise<void>;
}

let sink: AuditSink | null = null;

export function configureAuditSink(s: AuditSink) {
  sink = s;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const record = {
    ...entry,
    occurredAt: new Date().toISOString(),
  };
  if (sink) {
    try {
      await sink.write(record);
    } catch (err) {
      // Never throw from audit — we still want the original operation to complete,
      // but a failure to log is itself loggable. Fall back to stderr.
      console.error("[audit] sink write failed:", err, record);
    }
  } else {
    // Default sink: stderr (development).
    console.log("[audit]", JSON.stringify(record));
  }
}
