import { ID, Query } from 'react-native-appwrite';
import { User } from '@domain/entities';
import { AuthRepository } from '@domain/repositories';
import { account, databases, DATABASE, COLLECTIONS } from '../client';
import { ownerOnly } from '../permissions';
import { mapUser } from '../mappers';

export class AuthRepositoryAppwrite implements AuthRepository {
  async signUp(email: string, password: string, displayName?: string): Promise<User> {
    const created = await account.create(ID.unique(), email, password, displayName);
    await account.createEmailPasswordSession(email, password);
    // Create profile doc
    const profile = await databases.createDocument(
      DATABASE,
      COLLECTIONS.users_profile,
      created.$id,
      {
        email,
        displayName: displayName ?? null,
        subscriptionStatus: 'free',
        onboardingComplete: false,
      },
      ownerOnly(created.$id)
    );
    return mapUser(profile as any);
  }

  async signIn(email: string, password: string): Promise<User> {
    await account.createEmailPasswordSession(email, password);
    const me = await account.get();
    try {
      const profile = await databases.getDocument(DATABASE, COLLECTIONS.users_profile, me.$id);
      return mapUser(profile as any);
    } catch {
      // Self-heal if profile missing
      const profile = await databases.createDocument(
        DATABASE,
        COLLECTIONS.users_profile,
        me.$id,
        { email: me.email, subscriptionStatus: 'free', onboardingComplete: false },
        ownerOnly(me.$id)
      );
      return mapUser(profile as any);
    }
  }

  async signOut(): Promise<void> {
    try {
      await account.deleteSession('current');
    } catch {
      // ignore
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const me = await account.get();
      const profile = await databases.getDocument(DATABASE, COLLECTIONS.users_profile, me.$id);
      return mapUser(profile as any);
    } catch {
      return null;
    }
  }

  async updateProfile(input: Partial<User>): Promise<User> {
    const me = await account.get();
    const updated = await databases.updateDocument(
      DATABASE,
      COLLECTIONS.users_profile,
      me.$id,
      {
        displayName: input.displayName,
        onboardingComplete: input.onboardingComplete,
        region: input.region,
      }
    );
    return mapUser(updated as any);
  }
}
