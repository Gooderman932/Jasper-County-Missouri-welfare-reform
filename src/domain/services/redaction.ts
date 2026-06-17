// Pure-function redaction helpers used by the publish flow AND the SD38180
// reference-case migration. No SDK / RN imports.
//
// The intent is NOT to be a perfect PII scrubber — it's an opinionated
// best-effort transform that applies the user's chosen RedactionPolicy.
// Users are still warned to review the result before going public.

import { CaseEvent, CaseParty, DocumentRecord, IssueFlag, RedactionPolicy } from '../entities';

// ---------------------------------------------------------------------------
// Pattern library
// ---------------------------------------------------------------------------

// Phone numbers (US-ish: 10 digits with optional separators / +1 prefix)
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

// Email addresses
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// US-style street addresses: "8681 SE 71ST ST", "123 Main Street", etc.
// Number + 1-4 words + street suffix. Captures common abbreviations.
const STREET_ADDR_RE =
  /\b\d{1,6}\s+(?:[NSEW]{1,2}\s+)?[A-Za-z0-9][A-Za-z0-9.\s]{0,40}?\s+(?:ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|BOULEVARD|DR|DRIVE|LN|LANE|CT|COURT|PL|PLACE|WAY|HWY|HIGHWAY|TRAIL|TRL|PKWY|PARKWAY|CIR|CIRCLE|TER|TERRACE)\b\.?/gi;

// US SSN (XXX-XX-XXXX)
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;

// ISO date like 2018-10-13
const ISO_DATE_RE = /\b(19|20)\d{2}-\d{2}-\d{2}\b/g;

// US date like 10/13/2018 or 10-13-2018
const US_DATE_RE = /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/g;

// ---------------------------------------------------------------------------
// Identity registry — known names → preferred public form
// ---------------------------------------------------------------------------

export interface IdentityRule {
  /** Aliases this person/entity is referenced by in source text. Case-insensitive. */
  aliases: string[];
  /** What to replace any alias match with when redacting. */
  publicForm: string;
  /** Used to decide whether `thirdParties` policy applies. */
  category: 'self' | 'child' | 'public_official' | 'private_party';
}

/** Apply ALL identity rules to a string. */
export function applyIdentities(text: string, rules: IdentityRule[]): string {
  let out = text;
  for (const rule of rules) {
    for (const alias of rule.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, 'gi');
      out = out.replace(re, rule.publicForm);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scrubbing primitives
// ---------------------------------------------------------------------------

export function scrubPhones(text: string): string {
  return text.replace(PHONE_RE, '[phone redacted]');
}
export function scrubEmails(text: string): string {
  return text.replace(EMAIL_RE, '[email redacted]');
}
export function scrubStreetAddresses(text: string): string {
  return text.replace(STREET_ADDR_RE, '[address redacted]');
}
export function scrubSsns(text: string): string {
  return text.replace(SSN_RE, '[SSN redacted]');
}

/** When child policy hides DOB, reduce dates to year-only. */
export function scrubMinorDobs(text: string, minorDobs: string[]): string {
  let out = text;
  for (const dob of minorDobs) {
    // dob can be ISO (2018-10-13) or US (10/13/2018) — handle both
    const year = dob.slice(0, 4).match(/^\d{4}$/) ? dob.slice(0, 4) : dob.slice(-4);
    const isoEsc = dob.replace(/[-]/g, '[-/]');
    out = out.replace(new RegExp(`\\b${isoEsc}\\b`, 'g'), `${year}`);
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(dob)) {
      const usPattern = dob.replace(/\//g, '\\/');
      out = out.replace(new RegExp(`\\b${usPattern}\\b`, 'g'), year);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Top-level redactor
// ---------------------------------------------------------------------------

export interface RedactionContext {
  policy: RedactionPolicy;
  identities: IdentityRule[];
  /** Known minor DOBs to fold to year-only when policy hides DOB. */
  minorDobs?: string[];
}

export function redactText(input: string, ctx: RedactionContext): string {
  let out = input;
  // Always strip SSNs regardless of policy.
  out = scrubSsns(out);
  // Identity substitutions FIRST so we don't redact "Matthew Goodman" away
  // before we can convert it to "M.P.G."
  out = applyIdentities(out, ctx.identities);
  if (ctx.policy.ownerPii === 'initials_city' || ctx.policy.ownerPii === 'name_only') {
    out = scrubStreetAddresses(out);
    out = scrubPhones(out);
    out = scrubEmails(out);
  }
  if (ctx.policy.childPii === 'initials_only' || ctx.policy.childPii === 'initials_birthyear') {
    out = scrubMinorDobs(out, ctx.minorDobs ?? []);
  }
  return out;
}

export function redactEvent(event: CaseEvent, ctx: RedactionContext): CaseEvent {
  return { ...event, description: redactText(event.description, ctx) };
}

export function redactIssueFlag(flag: IssueFlag, ctx: RedactionContext): IssueFlag {
  return {
    ...flag,
    summary: redactText(flag.summary, ctx),
    explanation: redactText(flag.explanation, ctx),
  };
}

/**
 * Redact a DocumentRecord's TEXT fields (title, extractedText, tags).
 * Important caveat: the underlying file bytes (PDF/JPEG/etc.) are NOT
 * modified by this function — they cannot be safely rewritten from TS.
 * The publish flow surfaces this as a warning and offers two options:
 *   1. Show titles only (file not downloadable publicly) — safest
 *   2. Show file but with redacted extractedText overlay + warning banner
 *      "Original file may contain unredacted information."
 */
export function redactDocument(doc: DocumentRecord, ctx: RedactionContext): DocumentRecord {
  return {
    ...doc,
    title: redactText(doc.title, ctx),
    extractedText: doc.extractedText ? redactText(doc.extractedText, ctx) : doc.extractedText,
    tags: doc.tags.map((t) => redactText(t, ctx)),
  };
}

/**
 * Inspect a document and return human-readable warnings if its file bytes
 * may still contain PII even after text-field redaction. Used by the
 * publish flow's pre-flight check.
 */
export function documentRedactionWarnings(
  doc: DocumentRecord,
  ctx: RedactionContext,
): string[] {
  const warnings: string[] = [];
  if (!isDocumentPublicUnderPolicy(doc, ctx.policy)) return warnings;

  // The actual file content (PDF/image/etc.) can't be auto-redacted.
  // Flag anything that commonly embeds PII.
  const sensitiveCategories: Array<DocumentRecord['category']> = [
    'court_order',
    'petition',
    'medical',
    'drug_test',
    'school',
    'transcript',
  ];
  if (sensitiveCategories.includes(doc.category)) {
    warnings.push(
      `"${doc.title}" is a ${doc.category} document. The file itself may contain the child's full name, DOB, or other PII that this tool cannot strip from the original file bytes. Review or replace with a manually redacted version before publishing.`,
    );
  }

  // If extractedText still mentions known identities AFTER redaction, that's
  // a hint the file bytes also still contain those names.
  if (doc.extractedText) {
    const redacted = redactText(doc.extractedText, ctx);
    for (const rule of ctx.identities) {
      if (rule.category === 'child' || rule.category === 'self') {
        for (const alias of rule.aliases) {
          const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          if (re.test(redacted)) {
            warnings.push(
              `"${doc.title}" still references "${alias}" after redaction — the underlying file likely contains this name in its raw bytes.`,
            );
            break;
          }
        }
      }
    }
  }
  return warnings;
}

export function redactParty(party: CaseParty, ctx: RedactionContext): CaseParty {
  return {
    ...party,
    displayLabel: redactText(party.displayLabel, ctx),
    legalName: party.legalName ? redactText(party.legalName, ctx) : party.legalName,
  };
}

// ---------------------------------------------------------------------------
// Document-level visibility selector
// ---------------------------------------------------------------------------

/** Return whether a document should be publicly visible under the policy. */
export function isDocumentPublicUnderPolicy(
  doc: DocumentRecord,
  policy: RedactionPolicy,
): boolean {
  // Per-doc override wins.
  if (doc.visibility === 'private') return false;
  if (doc.visibility === 'public') return true;
  if (policy.documents === 'all_visible') return true;
  if (policy.documents === 'titles_only') return false;
  // titles_and_user_authored: only correspondence/evidence the user authored
  return doc.category === 'correspondence' || doc.category === 'evidence';
}
