// Mappers translate Appwrite documents <-> domain entities.
import {
  CaseEvent,
  CaseParty,
  CaseRecord,
  CoalitionOptIn,
  DocumentRecord,
  IssueFlag,
  PatternMatch,
  SubscriptionEntitlement,
  User,
} from '@domain/entities';

type Doc = Record<string, any> & { $id: string; $createdAt: string; $updatedAt: string };

export const mapUser = (d: Doc): User => ({
  id: d.$id,
  email: d.email,
  displayName: d.displayName ?? undefined,
  createdAt: d.$createdAt,
  subscriptionStatus: d.subscriptionStatus ?? 'free',
  onboardingComplete: !!d.onboardingComplete,
  region: d.region,
});

export const mapCase = (d: Doc): CaseRecord => ({
  id: d.$id,
  ownerUserId: d.ownerUserId,
  title: d.title,
  jurisdictionState: d.jurisdictionState,
  jurisdictionCounty: d.jurisdictionCounty ?? undefined,
  caseType: d.caseType,
  status: d.status,
  openedAt: d.openedAt ?? undefined,
  createdAt: d.$createdAt,
  updatedAt: d.$updatedAt,
});

export const mapParty = (d: Doc): CaseParty => ({
  id: d.$id,
  caseId: d.caseId,
  role: d.role,
  displayLabel: d.displayLabel,
  legalName: d.legalName ?? undefined,
  anonymizedLabel: d.anonymizedLabel ?? undefined,
  isMinor: d.isMinor ?? undefined,
});

export const mapEvent = (d: Doc): CaseEvent => ({
  id: d.$id,
  caseId: d.caseId,
  eventType: d.eventType,
  occurredAt: d.occurredAt,
  description: d.description,
  sourceDocumentId: d.sourceDocumentId ?? undefined,
  tags: d.tags ?? [],
  createdAt: d.$createdAt,
});

export const mapDocument = (d: Doc): DocumentRecord => ({
  id: d.$id,
  caseId: d.caseId,
  ownerUserId: d.ownerUserId,
  title: d.title,
  category: d.category,
  bucketId: d.bucketId,
  fileId: d.fileId,
  mimeType: d.mimeType,
  uploadedAt: d.uploadedAt ?? d.$createdAt,
  extractedText: d.extractedText ?? undefined,
  redactionStatus: d.redactionStatus ?? 'raw',
  tags: d.tags ?? [],
});

export const mapIssue = (d: Doc): IssueFlag => ({
  id: d.$id,
  caseId: d.caseId,
  type: d.type,
  severity: d.severity,
  status: d.status,
  summary: d.summary,
  explanation: d.explanation,
  sourceRefs: d.sourceRefs ?? [],
  createdAt: d.$createdAt,
});

export const mapPattern = (d: Doc): PatternMatch => ({
  id: d.$id,
  caseId: d.caseId,
  matchType: d.matchType,
  score: d.score,
  explanation: d.explanation,
  matchedIssueTypes: d.matchedIssueTypes ?? [],
  visibleCount: d.visibleCount ?? 0,
  createdAt: d.$createdAt,
});

export const mapCoalition = (d: Doc): CoalitionOptIn => ({
  id: d.$id,
  userId: d.userId,
  caseId: d.caseId,
  consentToPatternMatching: !!d.consentToPatternMatching,
  consentToAnonymizedCohortStats: !!d.consentToAnonymizedCohortStats,
  consentToAttorneyReview: !!d.consentToAttorneyReview,
  consentToAdvocateReview: !!d.consentToAdvocateReview,
  consentTimestamp: d.consentTimestamp,
});

export const mapEntitlement = (d: Doc): SubscriptionEntitlement => ({
  id: d.$id,
  userId: d.userId,
  platform: d.platform,
  productId: d.productId,
  basePlanId: d.basePlanId,
  offerId: d.offerId ?? undefined,
  status: d.status,
  trialEndsAt: d.trialEndsAt ?? undefined,
  currentPeriodEndsAt: d.currentPeriodEndsAt ?? undefined,
  lastVerifiedAt: d.lastVerifiedAt,
});
