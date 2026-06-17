import { ID, Query } from 'react-native-appwrite';
import { CaseParty } from '@domain/entities';
import { PartyRepository } from '@domain/repositories';
import { account, databases, DATABASE, COLLECTIONS } from '../client';
import { ownerOnly } from '../permissions';
import { mapParty } from '../mappers';

export class PartyRepositoryAppwrite implements PartyRepository {
  async addParty(caseId: string, party: Omit<CaseParty, 'id' | 'caseId'>): Promise<CaseParty> {
    const me = await account.get();
    const created = await databases.createDocument(
      DATABASE,
      COLLECTIONS.case_parties,
      ID.unique(),
      {
        caseId,
        role: party.role,
        displayLabel: party.displayLabel,
        legalName: party.legalName ?? null,
        anonymizedLabel: party.anonymizedLabel ?? null,
        isMinor: party.isMinor ?? null,
      },
      ownerOnly(me.$id)
    );
    return mapParty(created as any);
  }
  async listParties(caseId: string): Promise<CaseParty[]> {
    const res = await databases.listDocuments(DATABASE, COLLECTIONS.case_parties, [
      Query.equal('caseId', caseId),
      Query.limit(100),
    ]);
    return res.documents.map((d) => mapParty(d as any));
  }
  async removeParty(partyId: string): Promise<void> {
    await databases.deleteDocument(DATABASE, COLLECTIONS.case_parties, partyId);
  }
}
