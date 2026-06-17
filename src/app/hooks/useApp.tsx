import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, SubscriptionEntitlement } from '@domain/entities';
import { Container } from './useContainer';

interface AppCtx {
  container: Container;
  user: User | null;
  entitlement: SubscriptionEntitlement | null;
  refreshUser: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const Ctx = createContext<AppCtx | null>(null);

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

  const refreshUser = useCallback(async () => {
    setUser(await container.auth.getCurrentUser());
  }, [container]);

  const refreshEntitlement = useCallback(async () => {
    setEntitlement(await container.billing.syncEntitlement());
  }, [container]);

  return (
    <Ctx.Provider value={{ container, user, entitlement, refreshUser, refreshEntitlement, setUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppContextProvider');
  return v;
}

export function isPremium(entitlement: SubscriptionEntitlement | null): boolean {
  if (!entitlement) return false;
  return ['trialing', 'active', 'grace_period'].includes(entitlement.status);
}
