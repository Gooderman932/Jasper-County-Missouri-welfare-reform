import {
  redactText,
  scrubSsns,
  scrubPhones,
  scrubEmails,
  scrubStreetAddresses,
  scrubMinorDobs,
  applyIdentities,
  isDocumentPublicUnderPolicy,
  type RedactionContext,
  type IdentityRule,
} from '../redaction';
import type { RedactionPolicy, DocumentRecord } from '../../entities';

const fullPolicy: RedactionPolicy = {
  childPii: 'full',
  ownerPii: 'full',
  thirdParties: 'all_full',
  documents: 'all_visible',
};

const strictPolicy: RedactionPolicy = {
  childPii: 'initials_only',
  ownerPii: 'initials_city',
  thirdParties: 'all_initials',
  documents: 'titles_only',
};

describe('scrubbing primitives', () => {
  it('removes SSNs', () => {
    expect(scrubSsns('SSN 123-45-6789 here')).toBe('SSN [SSN redacted] here');
  });

  it('removes phone numbers', () => {
    expect(scrubPhones('call 417-555-1234')).toContain('[phone redacted]');
    expect(scrubPhones('call (417) 555-1234')).toContain('[phone redacted]');
  });

  it('removes emails', () => {
    expect(scrubEmails('reach me at jane.doe@example.com ok')).toContain('[email redacted]');
  });

  it('removes street addresses', () => {
    expect(scrubStreetAddresses('lives at 8681 SE 71ST ST today')).toContain('[address redacted]');
  });
});

describe('scrubMinorDobs', () => {
  it('folds an ISO DOB down to year only', () => {
    expect(scrubMinorDobs('born 2018-10-13 in MO', ['2018-10-13'])).toBe('born 2018 in MO');
  });

  it('folds a US-format DOB down to year only', () => {
    expect(scrubMinorDobs('DOB 10/13/2018', ['10/13/2018'])).toBe('DOB 2018');
  });
});

describe('applyIdentities', () => {
  it('substitutes known aliases with their public form, case-insensitively', () => {
    const rules: IdentityRule[] = [
      { aliases: ['Matthew Goodman', 'Matt Goodman'], publicForm: 'M.P.G.', category: 'self' },
    ];
    expect(applyIdentities('From Matthew Goodman and matt goodman', rules)).toBe('From M.P.G. and M.P.G.');
  });
});

describe('redactText (top-level)', () => {
  const identities: IdentityRule[] = [
    { aliases: ['Kody'], publicForm: 'K.G.', category: 'child' },
  ];

  it('always strips SSNs even under a full (no-redaction) policy', () => {
    const ctx: RedactionContext = { policy: fullPolicy, identities: [] };
    expect(redactText('SSN 123-45-6789', ctx)).toContain('[SSN redacted]');
  });

  it('applies identity substitution before PII scrubbing', () => {
    const ctx: RedactionContext = { policy: strictPolicy, identities, minorDobs: [] };
    const out = redactText('Kody called from 417-555-1234', ctx);
    expect(out).toContain('K.G.');
    expect(out).not.toContain('Kody');
    expect(out).toContain('[phone redacted]');
  });

  it('does not scrub contact info when owner policy is full', () => {
    const ctx: RedactionContext = { policy: fullPolicy, identities: [] };
    const out = redactText('email a@b.com phone 417-555-1234', ctx);
    expect(out).toContain('a@b.com');
    expect(out).toContain('417-555-1234');
  });
});

describe('isDocumentPublicUnderPolicy', () => {
  const baseDoc = { category: 'correspondence' } as DocumentRecord;

  it('respects an explicit per-document private override', () => {
    expect(isDocumentPublicUnderPolicy({ ...baseDoc, visibility: 'private' }, fullPolicy)).toBe(false);
  });

  it('respects an explicit per-document public override', () => {
    expect(isDocumentPublicUnderPolicy({ ...baseDoc, visibility: 'public' }, strictPolicy)).toBe(true);
  });

  it('hides everything under titles_only', () => {
    expect(isDocumentPublicUnderPolicy(baseDoc, strictPolicy)).toBe(false);
  });

  it('shows only user-authored categories under titles_and_user_authored', () => {
    const policy: RedactionPolicy = { ...fullPolicy, documents: 'titles_and_user_authored' };
    expect(isDocumentPublicUnderPolicy({ ...baseDoc, category: 'correspondence' } as DocumentRecord, policy)).toBe(true);
    expect(isDocumentPublicUnderPolicy({ ...baseDoc, category: 'court_order' } as DocumentRecord, policy)).toBe(false);
  });
});
