// ============================================================================
// Prejudicial / Subliminal-Priming Language Detector
// ============================================================================
//
// Scans document text and event descriptions for patterns commonly used in
// prosecution / juvenile-office filings to PRESUME a conclusion before it has
// been proven — i.e. priming the reader to accept the State's framing.
//
// This is a pattern engine, not a legal opinion. Every finding is phrased as
// "possible … to review" to honor the user instruction:
//   > "All issue flags MUST be phrased 'possible … to review' — never legal
//   >  conclusions."
//
// The detector runs on:
//   1. seeded documents (extractedText present on SD38180 evidence)
//   2. any document uploaded by ANY user later (called from
//      DocumentService.afterUpload + the local-dev seeder)
//
// Findings are deterministic, explainable, and citation-grounded: every hit
// records the offending phrase, line context, and the matched rule id.
//
// Pure-function module. NO SDK imports.

import { DocumentCategory, IssueSeverity, IssueType } from '../entities';

// ----------------------------------------------------------------------------
// Rule catalog
// ----------------------------------------------------------------------------

export interface PrejudicialRule {
  id: string;
  /** What kind of priming this detects. */
  category:
    | 'conclusory_label'
    | 'presumptive_framing'
    | 'emotional_loading'
    | 'character_attack'
    | 'guilt_by_association'
    | 'unfounded_certainty'
    | 'repetition_priming'
    | 'minimization_of_parent'
    | 'best_interests_overreach';
  /** Regex(es) to look for. Compiled with /gi unless overridden. */
  patterns: RegExp[];
  /** Why this matters in plain English (used in the flag explanation). */
  rationale: string;
  /** Default severity for hits of this rule. */
  severity: IssueSeverity;
  /** Map to a domain IssueType so the UI can group flags. */
  issueType: IssueType;
  /** Categories where this rule is most relevant (used to weight severity). */
  highRiskCategories?: DocumentCategory[];
}

/**
 * The rule catalog. EVERY rationale must use "possible … to review" framing —
 * never legal conclusions, never accusations against any individual.
 */
export const PREJUDICIAL_RULES: PrejudicialRule[] = [
  // --- Conclusory labels applied to the parent before adjudication ---
  {
    id: 'unfit-parent-label',
    category: 'conclusory_label',
    patterns: [
      /\b(unfit|unsuitable|inadequate)\s+(parent|father|mother|caregiver|guardian)\b/gi,
    ],
    rationale:
      'Possible conclusory characterization of the parent to review. Labeling a parent "unfit" before the court has made that finding can prime the reader toward the State\'s desired outcome.',
    severity: 'serious',
    issueType: 'prejudicial_language',
    highRiskCategories: ['petition', 'court_order', 'service_plan'],
  },
  {
    id: 'failed-to-protect',
    category: 'conclusory_label',
    patterns: [/\bfailed to (protect|provide|supervise|parent|safeguard)\b/gi],
    rationale:
      'Possible presumptive characterization to review. "Failed to" framing assigns blame without specifying the underlying conduct or whether a court has so found.',
    severity: 'watch',
    issueType: 'prejudicial_language',
  },
  {
    id: 'lack-of-bond',
    category: 'conclusory_label',
    patterns: [
      /\b(lack(s)?|absence|no)\s+(of\s+)?(a\s+)?(parental\s+)?(bond|attachment)\b/gi,
      /\bunbonded\b/gi,
    ],
    rationale:
      'Possible conclusory bonding assessment to review. Bonding is a clinical determination; document language asserting "lack of bond" without an underlying assessment may prime the reader.',
    severity: 'watch',
    issueType: 'evidence_quality',
  },
  // --- Presumptive framing: assumes guilt/outcome ---
  {
    id: 'will-not-change',
    category: 'presumptive_framing',
    patterns: [
      /\b(will not|cannot|is unable to|has been unable to)\s+(change|rehabilitate|reform|improve|comply)\b/gi,
      /\b(no reasonable likelihood|no likelihood)\s+(of|that)\b/gi,
    ],
    rationale:
      'Possible predictive language to review. Asserting that a parent "will not" change forecloses future-conduct considerations the court is required to weigh.',
    severity: 'serious',
    issueType: 'prejudicial_language',
    highRiskCategories: ['petition', 'court_order'],
  },
  {
    id: 'best-interests-conclusion',
    category: 'best_interests_overreach',
    patterns: [
      /\b(it is|are|would be)\s+in\s+the\s+(best\s+interests?\s+of\s+the\s+child|child'?s\s+best\s+interests?)\b/gi,
    ],
    rationale:
      'Possible "best interests" framing to review. This is the legal standard the court must decide; documents asserting it as a fact rather than a contested issue may prime the reader.',
    severity: 'watch',
    issueType: 'document_framing',
    highRiskCategories: ['petition', 'court_order', 'service_plan'],
  },
  {
    id: 'continued-risk',
    category: 'presumptive_framing',
    patterns: [
      /\b(continued|ongoing|persistent|substantial)\s+(risk|danger|harm|threat)\s+(to|of)\b/gi,
    ],
    rationale:
      'Possible repeated risk language to review. Compounding adjectives ("continued substantial risk") can prime severity before evidence supports the gradation.',
    severity: 'watch',
    issueType: 'prejudicial_language',
  },
  // --- Emotional loading ---
  {
    id: 'emotional-adjectives',
    category: 'emotional_loading',
    patterns: [
      /\b(horrific|egregious|deplorable|squalid|filthy|atrocious|shocking|heinous)\b/gi,
    ],
    rationale:
      'Possible emotionally loaded adjective to review. Words like "horrific" or "egregious" prime emotional reaction independent of underlying facts.',
    severity: 'watch',
    issueType: 'prejudicial_language',
  },
  {
    id: 'victim-framing-of-child',
    category: 'emotional_loading',
    patterns: [
      /\b(innocent|helpless|defenseless|vulnerable little)\s+(child|victim|minor)\b/gi,
    ],
    rationale:
      'Possible emotional framing of the child to review. While children\'s welfare is paramount, modifier stacking ("innocent helpless child") may be used to prime sympathy rather than describe facts.',
    severity: 'info',
    issueType: 'prejudicial_language',
  },
  // --- Character attacks on the parent ---
  {
    id: 'character-attack',
    category: 'character_attack',
    patterns: [
      /\b(manipulative|deceitful|untruthful|dishonest|evasive|uncooperative|combative|defiant|hostile|aggressive)\s+(parent|father|mother|individual|man|woman)?\b/gi,
    ],
    rationale:
      'Possible character-attack adjective applied to the parent to review. Adjectives describing personality rather than specific conduct may prime distrust independent of the record.',
    severity: 'watch',
    issueType: 'prejudicial_language',
  },
  {
    id: 'minimization-of-parent-progress',
    category: 'minimization_of_parent',
    patterns: [
      /\b(only|merely|just|barely)\s+(complied|attended|completed|provided)\b/gi,
      /\b(minimal|nominal|token|superficial)\s+(compliance|effort|participation|engagement)\b/gi,
    ],
    rationale:
      'Possible minimization of parent\'s compliance to review. Discount-words ("only complied," "minimal effort") may downplay completed services without quantifying what was done.',
    severity: 'watch',
    issueType: 'reasonable_efforts',
  },
  // --- Guilt by association ---
  {
    id: 'guilt-by-association',
    category: 'guilt_by_association',
    patterns: [
      /\b(associates with|known to associate|in the company of|in a relationship with)\s+(known|suspected|convicted)\b/gi,
    ],
    rationale:
      'Possible guilt-by-association framing to review. Highlighting third-party characteristics rather than the parent\'s own conduct may prime adverse inference.',
    severity: 'watch',
    issueType: 'prejudicial_language',
  },
  // --- Unfounded certainty ---
  {
    id: 'absolute-certainty',
    category: 'unfounded_certainty',
    patterns: [
      /\b(clearly|obviously|undoubtedly|without question|beyond doubt|undeniably)\b/gi,
    ],
    rationale:
      'Possible certainty intensifier to review. "Clearly," "obviously," and similar adverbs assert undisputed truth where the record may show dispute.',
    severity: 'info',
    issueType: 'document_framing',
  },
  {
    id: 'always-never',
    category: 'unfounded_certainty',
    patterns: [/\b(always|never)\s+(complied|attended|tested positive|tested negative|appeared|failed)\b/gi],
    rationale:
      'Possible absolutist framing to review. "Always" / "never" claims about conduct rarely match a complete record and may prime overgeneralization.',
    severity: 'watch',
    issueType: 'evidence_quality',
  },
  // --- "Has not" presumptive non-compliance framing ---
  {
    id: 'has-not-pattern',
    category: 'presumptive_framing',
    patterns: [
      /\bhas not (submitted|complied|completed|attended|provided|engaged|participated|cooperated|worked|made progress|demonstrated)\b/gi,
    ],
    rationale:
      'Possible "has not" non-compliance framing to review. Stating what a parent "has not" done foregrounds absence rather than itemizing what was attempted; may prime non-compliance inference.',
    severity: 'watch',
    issueType: 'prejudicial_language',
    highRiskCategories: ['petition', 'court_order', 'service_plan'],
  },
  // --- "Refused to" framing ---
  {
    id: 'refused-to',
    category: 'presumptive_framing',
    patterns: [/\b(refused|refuses|has refused) to\s+\w+/gi],
    rationale:
      'Possible "refused to" framing to review. "Refused" implies willful defiance; the same conduct may be described neutrally (e.g., "did not") if the underlying intent is contested.',
    severity: 'watch',
    issueType: 'prejudicial_language',
  },
  // --- Vague housing/employment instability ---
  {
    id: 'unstable-housing-employment',
    category: 'presumptive_framing',
    patterns: [
      /\b(unstable|unsuitable|inappropriate|inadequate)\s+(housing|employment|home|environment|lifestyle|living\s+situation)\b/gi,
    ],
    rationale:
      'Possible vague instability label to review. Adjectives like "unstable" or "inappropriate" applied to housing/employment without specifics may prime adverse inference.',
    severity: 'watch',
    issueType: 'prejudicial_language',
  },
  // --- Vague "safety concerns" framing ---
  {
    id: 'safety-concerns-vague',
    category: 'presumptive_framing',
    patterns: [/\b(safety concerns?|concerns? for (the )?safety)\b/gi],
    rationale:
      'Possible vague "safety concerns" framing to review. The phrase asserts risk without specifying the conduct, source, or evidentiary basis.',
    severity: 'info',
    issueType: 'document_framing',
  },
  // --- Substance-abuse labeling ---
  {
    id: 'substance-abuse-label',
    category: 'conclusory_label',
    patterns: [
      /\b(substance abuse|drug abuse|drug use) (history|issues?|problems?|concerns?)\b/gi,
    ],
    rationale:
      'Possible substance-abuse label to review. Diagnostic-sounding phrases attached to a parent without a clinical assessment may prime adverse inference.',
    severity: 'watch',
    issueType: 'chemical_dependency',
  },
  // --- Repetition of "protective custody" ---
  {
    id: 'protective-custody-repetition',
    category: 'repetition_priming',
    patterns: [/\bprotective custody\b/gi],
    rationale:
      'Possible repeated "protective custody" framing to review. Repetition of state-protective phrasing can prime the reader to view custody as the default neutral state.',
    severity: 'info',
    issueType: 'document_framing',
  },
  // --- Trauma attribution to the parent ---
  {
    id: 'trauma-attribution',
    category: 'emotional_loading',
    patterns: [/\b(his|her|the child'?s) trauma\b/gi, /\btrauma narrative\b/gi],
    rationale:
      'Possible trauma-attribution framing to review. Asserting the child\'s "trauma" as a settled fact without a clinical source may prime emotional response.',
    severity: 'watch',
    issueType: 'prejudicial_language',
  },
  // --- "Life-threatening" / "dangerous" intensifiers ---
  {
    id: 'life-threatening-language',
    category: 'emotional_loading',
    patterns: [/\b(life[-\s]threatening|dangerous|hazardous)\b/gi],
    rationale:
      'Possible severity intensifier to review. "Life-threatening," "dangerous," or "hazardous" may prime urgency without quantifying the underlying risk.',
    severity: 'watch',
    issueType: 'prejudicial_language',
  },
  // --- "We have concerns" / "believe that" hedged certainty ---
  {
    id: 'we-have-concerns',
    category: 'unfounded_certainty',
    patterns: [/\bwe (have|had) concerns?\b/gi, /\b(believe|believes|believed) that\b/gi],
    rationale:
      'Possible hedged-certainty framing to review. "We have concerns" or "we believe that" presents subjective impressions as evidentiary weight.',
    severity: 'info',
    issueType: 'document_framing',
  },
];

// ----------------------------------------------------------------------------
// Detector
// ----------------------------------------------------------------------------

export interface PrejudicialHit {
  ruleId: string;
  category: PrejudicialRule['category'];
  matchedText: string;
  /** ~80-char window around the match for context. */
  context: string;
  /** 0-based character offset within the scanned text. */
  offset: number;
  severity: IssueSeverity;
  issueType: IssueType;
  rationale: string;
}

export interface ScanInput {
  /** Free-form text to scan. */
  text: string;
  /** Optional document category — boosts severity for rules tagged high-risk. */
  category?: DocumentCategory;
}

export function scanText(input: ScanInput): PrejudicialHit[] {
  const hits: PrejudicialHit[] = [];
  if (!input.text) return hits;
  for (const rule of PREJUDICIAL_RULES) {
    for (const pattern of rule.patterns) {
      const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(input.text)) !== null) {
        const start = Math.max(0, m.index - 40);
        const end = Math.min(input.text.length, m.index + m[0].length + 40);
        const ctx = input.text.slice(start, end).replace(/\s+/g, ' ').trim();
        // Bump severity one notch if doc category is high-risk for this rule
        let sev: IssueSeverity = rule.severity;
        if (
          input.category &&
          rule.highRiskCategories?.includes(input.category) &&
          sev !== 'serious'
        ) {
          sev = sev === 'info' ? 'watch' : 'serious';
        }
        hits.push({
          ruleId: rule.id,
          category: rule.category,
          matchedText: m[0],
          context: ctx,
          offset: m.index,
          severity: sev,
          issueType: rule.issueType,
          rationale: rule.rationale,
        });
        if (!re.global) break;
      }
    }
  }
  return hits;
}

// ----------------------------------------------------------------------------
// Aggregation — turn raw hits into flag-ready findings
// ----------------------------------------------------------------------------

export interface PrejudicialFinding {
  ruleId: string;
  issueType: IssueType;
  severity: IssueSeverity;
  /** All matched phrases across the document, deduped. */
  matches: Array<{ matchedText: string; context: string }>;
  /** Human-readable summary suitable for IssueFlag.summary. */
  summary: string;
  /** Long-form explanation suitable for IssueFlag.explanation. */
  explanation: string;
}

export function aggregateFindings(hits: PrejudicialHit[], sourceLabel: string): PrejudicialFinding[] {
  // Group by ruleId
  const byRule = new Map<string, PrejudicialHit[]>();
  for (const h of hits) {
    if (!byRule.has(h.ruleId)) byRule.set(h.ruleId, []);
    byRule.get(h.ruleId)!.push(h);
  }
  const findings: PrejudicialFinding[] = [];
  for (const [, ruleHits] of byRule.entries()) {
    if (ruleHits.length === 0) continue;
    const head = ruleHits[0]!;
    const seen = new Set<string>();
    const matches: PrejudicialFinding['matches'] = [];
    for (const h of ruleHits) {
      const key = h.matchedText.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ matchedText: h.matchedText, context: h.context });
    }
    // Repetition priming: 3+ distinct hits of the same rule in one doc
    let severity = head.severity;
    if (matches.length >= 3 && severity !== 'serious') {
      severity = severity === 'info' ? 'watch' : 'serious';
    }
    const count = ruleHits.length;
    const summary = `Possible ${humanizeCategory(head.category)} in "${sourceLabel}" to review (${count} instance${count === 1 ? '' : 's'})`;
    const explanation =
      head.rationale +
      '\n\nMatched phrases:\n' +
      matches
        .slice(0, 10)
        .map((m, i) => `${i + 1}. "${m.matchedText}" — \u2026${m.context}\u2026`)
        .join('\n') +
      (matches.length > 10 ? `\n(+${matches.length - 10} more)` : '');
    findings.push({
      ruleId: head.ruleId,
      issueType: head.issueType,
      severity,
      matches,
      summary,
      explanation,
    });
  }
  return findings;
}

function humanizeCategory(c: PrejudicialRule['category']): string {
  switch (c) {
    case 'conclusory_label':
      return 'conclusory label applied to the parent';
    case 'presumptive_framing':
      return 'presumptive framing';
    case 'emotional_loading':
      return 'emotionally loaded language';
    case 'character_attack':
      return 'character-attack language';
    case 'guilt_by_association':
      return 'guilt-by-association framing';
    case 'unfounded_certainty':
      return 'unfounded-certainty language';
    case 'repetition_priming':
      return 'repetition priming';
    case 'minimization_of_parent':
      return "minimization of parent's compliance";
    case 'best_interests_overreach':
      return 'best-interests language used as fact';
  }
}

// ----------------------------------------------------------------------------
// Top-level helper used by document-upload pipeline + seeder
// ----------------------------------------------------------------------------

export interface ScanDocumentInput {
  documentId: string;
  documentTitle: string;
  category: DocumentCategory;
  extractedText?: string;
}

export interface ScanDocumentResult {
  documentId: string;
  hits: PrejudicialHit[];
  findings: PrejudicialFinding[];
}

export function scanDocument(input: ScanDocumentInput): ScanDocumentResult {
  if (!input.extractedText || input.extractedText.length === 0) {
    return { documentId: input.documentId, hits: [], findings: [] };
  }
  const hits = scanText({ text: input.extractedText, category: input.category });
  const findings = aggregateFindings(hits, input.documentTitle);
  return { documentId: input.documentId, hits, findings };
}
