import { ID, Query } from 'react-native-appwrite';
import { AttorneyReviewRequest, CoalitionOptIn, PatternMatch } from '@domain/entities';
import { PatternRepository } from '@domain/repositories';
import { account, databases, functions, DATABASE, COLLECTIONS } from '../client';
import { ownerOnly } from '../permissions';
import { mapCoalition, mapPattern } from '../mappers';

const PATTERN_FUNCTION_ID = 'pattern-match';

export class PatternRepositoryAppwrite implements PatternRepository {
  async getPatternMatches(caseId: string): Promise<PatternMatch[]> {
    // First try the server-side function for fresh matches.
    try {
      const exec = await functions.createExecution(PATTERN_FUNCTION_ID, JSON.stringify({ caseId }));
      // The function persists pattern_matches rows; we still read from DB for the canonical list.
      void exec;
    } catch {
      // function not deployed yet — fall back to stored rows
    }
    const res = await databases.listDocuments(DATABASE, COLLECTIONS.pattern_matches, [
      Query.equal('caseId', caseId),
      Query.orderDesc('score'),
      Query.limit(50),
    ]);
    return res.documents.map((d) => mapPattern(d as any));
  }

  async submitCoalitionOptIn(input: Omit<CoalitionOptIn, 'id'>): Promise<CoalitionOptIn> {
    const me = await account.get();
    const created = await databases.createDocument(
      DATABASE,
      COLLECTIONS.coalition_opt_ins,
      ID.unique(),
      {
        userId: input.userId,
        caseId: input.caseId,
        consentToPatternMatching: input.consentToPatternMatching,
        consentToAnonymizedCohortStats: input.consentToAnonymizedCohortStats,
        consentToAttorneyReview: input.consentToAttorneyReview,
        consentToAdvocateReview: input.consentToAdvocateReview,
        consentTimestamp: input.consentTimestamp,
      },
      ownerOnly(me.$id)
    );
    return mapCoalition(created as any);
  }

  async getCoalitionOptIn(caseId: string): Promise<CoalitionOptIn | null> {
    const me = await account.get();
    const res = await databases.listDocuments(DATABASE, COLLECTIONS.coalition_opt_ins, [
      Query.equal('caseId', caseId),
      Query.equal('userId', me.$id),
      Query.orderDesc('$createdAt'),
      Query.limit(1),
    ]);
    return res.documents.length > 0 ? mapCoalition(res.documents[0] as any) : null;
  }

  async requestAttorneyReview(caseId: string, exportId?: string): Promise<AttorneyReviewRequest> {
    const me = await account.get();
    const optIn = await this.getCoalitionOptIn(caseId);
    if (!optIn || !optIn.consentToAttorneyReview) {
      throw new Error(
        'Attorney review requires explicit consent. Please submit a coalition opt-in with attorney review enabled first.'
      );
    }
    const created = await databases.createDocument(
      DATABASE,
      COLLECTIONS.attorney_review_requests,
      ID.unique(),
      {
        caseId,
        userId: me.$id,
        submittedAt: new Date().toISOString(),
        status: 'pending',
        consentSnapshot: JSON.stringify(optIn),
        packetExportId: exportId ?? null,
      },
      ownerOnly(me.$id)
    );
    return {
      id: (created as any).$id,
      caseId,
      userId: me.$id,
      submittedAt: (created as any).submittedAt,
      status: 'pending',
      consentSnapshot: optIn,
      packetExportId: exportId,
    };
  }
}
