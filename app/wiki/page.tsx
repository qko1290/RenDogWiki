// =============================================
// File: app/wiki/page.tsx
// (전체 코드)
// =============================================
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import '@wiki/css/wiki.css';

// ✅ 네 현재 구조 기준 실제 사용 경로로 맞춰야 함
const WikiPageInner = dynamic(() => import('@/components/wiki/WikiPageInner'), {
  ssr: false,
});

type User = {
  id: number;
  username: string;
  minecraft_name: string;
  email: string;
} | null;

export default function WikiPage() {
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = res.ok ? await res.json() : null;

        if (!cancelled) {
          setUser(data?.user ?? null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="wiki-app">
      <WikiPageInner user={user} />
    </div>
  );
}