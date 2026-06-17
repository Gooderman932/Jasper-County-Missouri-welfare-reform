import { ID, Query } from 'react-native-appwrite';
import { CaseEvent } from '@domain/entities';
import { AddCaseEventInput, EventRepository } from '@domain/repositories';
import { databases, DATABASE, COLLECTIONS, account } from '../client';
import { ownerOnly } from '../permissions';
import { mapEvent } from '../mappers';

export class EventRepositoryAppwrite implements EventRepository {
  async addEvent(input: AddCaseEventInput): Promise<CaseEvent> {
    const me = await account.get();
    const created = await databases.createDocument(
      DATABASE,
      COLLECTIONS.case_events,
      ID.unique(),
      {
        caseId: input.caseId,
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        description: input.description,
        sourceDocumentId: input.sourceDocumentId ?? null,
        tags: input.tags ?? [],
      },
      ownerOnly(me.$id)
    );
    return mapEvent(created as any);
  }

  async listEvents(caseId: string): Promise<CaseEvent[]> {
    const res = await databases.listDocuments(DATABASE, COLLECTIONS.case_events, [
      Query.equal('caseId', caseId),
      Query.orderAsc('occurredAt'),
      Query.limit(500),
    ]);
    return res.documents.map((d) => mapEvent(d as any));
  }

  async updateEvent(id: string, input: Partial<CaseEvent>): Promise<CaseEvent> {
    const updated = await databases.updateDocument(DATABASE, COLLECTIONS.case_events, id, input);
    return mapEvent(updated as any);
  }

  async deleteEvent(id: string): Promise<void> {
    await databases.deleteDocument(DATABASE, COLLECTIONS.case_events, id);
  }
}
