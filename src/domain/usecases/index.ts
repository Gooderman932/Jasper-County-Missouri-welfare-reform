// Application-layer use cases. Orchestrate repositories without knowing their implementations.

import {
  CaseEvent,
  CaseRecord,
  CoalitionOptIn,
  DocumentRecord,
  IssueFlag,
  PatternMatch,
} from '../entities';
import {
  AddCaseEventInput,
  AuthRepository,
  BillingRepository,
  CaseRepository,
  CreateCaseInput,
  DocumentRepository,
  EventRepository,
  ExportRepository,
  IssueReviewRepository,
  OcrRepository,
  PatternRepository,
  UploadDocumentInput,
} from '../repositories';
import { runGuidedReview, GuidedReviewAnswers } from '../services/guidedReview';
import { scanDocument } from '../services/prejudicialLanguage';

export interface UseCaseDeps {
  auth: AuthRepository;
  cases: CaseRepository;
  documents: DocumentRepository;
  events: EventRepository;
  issues: IssueReviewRepository;
  patterns: PatternRepository;
  billing: BillingRepository;
  ocr: OcrRepository;
  exports: ExportRepository;
}

export function makeUseCases(deps: UseCaseDeps) {
  return {
    async createCaseForCurrentUser(input: Omit<CreateCaseInput, 'ownerUserId'>): Promise<CaseRecord> {
      const user = await deps.auth.getCurrentUser();
      if (!user) throw new Error('Not signed in');
      return deps.cases.createCase({ ...input, ownerUserId: user.id });
    },

    async uploadDocumentWithOcr(input: Omit<UploadDocumentInput, 'ownerUserId'>): Promise<DocumentRecord> {
      const user = await deps.auth.getCurrentUser();
      if (!user) throw new Error('Not signed in');
      const doc = await deps.documents.uploadDocument({ ...input, ownerUserId: user.id });
      // Best-effort OCR (async; OCR failure should not block upload)
      let extractedText: string | undefined;
      try {
        const url = await deps.documents.getDownloadUrl(doc.id);
        const result = await deps.ocr.extractText(url, doc.mimeType);
        if (result.text) {
          extractedText = result.text;
          await deps.documents.updateDocumentMetadata(doc.id, { extractedText: result.text });
        }
      } catch (err) {
        // OCR is best-effort; surface via logs but don't fail upload.
        // eslint-disable-next-line no-console
        console.warn('[ocr] extraction failed', err);
      }

      // Run prejudicial-language scanner on any text we obtained. Emits issue
      // flags for prosecution-style framing detected in the document. Pure
      // pattern matching; no LLM. Best-effort — never blocks the upload.
      if (extractedText) {
        try {
          const scan = scanDocument({
            documentId: doc.id,
            documentTitle: doc.title,
            category: doc.category,
            extractedText,
          });
          for (const finding of scan.findings) {
            await deps.issues.createIssueFlag({
              caseId: doc.caseId,
              type: finding.issueType,
              severity: finding.severity,
              summary: finding.summary,
              explanation: finding.explanation,
              sourceRefs: [doc.id, `rule:${finding.ruleId}`],
              status: 'system_generated',
            });
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[prejudicial-scan] failed', err);
        }
      }
      return doc;
    },

    async addEvent(input: AddCaseEventInput): Promise<CaseEvent> {
      return deps.events.addEvent(input);
    },

    async runGuidedReview(caseId: string, answers: GuidedReviewAnswers): Promise<IssueFlag[]> {
      const flagInputs = runGuidedReview(caseId, answers);
      const created: IssueFlag[] = [];
      for (const fi of flagInputs) {
        const flag = await deps.issues.createIssueFlag(fi);
        created.push(flag);
      }
      return created;
    },

    async listCaseDetail(caseId: string) {
      const [record, events, documents, flags, patterns] = await Promise.all([
        deps.cases.getCaseById(caseId),
        deps.events.listEvents(caseId),
        deps.documents.listDocuments(caseId),
        deps.issues.listIssueFlags(caseId),
        deps.patterns.getPatternMatches(caseId),
      ]);
      return { record, events, documents, flags, patterns };
    },

    async submitCoalitionConsent(input: Omit<CoalitionOptIn, 'id' | 'consentTimestamp'>): Promise<CoalitionOptIn> {
      return deps.patterns.submitCoalitionOptIn({
        ...input,
        consentTimestamp: new Date().toISOString(),
      });
    },

    async getPatternsForCase(caseId: string): Promise<PatternMatch[]> {
      return deps.patterns.getPatternMatches(caseId);
    },

    async refreshEntitlement() {
      return deps.billing.syncEntitlement();
    },

    async startPremiumPurchase() {
      return deps.billing.purchasePremiumMonthly();
    },
  };
}

export type UseCases = ReturnType<typeof makeUseCases>;
