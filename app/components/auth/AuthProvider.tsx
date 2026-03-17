// =============================================
// File: components/auth/AuthProvider.tsx
// (전체 코드)
// - 전역 인증/권한 상태 공급자
// - 최초 1회 /api/auth/me 호출
// - 어디서든 useAuth()로 user / role / canWrite / isAdmin 사용
// - 기존 구조를 크게 바꾸지 않고 전역 권한 상태만 추가
// =============================================
'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type Role = 'guest' | 'writer' | 'admin';

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  minecraft_name: string;
} | null;

type AuthMeResponse = {
  loggedIn?: boolean;
  user?: AuthUser;
  role?: string;
  roles?: string[];
  permissions?: string[];
  degraded?: boolean;
  roleSource?: string;
};

type AuthContextValue = {
  user: AuthUser;
  role: Role;
  loggedIn: boolean;
  loading: boolean;
  hydrated: boolean;
  degraded: boolean;
  roleSource: string | null;
  canWrite: boolean;
  isAdmin: boolean;
  refreshAuth: (opts?: { force?: boolean }) => Promise<void>;
  setAuthFromPayload: (payload: Partial<AuthMeResponse>) => void;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeRole(value: unknown): Role {
  const s = String(value ?? '').toLowerCase();
  if (s === 'admin') return 'admin';
  if (s === 'writer') return 'writer';
  return 'guest';
}

function isLoggedInPayload(user: AuthUser, loggedIn?: boolean) {
  if (typeof loggedIn === 'boolean') return loggedIn && !!user;
  return !!user;
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser>(null);
  const [role, setRole] = useState<Role>('guest');
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [roleSource, setRoleSource] = useState<string | null>(null);

  const inFlightRef = useRef<Promise<void> | null>(null);

  const applyPayload = useCallback((payload: Partial<AuthMeResponse>) => {
    const nextUser = (payload.user ?? null) as AuthUser;
    const nextRole = normalizeRole(payload.role);
    const nextLoggedIn = isLoggedInPayload(nextUser, payload.loggedIn);

    setUser(nextUser);
    setRole(nextRole);
    setLoggedIn(nextLoggedIn);
    setDegraded(Boolean(payload.degraded));
    setRoleSource(payload.roleSource ?? null);
    setHydrated(true);
    setLoading(false);
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setRole('guest');
    setLoggedIn(false);
    setDegraded(false);
    setRoleSource(null);
    setHydrated(true);
    setLoading(false);
  }, []);

  const refreshAuth = useCallback(
    async (opts?: { force?: boolean }) => {
      if (inFlightRef.current && !opts?.force) {
        return inFlightRef.current;
      }

      const task = (async () => {
        try {
          if (!hydrated) {
            setLoading(true);
          }

          const url = opts?.force ? '/api/auth/me?fresh=1' : '/api/auth/me';

          const res = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-store',
            },
          });

          if (!res.ok) {
            clearAuth();
            return;
          }

          const data = (await res.json()) as AuthMeResponse;
          applyPayload(data);
        } catch (err) {
          console.error('[AuthProvider] refreshAuth failed:', err);
          clearAuth();
        } finally {
          inFlightRef.current = null;
        }
      })();

      inFlightRef.current = task;
      return task;
    },
    [applyPayload, clearAuth, hydrated]
  );

  const setAuthFromPayload = useCallback(
    (payload: Partial<AuthMeResponse>) => {
      applyPayload({
        loggedIn: true,
        user: payload.user ?? null,
        role: payload.role ?? 'guest',
        degraded: Boolean(payload.degraded),
        roleSource: payload.roleSource ?? 'manual',
      });
    },
    [applyPayload]
  );

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    const handler = () => {
      void refreshAuth({ force: true });
    };

    window.addEventListener('rdwiki-auth-changed', handler);
    return () => {
      window.removeEventListener('rdwiki-auth-changed', handler);
    };
  }, [refreshAuth]);

  const value = useMemo<AuthContextValue>(() => {
    const canWrite = role === 'writer' || role === 'admin';
    const isAdmin = role === 'admin';

    return {
      user,
      role,
      loggedIn,
      loading,
      hydrated,
      degraded,
      roleSource,
      canWrite,
      isAdmin,
      refreshAuth,
      setAuthFromPayload,
      clearAuth,
    };
  }, [
    user,
    role,
    loggedIn,
    loading,
    hydrated,
    degraded,
    roleSource,
    refreshAuth,
    setAuthFromPayload,
    clearAuth,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}