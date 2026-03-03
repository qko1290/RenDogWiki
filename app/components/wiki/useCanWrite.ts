// =============================================
// File: app/components/wiki/useCanWrite.ts
// =============================================
'use client';

import { useEffect, useState } from 'react';

type User = {
  id: number;
  username: string;
  minecraft_name: string;
  email: string;
} | null;

export function useCanWrite(user: User) {
  const [can, setCan] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!user) {
          setCan(false);
          return;
        }

        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        const me = r.ok ? await r.json() : null;

        const role = (me?.role ?? me?.user?.role ?? '').toLowerCase?.() || '';
        const roles: string[] = (me?.roles ?? me?.user?.roles ?? me?.permissions ?? me?.user?.permissions ?? [])
          .map((v: any) => String(v).toLowerCase());

        const ok =
          role === 'admin' ||
          role === 'writer' ||
          roles.includes('admin') ||
          roles.includes('writer');

        if (!cancelled) setCan(!!ok);
      } catch {
        if (!cancelled) setCan(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return can;
}