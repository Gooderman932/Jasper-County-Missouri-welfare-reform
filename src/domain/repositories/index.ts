// Repository interfaces — the boundary between domain and infra.
// Screens / use cases depend ONLY on these. No SDK imports here.

import {
  AttorneyReviewRequest,
  CaseEvent,
  CaseParty,
  CaseRecord,
  CaseStatus,
  CaseType,
  CoalitionOptIn,
  ContentReport,
  ContentReportReason,
  ContentReportStatus,
  DocumentCategory,
  DocumentRecord,
  EventType,
  IssueFlag,
  IssueSeverity,
  IssueType,
  PatternMatch,
  RedactionPolicy,
  SubscriptionEntitlement,
  SubscriptionPlan,
  User,
} from '../entities';

export interface CreateCaseInput {
  ownerUserId: string;
  title: string;
  jurisdictionState: string;
  jurisdictionCounty?: string;
  caseType: CaseType;
}

export interface UpdateCaseInput {
  title?: string;
  jurisdictionState?: string;
  jurisdictionCounty?: string;
  caseType?: CaseType;
  status?: CaseStatus;
  openedAt?: string;
}

export interface UploadDocumentInput {
  caseId: string;
  ownerUserId: string;
  title: string;
  category: DocumentCategory;
  fileUri: string;
  mimeType: string;
  tags?: string[];
}

export interface AddCaseEventInput {
  caseId: string;
  eventType: EventType;
  occurredAt: string;
  description: string;
  sourceDocumentId?: string;
  tags?: string[];
}

export interface CreateIssueFlagInput {
  caseId: string;
  type: IssueType;
  severity: IssueSeverity;
  summary: string;
  explanation: string;
  sourceRefs?: string[];
  status?: 'system_generated' | 'user_marked' | 'reviewed';
}

export interface AuthRepository {
  signUp(email: string, password: string, displayName?: string): Promise<User>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  updateProfile(input: Partial<User>): Promise<User>;
}

export interface PublishCaseInput {
  caseId: string;
  publishedByUserId: string;
  redactionPolicy: RedactionPolicy;
  publicTitle?: string;
  publicSummary?: string;
  isReferenceCase?: boolean;
}

export interface ListPublicCasesOptions {
  limit?: number;
  cursor?: string;
  referenceOnly?: boolean;
}

export interface CreateContentReportInput {
  caseId: string;
  reporterUserId?: string;
  reason: ContentReportReason;
  details?: string;
}

export interface CaseRepository {
  createCase(input: CreateCaseInput): Promise<CaseRecord>;
  updateCase(id: string, input: UpdateCaseInput): Promise<CaseRecord>;
  listCases(userId: string): Promise<CaseRecord[]>;
  getCaseById(id: string): Promise<CaseRecord | null>;
  archiveCase(id: string): Promise<void>;
  // Public-case methods. Implementations must enforce: only the case owner
  // may publish/unpublish. Public-read methods do NOT require auth.
  publishCase(input: PublishCaseInput): Promise<CaseRecord>;
  unpublishCase(caseId: string, requestingUserId: string): Promise<CaseRecord>;
  listPublicCases(options?: ListPublicCasesOptions): Promise<CaseRecord[]>;
  getPublicCaseBySlug(slug: string): Promise<CaseRecord | null>;
}

export interface PartyRepository {
  addParty(caseId: string, party: Omit<CaseParty, 'id' | 'caseId'>): Promise<CaseParty>;
  listParties(caseId: string): Promise<CaseParty[]>;
  removeParty(partyId: string): Promise<void>;
}

export interface DocumentRepository {
  uploadDocument(input: UploadDocumentInput): Promise<DocumentRecord>;
  listDocuments(caseId: string): Promise<DocumentRecord[]>;
  updateDocumentMetadata(id: string, input: Partial<DocumentRecord>): Promise<DocumentRecord>;
  deleteDocument(id: string): Promise<void>;
  getDownloadUrl(id: string): Promise<string>;
}

export interface EventRepository {
  addEvent(input: AddCaseEventInput): Promise<CaseEvent>;
  listEvents(caseId: string): Promise<CaseEvent[]>;
  updateEvent(id: string, input: Partial<CaseEvent>): Promise<CaseEvent>;
  deleteEvent(id: string): Promise<void>;
}

export interface IssueReviewRepository {
  listIssueFlags(caseId: string): Promise<IssueFlag[]>;
  createIssueFlag(input: CreateIssueFlagInput): Promise<IssueFlag>;
  updateIssueFlag(id: string, input: Partial<IssueFlag>): Promise<IssueFlag>;
}

export interface PatternRepository {
  getPatternMatches(caseId: string): Promise<PatternMatch[]>;
  submitCoalitionOptIn(input: Omit<CoalitionOptIn, 'id'>): Promise<CoalitionOptIn>;
  getCoalitionOptIn(caseId: string): Promise<CoalitionOptIn | null>;
  requestAttorneyReview(caseId: string, exportId?: string): Promise<AttorneyReviewRequest>;
}

export interface BillingRepository {
  getAvailablePlans(): Promise<SubscriptionPlan[]>;
  purchasePremiumMonthly(): Promise<void>;
  restorePurchases(): Promise<void>;
  syncEntitlement(): Promise<SubscriptionEntitlement | null>;
  getCurrentEntitlement(): Promise<SubscriptionEntitlement | null>;
}

export interface OcrRepository {
  extractText(fileUri: string, mimeType: string): Promise<{ text: string; confidence: number }>;
}

export interface ExportRepository {
  exportTimelinePdf(caseId: string): Promise<{ id: string; uri: string }>;
  exportIssueSummaryPdf(caseId: string): Promise<{ id: string; uri: string }>;
  exportAttorneyPacket(caseId: string): Promise<{ id: string; uri: string }>;
  exportDocumentZip(caseId: string, documentIds: string[]): Promise<{ id: string; uri: string }>;
  exportCalendarIcs(caseId: string): Promise<{ id: string; uri: string }>;
}

export interface NotificationRepository {
  scheduleReminder(input: { caseId?: string; title: string; body: string; whenISO: string }): Promise<string>;
  cancelReminder(id: string): Promise<void>;
  listReminders(): Promise<Array<{ id: string; title: string; whenISO: string }>>;
}

export interface ContentReportRepository {
  createReport(input: CreateContentReportInput): Promise<ContentReport>;
  listReportsForCase(caseId: string): Promise<ContentReport[]>;
  listAllReports(status?: ContentReportStatus): Promise<ContentReport[]>;
  updateReportStatus(
    id: string,
    status: ContentReportStatus,
    resolutionNote?: string,
  ): Promise<ContentReport>;
}
