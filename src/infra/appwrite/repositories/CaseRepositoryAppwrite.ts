import { ID, Query } from 'react-native-appwrite';
import { CaseRecord } from '@domain/entities';
import { CaseRepository, CreateCaseInput, UpdateCaseInput } from '@domain/repositories';
import { databases, DATABASE, COLLECTIONS } from '../client';
import { ownerOnly } from '../permissions';
import { mapCase } from '../mappers';

export class CaseRepositoryAppwrite implements CaseRepository {
  async createCase(input: CreateCaseInput): Promise<CaseRecord> {
    const created = await databases.createDocument(
      DATABASE,
      COLLECTIONS.cases,
      ID.unique(),
      {
        ownerUserId: input.ownerUserId,
        title: input.title,
        jurisdictionState: input.jurisdictionState,
        jurisdictionCounty: input.jurisdictionCounty ?? null,
        caseType: input.caseType,
        status: 'open',
      },
      ownerOnly(input.ownerUserId)
    );
    return mapCase(created as any);
  }

  async updateCase(id: string, input: UpdateCaseInput): Promise<CaseRecord> {
    const updated = await databases.updateDocument(DATABASE, COLLECTIONS.cases, id, input);
    return mapCase(updated as any);
  }

  async listCases(userId: string): Promise<CaseRecord[]> {
    const res = await databases.listDocuments(DATABASE, COLLECTIONS.cases, [
      Query.equal('ownerUserId', userId),
      Query.orderDesc('$updatedAt'),
      Query.limit(100),
    ]);
    return res.documents.map((d) => mapCase(d as any));
  }

  async getCaseById(id: string): Promise<CaseRecord | null> {
    try {
      const d = await databases.getDocument(DATABASE, COLLECTIONS.cases, id);
      return mapCase(d as any);
    } catch {
      return null;
    }
  }

  async archiveCase(id: string): Promise<void> {
    await databases.updateDocument(DATABASE, COLLECTIONS.cases, id, { status: 'archived' });
  }
}
