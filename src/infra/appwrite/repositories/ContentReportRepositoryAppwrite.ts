import { ID, Query } from 'react-native-appwrite';
import { ContentReport, ContentReportStatus } from '@domain/entities';
import {
  ContentReportRepository,
  CreateContentReportInput,
} from '@domain/repositories';
import { ADMIN_TEAM_ID, COLLECTIONS, DATABASE, databases } from '../client';
import { mapContentReport } from '../mappers';
import { reportPermissions } from '../permissions';

export class ContentReportRepositoryAppwrite implements ContentReportRepository {
  async createReport(input: CreateContentReportInput): Promise<ContentReport> {
    const created = await databases.createDocument(
      DATABASE,
      COLLECTIONS.content_reports,
      ID.unique(),
      {
        caseId: input.caseId,
        reporterUserId: input.reporterUserId ?? null,
        reason: input.reason,
        details: input.details ?? null,
        status: 'open',
      },
      reportPermissions(ADMIN_TEAM_ID),
    );
    return mapContentReport(created as any);
  }

  async listReportsForCase(caseId: string): Promise<ContentReport[]> {
    const res = await databases.listDocuments(DATABASE, COLLECTIONS.content_reports, [
      Query.equal('caseId', caseId),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ]);
    return res.documents.map((d) => mapContentReport(d as any));
  }

  async listAllReports(status?: ContentReportStatus): Promise<ContentReport[]> {
    const queries = [Query.orderDesc('$createdAt'), Query.limit(200)];
    if (status) queries.push(Query.equal('status', status));
    const res = await databases.listDocuments(DATABASE, COLLECTIONS.content_reports, queries);
    return res.documents.map((d) => mapContentReport(d as any));
  }

  async updateReportStatus(
    id: string,
    status: ContentReportStatus,
    resolutionNote?: string,
  ): Promise<ContentReport> {
    const patch: Record<string, any> = { status };
    if (resolutionNote !== undefined) patch.resolutionNote = resolutionNote;
    if (status === 'resolved' || status === 'dismissed') {
      patch.resolvedAt = new Date().toISOString();
    }
    const updated = await databases.updateDocument(
      DATABASE,
      COLLECTIONS.content_reports,
      id,
      patch,
    );
    return mapContentReport(updated as any);
  }
}
