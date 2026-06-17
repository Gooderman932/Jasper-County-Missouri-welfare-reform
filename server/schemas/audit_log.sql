-- Append-only audit log table — HIPAA §164.312(b) Audit Controls.
-- Provision via Appwrite Console (or extend scripts/provision-appwrite.ts).
-- This file documents the intended schema; Appwrite ports of these fields are:
--   id              -> document $id
--   occurredAt      -> string (ISO 8601), indexed DESC
--   actorId         -> string, indexed
--   actorRole       -> string
--   action          -> string, indexed (e.g. "case.read")
--   resourceType    -> string
--   resourceId      -> string, indexed
--   outcome         -> string ("success" | "denied" | "error")
--   requestId       -> string
--   oldValue        -> string (JSON-stringified or null)
--   newValue        -> string (JSON-stringified or null)
--   extra           -> string (JSON-stringified or null)
--
-- Permissions:
--   create: role:server      (the audit helper writes from server context only)
--   read:   role:admin       (admins can investigate; everyone else: never)
--   update: none             (append-only)
--   delete: none             (append-only; retention enforced by archive job)

CREATE TABLE audit_log (
  id           BIGSERIAL PRIMARY KEY,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id     TEXT,
  actor_role   TEXT,
  action       TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id  TEXT,
  outcome      TEXT NOT NULL,
  request_id   TEXT,
  old_value    JSONB,
  new_value    JSONB,
  extra        JSONB
);

CREATE INDEX audit_log_actor_idx    ON audit_log (actor_id, occurred_at DESC);
CREATE INDEX audit_log_resource_idx ON audit_log (resource_type, resource_id, occurred_at DESC);
CREATE INDEX audit_log_action_idx   ON audit_log (action, occurred_at DESC);
