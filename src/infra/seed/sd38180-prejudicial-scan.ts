// Runs the prejudicial-language scanner against every SD38180 seeded
// document/email that has extracted text, and emits IssueFlags via the
// provided IssueReviewRepository.
//
// Called from seedSD38180IfFirstRun AFTER documents + events have been seeded.
// Each finding becomes an issue flag with sourceRefs pointing back to the
// document title for traceability.

import { DocumentCategory } from '@domain/entities';
import { IssueReviewRepository } from '@domain/repositories';
import { scanDocument } from '@domain/services/prejudicialLanguage';
import { getExtractedTextByKey, listExtractedTextKeys } from './sd38180-extracted-text';

// Map sidecar key (basename) -> category. Lets the scanner weight severity
// for high-risk document types (petitions, court orders, transcripts).
function inferCategory(key: string): DocumentCategory {
  const k = key.toLowerCase();
  if (k.includes('motion') || k.includes('petition')) return 'petition';
  if (k.includes('order') || k.includes('judgment')) return 'court_order';
  if (k.includes('transcript')) return 'transcript';
  if (k.includes('service-plan') || k.includes('written-service')) return 'service_plan';
  if (k.includes('drug') || k.includes('hair-follicle')) return 'drug_test';
  if (k.includes('school') || k.includes('enrollment')) return 'school';
  if (k.includes('medical') || k.includes('evaluation')) return 'medical';
  // All emails default to correspondence
  return 'correspondence';
}

export interface ScanSummary {
  documentsScanned: number;
  documentsWithFindings: number;
  flagsCreated: number;
  bySeverity: Record<string, number>;
}

export async function runSd38180PrejudicialScan(
  caseId: string,
  issues: IssueReviewRepository,
): Promise<ScanSummary> {
  const keys = listExtractedTextKeys();
  let documentsWithFindings = 0;
  let flagsCreated = 0;
  const bySeverity: Record<string, number> = { info: 0, watch: 0, serious: 0 };

  for (const key of keys) {
    const text = getExtractedTextByKey(key);
    if (!text || text.length < 50) continue;
    const result = scanDocument({
      documentId: key,
      documentTitle: key,
      category: inferCategory(key),
      extractedText: text,
    });
    if (result.findings.length === 0) continue;
    documentsWithFindings += 1;
    for (const f of result.findings) {
      await issues.createIssueFlag({
        caseId,
        type: f.issueType,
        severity: f.severity,
        summary: f.summary,
        explanation: f.explanation,
        sourceRefs: [key, `rule:${f.ruleId}`],
        status: 'system_generated',
      });
      flagsCreated += 1;
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    }
  }

  return {
    documentsScanned: keys.length,
    documentsWithFindings,
    flagsCreated,
    bySeverity,
  };
}
