import { Permission, Role } from 'react-native-appwrite';

// Owner-only by default. Coalition/attorney review uses SEPARATE documents
// rather than relaxing permissions on raw case data.
export const ownerOnly = (userId: string) => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
  Permission.delete(Role.user(userId)),
];

export const ownerPlusAdmin = (userId: string, adminTeamId: string) => [
  Permission.read(Role.user(userId)),
  Permission.update(Role.user(userId)),
  Permission.delete(Role.user(userId)),
  Permission.read(Role.team(adminTeamId, 'admin')),
];
