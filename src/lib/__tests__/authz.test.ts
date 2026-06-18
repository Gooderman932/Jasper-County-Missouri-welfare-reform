import {
  assertCanRead,
  assertCanWrite,
  canExport,
  AuthorizationError,
  type AuthedUser,
} from '../authz';

const admin: AuthedUser = { id: 'a1', role: 'admin' };
const attorney: AuthedUser = { id: 'at1', role: 'attorney' };
const paralegal: AuthedUser = { id: 'p1', role: 'paralegal' };
const client: AuthedUser = { id: 'c1', role: 'client' };

describe('assertCanRead', () => {
  it('denies anonymous reads', () => {
    expect(() => assertCanRead(null, {})).toThrow(AuthorizationError);
  });

  it('lets admins read anything', () => {
    expect(() => assertCanRead(admin, { clientId: 'someone-else' })).not.toThrow();
  });

  it('lets an attorney read only their assigned cases', () => {
    expect(() => assertCanRead(attorney, { assignedAttorneyId: 'at1' })).not.toThrow();
    expect(() => assertCanRead(attorney, { assignedAttorneyId: 'other' })).toThrow(AuthorizationError);
  });

  it('lets a client read only their own case', () => {
    expect(() => assertCanRead(client, { clientId: 'c1' })).not.toThrow();
    expect(() => assertCanRead(client, { clientId: 'other' })).toThrow(AuthorizationError);
  });

  it('honors ownerId as a fallback', () => {
    expect(() => assertCanRead(paralegal, { ownerId: 'p1' })).not.toThrow();
  });
});

describe('assertCanWrite', () => {
  it('denies anonymous writes', () => {
    expect(() => assertCanWrite(null, {})).toThrow(AuthorizationError);
  });

  it('forbids paralegals from writing assigned cases (read-only role)', () => {
    expect(() => assertCanWrite(paralegal, { assignedAttorneyId: 'p1' })).toThrow(AuthorizationError);
  });

  it('forbids a client from writing even their own case', () => {
    expect(() => assertCanWrite(client, { clientId: 'c1' })).toThrow(AuthorizationError);
  });

  it('lets the owner write', () => {
    expect(() => assertCanWrite(client, { ownerId: 'c1' })).not.toThrow();
  });
});

describe('canExport', () => {
  it('permits admin, attorney, client; denies paralegal and anonymous', () => {
    expect(canExport(admin)).toBe(true);
    expect(canExport(attorney)).toBe(true);
    expect(canExport(client)).toBe(true);
    expect(canExport(paralegal)).toBe(false);
    expect(canExport(null)).toBe(false);
  });
});
