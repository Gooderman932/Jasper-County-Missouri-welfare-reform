/**
 * Role-based access control helper.
 *
 * Required by HIPAA §164.308(a)(4) (Information Access Management) and
 * §164.312(a)(1) (Access Control). Every mutation that touches PHI must
 * call assertCanWrite() before issuing the Appwrite operation.
 *
 * Roles:
 *   - admin: full read/write across cases
 *   - attorney: read/write cases where assignedAttorneyId === user.id
 *   - paralegal: read-only on assigned cases
 *   - client: read-only on cases where clientId === user.id
 *   - anonymous: no access
 */

export type Role = "admin" | "attorney" | "paralegal" | "client" | "anonymous";

export interface AuthedUser {
  id: string;
  role: Role;
}

export interface Resource {
  assignedAttorneyId?: string | null;
  clientId?: string | null;
  ownerId?: string | null;
}

export class AuthorizationError extends Error {
  constructor(reason: string) {
    super(`authorization denied: ${reason}`);
    this.name = "AuthorizationError";
  }
}

export function assertCanRead(user: AuthedUser | null, resource: Resource): void {
  if (!user) throw new AuthorizationError("anonymous read");
  if (user.role === "admin") return;
  if (user.role === "attorney" && resource.assignedAttorneyId === user.id) return;
  if (user.role === "paralegal" && resource.assignedAttorneyId === user.id) return;
  if (user.role === "client" && resource.clientId === user.id) return;
  if (resource.ownerId && resource.ownerId === user.id) return;
  throw new AuthorizationError(`role=${user.role} cannot read resource`);
}

export function assertCanWrite(user: AuthedUser | null, resource: Resource): void {
  if (!user) throw new AuthorizationError("anonymous write");
  if (user.role === "admin") return;
  if (user.role === "attorney" && resource.assignedAttorneyId === user.id) return;
  if (resource.ownerId && resource.ownerId === user.id) return;
  throw new AuthorizationError(`role=${user.role} cannot write resource`);
}

export function canExport(user: AuthedUser | null): boolean {
  if (!user) return false;
  return user.role === "admin" || user.role === "attorney" || user.role === "client";
}
