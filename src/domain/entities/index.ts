// Domain entities — backend-agnostic. No SDK imports allowed in this file.
// These shapes are the contract every infra adapter must produce.

export type SubscriptionStatus =
  | 'free'
  | 'trialing'
  | 'active'
  | 'grace_period'
  | 'billing_issue'
  | 'expired'
  | 'canceled';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  subscriptionStatus: SubscriptionStatus;
  onboardingComplete: boolean;
  region?: string;
}

export type CaseType =
  | 'investigation'
  | 'abuse_neglect'
  | 'foster_care'
  | 'reunification'
  | 'tpr'
  | 'appeal'
  | 'other';

export type CaseStatus = 'open' | 'closed' | 'appeal' | 'archived';

export interface CaseRecord {
  id: string;
  ownerUserId: string;
  title: string;
  jurisdictionState: string;
  jurisdictionCounty?: string;
  caseType: CaseType;
  status: CaseStatus;
  openedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PartyRole =
  | 'mother'
  | 'father'
  | 'child'
  | 'guardian'
  | 'caseworker'
  | 'attorney'
  | 'judge'
  | 'juvenile_officer'
  | 'foster_parent'
  | 'other';

export interface CaseParty {
  id: string;
  caseId: string;
  role: PartyRole;
  displayLabel: string;
  legalName?: string;
  anonymizedLabel?: string;
  isMinor?: boolean;
}

export type EventType =
  | 'report'
  | 'home_visit'
  | 'removal'
  | 'shelter_hearing'
  | 'adjudication'
  | 'review_hearing'
  | 'permanency_hearing'
  | 'service_plan'
  | 'drug_test'
  | 'visit'
  | 'tpr_petition'
  | 'tpr_trial'
  | 'tpr_judgment'
  | 'appeal'
  | 'meeting'
  | 'other';

export interface CaseEvent {
  id: string;
  caseId: string;
  eventType: EventType;
  occurredAt: string;
  description: string;
  sourceDocumentId?: string;
  tags: string[];
  createdAt: string;
}

export type DocumentCategory =
  | 'court_order'
  | 'petition'
  | 'service_plan'
  | 'drug_test'
  | 'medical'
  | 'school'
  | 'photo'
  | 'screenshot'
  | 'audio_note'
  | 'correspondence'
  | 'other';

export type RedactionStatus = 'raw' | 'redacted' | 'needs_review';

export interface DocumentRecord {
  id: string;
  caseId: string;
  ownerUserId: string;
  title: string;
  category: DocumentCategory;
  bucketId: string;
  fileId: string;
  mimeType: string;
  uploadedAt: string;
  extractedText?: string;
  redactionStatus: RedactionStatus;
  tags: string[];
}

export type IssueType =
  | 'notice'
  | 'counsel'
  | 'hearing_delay'
  | 'reasonable_efforts'
  | 'chemical_dependency'
  | 'evidence_quality'
  | 'service_access'
  | 'visitation'
  | 'placement'
  | 'other';

export type IssueSeverity = 'info' | 'watch' | 'serious';
export type IssueStatus = 'system_generated' | 'user_marked' | 'reviewed';

export interface IssueFlag {
  id: string;
  caseId: string;
  type: IssueType;
  severity: IssueSeverity;
  status: IssueStatus;
  summary: string;
  explanation: string;
  sourceRefs: string[];
  createdAt: string;
}

export type PatternMatchType =
  | 'county_pattern'
  | 'actor_pattern'
  | 'process_pattern'
  | 'issue_cluster';

export interface PatternMatch {
  id: string;
  caseId: string;
  matchType: PatternMatchType;
  score: number;
  explanation: string;
  matchedIssueTypes: string[];
  visibleCount: number;
  createdAt: string;
}

export interface CoalitionOptIn {
  id: string;
  userId: string;
  caseId: string;
  consentToPatternMatching: boolean;
  consentToAnonymizedCohortStats: boolean;
  consentToAttorneyReview: boolean;
  consentToAdvocateReview: boolean;
  consentTimestamp: string;
}

export type EntitlementPlatform = 'google_play';

export interface SubscriptionEntitlement {
  id: string;
  userId: string;
  platform: EntitlementPlatform;
  productId: string;
  basePlanId: string;
  offerId?: string;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodEndsAt?: string;
  lastVerifiedAt: string;
}

export interface SubscriptionPlan {
  productId: string;
  basePlanId: string;
  offerId?: string;
  priceFormatted: string;
  priceCents: number;
  currency: string;
  freeTrialDays: number;
  billingPeriod: 'P1M';
  disclosure: string;
}

export interface AttorneyReviewRequest {
  id: string;
  caseId: string;
  userId: string;
  submittedAt: string;
  status: 'pending' | 'received' | 'declined' | 'matched';
  consentSnapshot: CoalitionOptIn;
  packetExportId?: string;
}
