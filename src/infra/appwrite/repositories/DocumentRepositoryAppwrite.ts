import { ID, Query } from 'react-native-appwrite';
import { DocumentRecord } from '@domain/entities';
import { DocumentRepository, UploadDocumentInput } from '@domain/repositories';
import { databases, storage, DATABASE, COLLECTIONS, BUCKETS } from '../client';
import { ownerOnly } from '../permissions';
import { mapDocument } from '../mappers';

export class DocumentRepositoryAppwrite implements DocumentRepository {
  async uploadDocument(input: UploadDocumentInput): Promise<DocumentRecord> {
    // react-native-appwrite Storage.createFile expects an InputFile-like object.
    // Caller passes a local URI (file://, content://) — RN side will read it.
    const file = await storage.createFile(
      BUCKETS.raw,
      ID.unique(),
      { uri: input.fileUri, name: input.title, type: input.mimeType } as any,
      ownerOnly(input.ownerUserId)
    );

    const doc = await databases.createDocument(
      DATABASE,
      COLLECTIONS.documents,
      ID.unique(),
      {
        caseId: input.caseId,
        ownerUserId: input.ownerUserId,
        title: input.title,
        category: input.category,
        bucketId: BUCKETS.raw,
        fileId: file.$id,
        mimeType: input.mimeType,
        uploadedAt: new Date().toISOString(),
        redactionStatus: 'raw',
        tags: input.tags ?? [],
      },
      ownerOnly(input.ownerUserId)
    );

    return mapDocument(doc as any);
  }

  async listDocuments(caseId: string): Promise<DocumentRecord[]> {
    const res = await databases.listDocuments(DATABASE, COLLECTIONS.documents, [
      Query.equal('caseId', caseId),
      Query.orderDesc('$createdAt'),
      Query.limit(500),
    ]);
    return res.documents.map((d) => mapDocument(d as any));
  }

  async updateDocumentMetadata(id: string, input: Partial<DocumentRecord>): Promise<DocumentRecord> {
    const updated = await databases.updateDocument(DATABASE, COLLECTIONS.documents, id, {
      title: input.title,
      category: input.category,
      extractedText: input.extractedText,
      redactionStatus: input.redactionStatus,
      tags: input.tags,
    });
    return mapDocument(updated as any);
  }

  async deleteDocument(id: string): Promise<void> {
    const doc = await databases.getDocument(DATABASE, COLLECTIONS.documents, id);
    try {
      await storage.deleteFile((doc as any).bucketId, (doc as any).fileId);
    } catch {
      // ignore — orphan file is cheaper than dangling metadata
    }
    await databases.deleteDocument(DATABASE, COLLECTIONS.documents, id);
  }

  async getDownloadUrl(id: string): Promise<string> {
    const doc = await databases.getDocument(DATABASE, COLLECTIONS.documents, id);
    const r = storage.getFileView((doc as any).bucketId, (doc as any).fileId);
    return r.toString();
  }
}
