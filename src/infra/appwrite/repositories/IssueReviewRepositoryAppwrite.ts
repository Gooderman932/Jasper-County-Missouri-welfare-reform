import { ID, Query } from 'react-native-appwrite';
import { IssueFlag } from '@domain/entities';
import { CreateIssueFlagInput, IssueReviewRepository } from '@domain/repositories';
import { account, databases, DATABASE, COLLECTIONS } from '../client';
import { ownerOnly } from '../permissions';
import { mapIssue } from '../mappers';

export class IssueReviewRepositoryAppwrite implements IssueReviewRepository {
  async listIssueFlags(caseId: string): Promise<IssueFlag[]> {
    const res = await databases.listDocuments(DATABASE, COLLECTIONS.issue_flags, [
      Query.equal('caseId', caseId),
      Query.orderDesc('$createdAt'),
      Query.limit(500),
    ]);
    return res.documents.map((d) => mapIssue(d as any));
  }

  async createIssueFlag(input: CreateIssueFlagInput): Promise<IssueFlag> {
    const me = await account.get();
    const created = await databases.createDocument(
      DATABASE,
      COLLECTIONS.issue_flags,
      ID.unique(),
      {
        caseId: input.caseId,
        type: input.type,
        severity: input.severity,
        status: input.status ?? 'system_generated',
        summary: input.summary,
        explanation: input.explanation,
        sourceRefs: input.sourceRefs ?? [],
      },
      ownerOnly(me.$id)
    );
    return mapIssue(created as any);
  }

  async updateIssueFlag(id: string, input: Partial<IssueFlag>): Promise<IssueFlag> {
    const updated = await databases.updateDocument(DATABASE, COLLECTIONS.issue_flags, id, input);
    return mapIssue(updated as any);
  }
}
