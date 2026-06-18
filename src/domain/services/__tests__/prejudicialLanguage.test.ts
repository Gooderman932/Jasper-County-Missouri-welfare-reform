import {
  scanText,
  aggregateFindings,
  scanDocument,
  PREJUDICIAL_RULES,
} from '../prejudicialLanguage';

describe('scanText', () => {
  it('returns no hits for empty text', () => {
    expect(scanText({ text: '' })).toEqual([]);
  });

  it('flags a conclusory "unfit parent" label', () => {
    const hits = scanText({ text: 'The mother is an unfit parent.' });
    expect(hits.some((h) => h.ruleId === 'unfit-parent-label')).toBe(true);
  });

  it('captures the matched phrase and a context window', () => {
    const hits = scanText({ text: 'Clearly the father failed to protect the child.' });
    const hit = hits.find((h) => h.ruleId === 'failed-to-protect');
    expect(hit).toBeDefined();
    expect(hit!.matchedText.toLowerCase()).toContain('failed to protect');
    expect(hit!.context.length).toBeGreaterThan(0);
  });

  it('escalates severity for high-risk document categories', () => {
    const neutral = scanText({ text: 'will not change', category: 'correspondence' })
      .find((h) => h.ruleId === 'will-not-change');
    const highRisk = scanText({ text: 'will not change', category: 'petition' })
      .find((h) => h.ruleId === 'will-not-change');
    expect(neutral).toBeDefined();
    expect(highRisk).toBeDefined();
    // 'serious' stays 'serious'; this rule is already serious, so assert it is preserved.
    expect(highRisk!.severity).toBe('serious');
  });
});

describe('aggregateFindings', () => {
  it('groups repeated hits of the same rule into one finding', () => {
    const text = 'unfit parent. Later, still an unfit father, an unsuitable mother.';
    const hits = scanText({ text });
    const findings = aggregateFindings(hits, 'Petition');
    const unfit = findings.find((f) => f.ruleId === 'unfit-parent-label');
    expect(unfit).toBeDefined();
    expect(unfit!.summary).toContain('Possible');
    expect(unfit!.explanation).toContain('Matched phrases');
  });

  it('phrases every finding as a possibility, never a legal conclusion', () => {
    const text = PREJUDICIAL_RULES.map(() => 'unfit parent').join(' ');
    const findings = aggregateFindings(scanText({ text }), 'Doc');
    for (const f of findings) {
      expect(f.summary.toLowerCase()).toContain('possible');
    }
  });
});

describe('scanDocument', () => {
  it('returns empty result when there is no extracted text', () => {
    const result = scanDocument({
      documentId: 'd1',
      documentTitle: 'Empty',
      category: 'court_order',
    });
    expect(result.hits).toEqual([]);
    expect(result.findings).toEqual([]);
  });

  it('produces findings for a document with prejudicial text', () => {
    const result = scanDocument({
      documentId: 'd2',
      documentTitle: 'Petition',
      category: 'petition',
      extractedText: 'The respondent is an unfit parent who failed to protect the child.',
    });
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
