// In-memory repository implementations for LOCAL DEV / offline-seed mode.
// Enabled when EXPO_PUBLIC_USE_MEMORY_REPOS === 'true' (set in .env.local).
// Lets the app boot on Expo Web with the SD38180 seed pre-loaded — no Appwrite,
// no auth, no network. Nothing here persists across page reloads.

import { v4 as uuid } from 'uuid';
import {
  AttorneyReviewRequest,
  CaseEvent,
  CaseParty,
  CaseRecord,
  CaseStatus,
  CoalitionOptIn,
  ContentReport,
  ContentReportStatus,
  DocumentRecord,
  IssueFlag,
  PatternMatch,
  SubscriptionEntitlement,
  SubscriptionPlan,
  User,
} from '@domain/entities';
import {
  AddCaseEventInput,
  AuthRepository,
  BillingRepository,
  CaseRepository,
  ContentReportRepository,
  CreateCaseInput,
  CreateContentReportInput,
  CreateIssueFlagInput,
  DocumentRepository,
  EventRepository,
  ExportRepository,
  IssueReviewRepository,
  ListPublicCasesOptions,
  NotificationRepository,
  OcrRepository,
  PartyRepository,
  PatternRepository,
  PublishCaseInput,
  UpdateCaseInput,
  UploadDocumentInput,
} from '@domain/repositories';

// ---------------------------------------------------------------------------
// Shared in-memory store
// ---------------------------------------------------------------------------
interface MemStore {
  users: Map<string, User>;
  currentUserId: string | null;
  cases: Map<string, CaseRecord>;
  parties: Map<string, CaseParty>;
  events: Map<string, CaseEvent>;
  documents: Map<string, DocumentRecord>;
  issues: Map<string, IssueFlag>;
  patterns: Map<string, PatternMatch>;
  reports: Map<string, ContentReport>;
  entitlement: SubscriptionEntitlement | null;
}

const store: MemStore = {
  users: new Map(),
  currentUserId: null,
  cases: new Map(),
  parties: new Map(),
  events: new Map(),
  documents: new Map(),
  issues: new Map(),
  patterns: new Map(),
  reports: new Map(),
  entitlement: null,
};

/** Expose the raw store so the SD38180 seeder and migration scripts can
 *  insert pre-built records directly without going through CRUD methods. */
export function __getMemoryStore() {
  return store;
}

function makeSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || `case-${Date.now().toString(36)}`
  );
}

// ---------------------------------------------------------------------------
// Auth — auto-signs in a dummy local user. No password check.
// ---------------------------------------------------------------------------
export class AuthRepositoryMemory implements AuthRepository {
  async signUp(email: string, _password: string, displayName?: string): Promise<User> {
    const u: User = {
      id: uuid(),
      email,
      displayName: displayName ?? 'Local Dev User',
      createdAt: new Date().toISOString(),
      subscriptionStatus: 'free',
      onboardingComplete: true,
    };
    store.users.set(u.id, u);
    store.currentUserId = u.id;
    return u;
  }
  async signIn(email: string, _password: string): Promise<User> {
    // Find or create
    for (const u of store.users.values()) {
      if (u.email === email) {
        store.currentUserId = u.id;
        return u;
      }
    }
    return this.signUp(email, _password);
  }
  async signOut(): Promise<void> {
    store.currentUserId = null;
  }
  async getCurrentUser(): Promise<User | null> {
    if (!store.currentUserId) {
      // Auto-bootstrap a dev user so the app boots directly into authenticated state.
      const u = await this.signUp('local-dev@family-rights.app', 'devmode', 'Local Dev User');
      return u;
    }
    return store.users.get(store.currentUserId) ?? null;
  }
  async updateProfile(input: Partial<User>): Promise<User> {
    if (!store.currentUserId) throw new Error('not signed in');
    const u = store.users.get(store.currentUserId)!;
    const next = { ...u, ...input };
    store.users.set(u.id, next);
    return next;
  }
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------
export class CaseRepositoryMemory implements CaseRepository {
  async createCase(input: CreateCaseInput): Promise<CaseRecord> {
    const c: CaseRecord = {
      id: uuid(),
      ownerUserId: input.ownerUserId,
      title: input.title,
      jurisdictionState: input.jurisdictionState,
      jurisdictionCounty: input.jurisdictionCounty,
      caseType: input.caseType,
      status: 'open',
      openedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.cases.set(c.id, c);
    return c;
  }
  async updateCase(id: string, input: UpdateCaseInput): Promise<CaseRecord> {
    const c = store.cases.get(id);
    if (!c) throw new Error('case not found');
    const next = { ...c, ...input, updatedAt: new Date().toISOString() };
    store.cases.set(id, next);
    return next;
  }
  async listCases(userId: string): Promise<CaseRecord[]> {
    return Array.from(store.cases.values()).filter((c) => c.ownerUserId === userId);
  }
  async getCaseById(id: string): Promise<CaseRecord | null> {
    return store.cases.get(id) ?? null;
  }
  async archiveCase(id: string): Promise<void> {
    const c = store.cases.get(id);
    if (c) store.cases.set(id, { ...c, status: 'archived' as CaseStatus });
  }
  async publishCase(input: PublishCaseInput): Promise<CaseRecord> {
    const c = store.cases.get(input.caseId);
    if (!c) throw new Error('case not found');
    if (c.ownerUserId !== input.publishedByUserId) {
      throw new Error('only the case owner may publish');
    }
    const slug = c.publicSlug ?? makeSlug(input.publicTitle ?? c.title);
    const next: CaseRecord = {
      ...c,
      visibility: 'public',
      publicSlug: slug,
      publishedAt: new Date().toISOString(),
      publishedBy: input.publishedByUserId,
      unpublishedAt: undefined,
      publicTitle: input.publicTitle ?? c.publicTitle,
      publicSummary: input.publicSummary ?? c.publicSummary,
      redactionPolicy: input.redactionPolicy,
      isReferenceCase: input.isReferenceCase ?? c.isReferenceCase,
      updatedAt: new Date().toISOString(),
    };
    store.cases.set(c.id, next);
    return next;
  }
  async unpublishCase(caseId: string, requestingUserId: string): Promise<CaseRecord> {
    const c = store.cases.get(caseId);
    if (!c) throw new Error('case not found');
    if (c.ownerUserId !== requestingUserId) {
      throw new Error('only the case owner may unpublish');
    }
    const next: CaseRecord = {
      ...c,
      visibility: 'private',
      unpublishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.cases.set(c.id, next);
    return next;
  }
  async listPublicCases(options: ListPublicCasesOptions = {}): Promise<CaseRecord[]> {
    let cases = Array.from(store.cases.values()).filter((c) => c.visibility === 'public');
    if (options.referenceOnly) cases = cases.filter((c) => c.isReferenceCase);
    cases.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
    if (options.limit) cases = cases.slice(0, options.limit);
    return cases;
  }
  async getPublicCaseBySlug(slug: string): Promise<CaseRecord | null> {
    for (const c of store.cases.values()) {
      if (c.visibility === 'public' && c.publicSlug === slug) return c;
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Content reports (Play UGC moderation requirement)
// ---------------------------------------------------------------------------
export class ContentReportRepositoryMemory implements ContentReportRepository {
  async createReport(input: CreateContentReportInput): Promise<ContentReport> {
    const r: ContentReport = {
      id: uuid(),
      caseId: input.caseId,
      reporterUserId: input.reporterUserId,
      reason: input.reason,
      details: input.details,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    store.reports.set(r.id, r);
    return r;
  }
  async listReportsForCase(caseId: string): Promise<ContentReport[]> {
    return Array.from(store.reports.values()).filter((r) => r.caseId === caseId);
  }
  async listAllReports(status?: ContentReportStatus): Promise<ContentReport[]> {
    let all = Array.from(store.reports.values());
    if (status) all = all.filter((r) => r.status === status);
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async updateReportStatus(
    id: string,
    status: ContentReportStatus,
    resolutionNote?: string,
  ): Promise<ContentReport> {
    const r = store.reports.get(id);
    if (!r) throw new Error('report not found');
    const next: ContentReport = {
      ...r,
      status,
      resolutionNote: resolutionNote ?? r.resolutionNote,
      resolvedAt:
        status === 'resolved' || status === 'dismissed'
          ? new Date().toISOString()
          : r.resolvedAt,
    };
    store.reports.set(id, next);
    return next;
  }
}

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------
export class PartyRepositoryMemory implements PartyRepository {
  async addParty(caseId: string, party: Omit<CaseParty, 'id' | 'caseId'>): Promise<CaseParty> {
    const p: CaseParty = { id: uuid(), caseId, ...party };
    store.parties.set(p.id, p);
    return p;
  }
  async listParties(caseId: string): Promise<CaseParty[]> {
    return Array.from(store.parties.values()).filter((p) => p.caseId === caseId);
  }
  async removeParty(partyId: string): Promise<void> {
    store.parties.delete(partyId);
  }
}

// ---------------------------------------------------------------------------
// Documents — fileUri stored verbatim; no actual upload.
// ---------------------------------------------------------------------------
export class DocumentRepositoryMemory implements DocumentRepository {
  async uploadDocument(input: UploadDocumentInput): Promise<DocumentRecord> {
    const d: DocumentRecord = {
      id: uuid(),
      caseId: input.caseId,
      ownerUserId: input.ownerUserId,
      title: input.title,
      category: input.category,
      bucketId: 'memory-bucket',
      fileId: uuid(),
      mimeType: input.mimeType,
      uploadedAt: new Date().toISOString(),
      redactionStatus: 'raw',
      tags: input.tags ?? [],
    };
    store.documents.set(d.id, d);
    return d;
  }
  async listDocuments(caseId: string): Promise<DocumentRecord[]> {
    return Array.from(store.documents.values()).filter((d) => d.caseId === caseId);
  }
  async updateDocumentMetadata(id: string, input: Partial<DocumentRecord>): Promise<DocumentRecord> {
    const d = store.documents.get(id);
    if (!d) throw new Error('doc not found');
    const next = { ...d, ...input };
    store.documents.set(id, next);
    return next;
  }
  async deleteDocument(id: string): Promise<void> {
    store.documents.delete(id);
  }
  async getDownloadUrl(id: string): Promise<string> {
    const d = store.documents.get(id);
    if (!d) throw new Error('doc not found');
    return `memory://documents/${id}`;
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export class EventRepositoryMemory implements EventRepository {
  async addEvent(input: AddCaseEventInput): Promise<CaseEvent> {
    const e: CaseEvent = {
      id: uuid(),
      caseId: input.caseId,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      description: input.description,
      sourceDocumentId: input.sourceDocumentId,
      tags: input.tags ?? [],
      createdAt: new Date().toISOString(),
    };
    store.events.set(e.id, e);
    return e;
  }
  async listEvents(caseId: string): Promise<CaseEvent[]> {
    return Array.from(store.events.values())
      .filter((e) => e.caseId === caseId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
  async updateEvent(id: string, input: Partial<CaseEvent>): Promise<CaseEvent> {
    const e = store.events.get(id);
    if (!e) throw new Error('event not found');
    const next = { ...e, ...input };
    store.events.set(id, next);
    return next;
  }
  async deleteEvent(id: string): Promise<void> {
    store.events.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------
export class IssueReviewRepositoryMemory implements IssueReviewRepository {
  async listIssueFlags(caseId: string): Promise<IssueFlag[]> {
    return Array.from(store.issues.values()).filter((i) => i.caseId === caseId);
  }
  async createIssueFlag(input: CreateIssueFlagInput): Promise<IssueFlag> {
    const f: IssueFlag = {
      id: uuid(),
      caseId: input.caseId,
      type: input.type,
      severity: input.severity,
      status: input.status ?? 'system_generated',
      summary: input.summary,
      explanation: input.explanation,
      sourceRefs: input.sourceRefs ?? [],
      createdAt: new Date().toISOString(),
    };
    store.issues.set(f.id, f);
    return f;
  }
  async updateIssueFlag(id: string, input: Partial<IssueFlag>): Promise<IssueFlag> {
    const f = store.issues.get(id);
    if (!f) throw new Error('flag not found');
    const next = { ...f, ...input };
    store.issues.set(id, next);
    return next;
  }
}

// ---------------------------------------------------------------------------
// Patterns / Billing / OCR / Exports / Notifications — minimal stubs so the
// rest of the app boots without crashing.
// ---------------------------------------------------------------------------
export class PatternRepositoryMemory implements PatternRepository {
  async getPatternMatches(_caseId: string): Promise<PatternMatch[]> {
    return [];
  }
  async submitCoalitionOptIn(input: Omit<CoalitionOptIn, 'id'>): Promise<CoalitionOptIn> {
    return { id: uuid(), ...input };
  }
  async getCoalitionOptIn(_caseId: string): Promise<CoalitionOptIn | null> {
    return null;
  }
  async requestAttorneyReview(caseId: string, exportId?: string): Promise<AttorneyReviewRequest> {
    return {
      id: uuid(),
      caseId,
      userId: store.currentUserId ?? 'local-dev',
      submittedAt: new Date().toISOString(),
      status: 'pending',
      consentSnapshot: {
        id: uuid(),
        userId: store.currentUserId ?? 'local-dev',
        caseId,
        consentToPatternMatching: false,
        consentToAnonymizedCohortStats: false,
        consentToAttorneyReview: true,
        consentToAdvocateReview: false,
        consentTimestamp: new Date().toISOString(),
      },
      packetExportId: exportId,
    };
  }
}

export class BillingRepositoryMemory implements BillingRepository {
  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    return [
      {
        productId: 'premium_monthly_599',
        basePlanId: 'monthly-autorenew',
        offerId: 'freetrial-1m',
        priceFormatted: '$5.99',
        priceCents: 599,
        currency: 'USD',
        freeTrialDays: 30,
        billingPeriod: 'P1M',
        disclosure: '1-month free trial, then $5.99/month. Cancel anytime.',
      },
    ];
  }
  async purchasePremiumMonthly(): Promise<void> {
    store.entitlement = {
      id: uuid(),
      userId: store.currentUserId ?? 'local-dev',
      platform: 'google_play',
      productId: 'premium_monthly_599',
      basePlanId: 'monthly-autorenew',
      offerId: 'freetrial-1m',
      status: 'trialing',
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    };
  }
  async restorePurchases(): Promise<void> {
    /* no-op */
  }
  async syncEntitlement(): Promise<SubscriptionEntitlement | null> {
    return store.entitlement;
  }
  async getCurrentEntitlement(): Promise<SubscriptionEntitlement | null> {
    return store.entitlement;
  }
}

export class OcrRepositoryMemory implements OcrRepository {
  async extractText(_fileUri: string, _mimeType: string): Promise<{ text: string; confidence: number }> {
    return { text: '(OCR disabled in local-dev memory mode.)', confidence: 0 };
  }
}

export class ExportRepositoryMemory implements ExportRepository {
  async exportTimelinePdf(caseId: string): Promise<{ id: string; uri: string }> {
    return { id: uuid(), uri: `memory://exports/timeline/${caseId}` };
  }
  async exportIssueSummaryPdf(caseId: string): Promise<{ id: string; uri: string }> {
    return { id: uuid(), uri: `memory://exports/issue-summary/${caseId}` };
  }
  async exportAttorneyPacket(caseId: string): Promise<{ id: string; uri: string }> {
    return { id: uuid(), uri: `memory://exports/attorney-packet/${caseId}` };
  }
  async exportDocumentZip(caseId: string, _documentIds: string[]): Promise<{ id: string; uri: string }> {
    return { id: uuid(), uri: `memory://exports/zip/${caseId}` };
  }
}

export class NotificationRepositoryMemory implements NotificationRepository {
  private reminders = new Map<string, { id: string; title: string; whenISO: string; body: string }>();
  async scheduleReminder(input: { caseId?: string; title: string; body: string; whenISO: string }): Promise<string> {
    const id = uuid();
    this.reminders.set(id, { id, title: input.title, whenISO: input.whenISO, body: input.body });
    return id;
  }
  async cancelReminder(id: string): Promise<void> {
    this.reminders.delete(id);
  }
  async listReminders(): Promise<Array<{ id: string; title: string; whenISO: string }>> {
    return Array.from(this.reminders.values()).map(({ id, title, whenISO }) => ({ id, title, whenISO }));
  }
}

// ---------------------------------------------------------------------------
// Factory — returns the full container shape.
// ---------------------------------------------------------------------------
export function makeMemoryRepos() {
  return {
    auth: new AuthRepositoryMemory(),
    cases: new CaseRepositoryMemory(),
    parties: new PartyRepositoryMemory(),
    events: new EventRepositoryMemory(),
    documents: new DocumentRepositoryMemory(),
    issues: new IssueReviewRepositoryMemory(),
    patterns: new PatternRepositoryMemory(),
    billing: new BillingRepositoryMemory(),
    ocr: new OcrRepositoryMemory(),
    exports: new ExportRepositoryMemory(),
    notifications: new NotificationRepositoryMemory(),
    reports: new ContentReportRepositoryMemory(),
  };
}
