// Helper to publish the seeded SD38180 case as the production "reference
// case" in the public reference library. Idempotent.
//
// Kept in src/ so it can be imported by the in-app seeder. The
// scripts/publish-sd38180-as-reference.ts CLI re-exports this for one-off
// operational runs.

import { CaseRepository } from '@domain/repositories';
import { CaseRecord } from '@domain/entities';
import {
  SD38180_PUBLIC_TITLE,
  SD38180_PUBLIC_SUMMARY,
  SD38180_REDACTION_POLICY,
} from './sd38180-redaction';

export const REFERENCE_SLUG_PREFIX = 'sd38180';

export async function publishSd38180AsReference(
  cases: CaseRepository,
  caseId: string,
  ownerUserId: string,
): Promise<CaseRecord> {
  const existing = await cases.getCaseById(caseId);
  if (!existing) {
    throw new Error(`publishSd38180AsReference: case ${caseId} not found`);
  }
  if (existing.visibility === 'public' && existing.isReferenceCase) {
    return existing; // already published as reference
  }
  return cases.publishCase({
    caseId,
    publishedByUserId: ownerUserId,
    redactionPolicy: SD38180_REDACTION_POLICY,
    publicTitle: SD38180_PUBLIC_TITLE,
    publicSummary: SD38180_PUBLIC_SUMMARY,
    isReferenceCase: true,
  });
}
