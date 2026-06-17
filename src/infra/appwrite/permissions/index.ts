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

/**
 * Permissions for a publicly visible case:
 *   - Anyone (including unauthenticated guests) can read
 *   - Only the owner can write
 *   - Admin team can read for moderation
 */
export const publicReadOwnerWrite = (userId: string, adminTeamId?: string) => {
  const perms = [
    Permission.read(Role.any()),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
  if (adminTeamId) {
    perms.push(Permission.read(Role.team(adminTeamId, 'admin')));
    perms.push(Permission.update(Role.team(adminTeamId, 'admin')));
  }
  return perms;
};

/**
 * Permissions for content reports. Authenticated users may create; only
 * admins may read and update.
 */
export const reportPermissions = (adminTeamId: string) => [
  Permission.create(Role.users()),
  Permission.read(Role.team(adminTeamId, 'admin')),
  Permission.update(Role.team(adminTeamId, 'admin')),
  Permission.delete(Role.team(adminTeamId, 'admin')),
];
