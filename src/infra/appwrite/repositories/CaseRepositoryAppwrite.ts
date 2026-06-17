import { ID, Query } from 'react-native-appwrite';
import { CaseRecord } from '@domain/entities';
import {
  CaseRepository,
  CreateCaseInput,
  ListPublicCasesOptions,
  PublishCaseInput,
  UpdateCaseInput,
} from '@domain/repositories';
import { ADMIN_TEAM_ID, COLLECTIONS, DATABASE, databases } from '../client';
import { ownerOnly, publicReadOwnerWrite } from '../permissions';
import { mapCase } from '../mappers';

function makeSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || `case-${Date.now().toString(36)}`
  );
}

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
        visibility: 'private',
      },
      ownerOnly(input.ownerUserId),
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

  async publishCase(input: PublishCaseInput): Promise<CaseRecord> {
    const existing = await this.getCaseById(input.caseId);
    if (!existing) throw new Error('case not found');
    if (existing.ownerUserId !== input.publishedByUserId) {
      throw new Error('only the case owner may publish');
    }
    const slug = existing.publicSlug ?? makeSlug(input.publicTitle ?? existing.title);
    // 1. Update the document fields
    const updated = await databases.updateDocument(DATABASE, COLLECTIONS.cases, input.caseId, {
      visibility: 'public',
      publicSlug: slug,
      publishedAt: new Date().toISOString(),
      publishedBy: input.publishedByUserId,
      unpublishedAt: null,
      publicTitle: input.publicTitle ?? null,
      publicSummary: input.publicSummary ?? null,
      redactionPolicy: input.redactionPolicy,
      isReferenceCase: input.isReferenceCase ?? false,
    });
    // 2. Relax permissions so guests can read
    await databases.updateDocument(
      DATABASE,
      COLLECTIONS.cases,
      input.caseId,
      {},
      publicReadOwnerWrite(input.publishedByUserId, ADMIN_TEAM_ID),
    );
    return mapCase(updated as any);
  }

  async unpublishCase(caseId: string, requestingUserId: string): Promise<CaseRecord> {
    const existing = await this.getCaseById(caseId);
    if (!existing) throw new Error('case not found');
    if (existing.ownerUserId !== requestingUserId) {
      throw new Error('only the case owner may unpublish');
    }
    const updated = await databases.updateDocument(DATABASE, COLLECTIONS.cases, caseId, {
      visibility: 'private',
      unpublishedAt: new Date().toISOString(),
    });
    // Lock permissions back to owner-only
    await databases.updateDocument(
      DATABASE,
      COLLECTIONS.cases,
      caseId,
      {},
      ownerOnly(requestingUserId),
    );
    return mapCase(updated as any);
  }

  async listPublicCases(options: ListPublicCasesOptions = {}): Promise<CaseRecord[]> {
    const queries = [
      Query.equal('visibility', 'public'),
      Query.orderDesc('publishedAt'),
      Query.limit(options.limit ?? 50),
    ];
    if (options.referenceOnly) queries.push(Query.equal('isReferenceCase', true));
    if (options.cursor) queries.push(Query.cursorAfter(options.cursor));
    const res = await databases.listDocuments(DATABASE, COLLECTIONS.cases, queries);
    return res.documents.map((d) => mapCase(d as any));
  }

  async getPublicCaseBySlug(slug: string): Promise<CaseRecord | null> {
    const res = await databases.listDocuments(DATABASE, COLLECTIONS.cases, [
      Query.equal('visibility', 'public'),
      Query.equal('publicSlug', slug),
      Query.limit(1),
    ]);
    if (res.documents.length === 0) return null;
    return mapCase(res.documents[0] as any);
  }
}
