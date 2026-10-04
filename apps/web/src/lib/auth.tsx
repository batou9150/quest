import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Me } from '@quest/shared';
import { api, ApiError } from './api';

interface Session {
  /** The logged-in user, or null when logged out. */
  me: Me | null;
  /** True until the first /api/me call settles. */
  loading: boolean;
  /** Set when /api/me failed for a reason other than 401 (e.g. server down). */
  error: ApiError | null;
  /** Reloads /api/me (after login, profile update, level start...). */
  refresh: () => Promise<Me | null>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    try {
      const user = await api<Me>('/api/me');
      setMe(user);
      setError(null);
      return user;
    } catch (err) {
      setMe(null);
      setError(err instanceof ApiError && err.status !== 401 ? err : null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api<void>('/auth/logout', { method: 'POST' });
    } finally {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<Session>(() => ({ me, loading, error, refresh, logout }), [me, loading, error, refresh, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useMe(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useMe() must be used inside <SessionProvider>');
  return session;
}
