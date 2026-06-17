// Redaction config for the SD38180 reference case. Used by both the publish
// flow (when matthew@ presses "Publish") AND by the migration script that
// seeds SD38180 into the production Appwrite database.
//
// Edit the redaction policy or identity registry HERE — don't fork them.

import { IdentityRule, RedactionContext } from '@domain/services/redaction';
import { RedactionPolicy } from '@domain/entities';

export const SD38180_REDACTION_POLICY: RedactionPolicy = {
  childPii: 'initials_birthyear',
  ownerPii: 'initials_city',
  thirdParties: 'public_full_private_initials',
  documents: 'all_visible',
};

/**
 * Public form for each known person/entity. Order matters: longer aliases
 * must come BEFORE shorter ones so we don't half-redact (e.g. "Matthew
 * Preston Goodman" must match before "Matthew Goodman" or "Goodman").
 */
export const SD38180_IDENTITIES: IdentityRule[] = [
  // --- Self (appellant) ---
  {
    aliases: [
      'Matthew Preston Goodman',
      'Matthew P. Goodman',
      'Matthew P Goodman',
      'Matthew Goodman',
      'M. P. Goodman',
      'M.P. Goodman',
    ],
    publicForm: 'M.P.G.',
    category: 'self',
  },
  // --- Child ---
  {
    aliases: ['Kody Carter Goodman', 'Kody C. Goodman', 'Kody Goodman', 'Kody'],
    publicForm: 'K.C.G.',
    category: 'child',
  },
  // --- Public officials (kept by full name) ---
  // Listed so the redactor knows NOT to scrub them.
  { aliases: ['Hon. Angela Vorhees', 'Judge Angela Vorhees', 'Judge Vorhees', 'Angela Vorhees'], publicForm: 'Judge Angela Vorhees', category: 'public_official' },
  { aliases: ['Sharon K. Rogers', 'Sharon Rogers'], publicForm: 'Sharon K. Rogers (Court Reporter)', category: 'public_official' },
  // --- Private parties (initials + role) ---
  // Caseworkers / private attorneys / non-party witnesses.
  // Add NEW entries below as new names appear in evidence.
  { aliases: ['Wolf-Miller', 'Wolf Miller'], publicForm: '[Caseworker W-M]', category: 'private_party' },
  { aliases: ['Emmons'], publicForm: '[Caseworker E.]', category: 'private_party' },
  { aliases: ['Riley'], publicForm: '[Caseworker R.]', category: 'private_party' },
];

/** Known child DOBs to fold to year-only under the child policy. */
export const SD38180_MINOR_DOBS: string[] = ['2018-10-13', '10/13/2018'];

export function makeSd38180RedactionContext(): RedactionContext {
  return {
    policy: SD38180_REDACTION_POLICY,
    identities: SD38180_IDENTITIES,
    minorDobs: SD38180_MINOR_DOBS,
  };
}

export const SD38180_PUBLIC_TITLE =
  'SD38180 — TPR Appeal (Jasper County, Missouri)';

export const SD38180_PUBLIC_SUMMARY = `
Termination-of-parental-rights appeal pending before the Missouri Court of Appeals, Southern District (Case No. SD38180). This reference case is published by the appellant under his own consent as an example of how the Family Rights App structures evidence, timeline events, and procedural issue flags.

**Important:** This is appellant's own organized presentation of the record. It is not a court ruling, not a legal conclusion, and not an admission by any party named. Every issue is phrased as a "possible … to review."

The child is identified as K.C.G., born 2018. The appellant is identified as M.P.G., Baxter Springs KS. Public officials acting in their official capacity (the trial judge, court reporter) are named; private parties (caseworkers, non-party witnesses) are shown by initials and role.

Lower-court case numbers: 22AO-JU00288 (subject child) and 22AO-JU00287 (sibling). TPR trial held 6/27/2023 before Judge Angela Vorhees, transcribed by Sharon K. Rogers (Holliday Reporting, 131 pp.).
`.trim();
