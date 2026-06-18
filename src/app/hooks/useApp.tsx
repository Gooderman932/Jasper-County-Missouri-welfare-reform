import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { User, SubscriptionEntitlement } from '@domain/entities';
import { isSessionExpired, SESSION_TIMEOUT_MS } from '../../lib/sessionTimeout';
import { Container } from './useContainer';

interface AppCtx {
  container: Container;
  user: User | null;
  entitlement: SubscriptionEntitlement | null;
  refreshUser: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  setUser: (u: User | null) => void;
  /** Call on any user interaction to reset the inactivity timer. */
  recordActivity: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

// How often we poll for inactivity expiry. Cheap; the real clock is the
// lastActivity timestamp compared against SESSION_TIMEOUT_MS.
const SESSION_CHECK_INTERVAL_MS = 30 * 1000;

export function AppContextProvider({
  container,
  initialUser,
  children,
}: {
  container: Container;
  initialUser: User | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [entitlement, setEntitlement] = useState<SubscriptionEntitlement | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const refreshUser = useCallback(async () => {
    setUser(await container.auth.getCurrentUser());
  }, [container]);

  const refreshEntitlement = useCallback(async () => {
    setEntitlement(await container.billing.syncEntitlement());
  }, [container]);

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // HIPAA §164.312(a)(2)(iii) automatic logoff: sign the user out after
  // SESSION_TIMEOUT_MS of inactivity so an unattended device can't be used.
  useEffect(() => {
    if (!user) return;
    lastActivityRef.current = Date.now();
    const id = setInterval(() => {
      if (isSessionExpired(lastActivityRef.current)) {
        container.auth.signOut().catch(() => {/* best-effort */});
        setEntitlement(null);
        setUser(null);
      }
    }, SESSION_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, container]);

  return (
    <Ctx.Provider
      value={{ container, user, entitlement, refreshUser, refreshEntitlement, setUser, recordActivity }}
    >
      {children}
    </Ctx.Provider>
  );
}

export { SESSION_TIMEOUT_MS };

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppContextProvider');
  return v;
}

export function isPremium(entitlement: SubscriptionEntitlement | null): boolean {
  if (!entitlement) return false;
  return ['trialing', 'active', 'grace_period'].includes(entitlement.status);
}
