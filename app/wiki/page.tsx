// =============================================
// File: app/wiki/page.tsx
// (전체 코드)
// - 위키 메인 페이지
// - 초기 진입에서 /api/auth/me를 즉시 호출하지 않음
// - bootstrap/documents와 겹치지 않도록 약간 지연 후 사용자 정보 조회
// =============================================

'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import '@wiki/css/wiki.css';

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

    // ✅ 초기 bootstrap / documents 요청과 겹치지 않게 약간 뒤로 미룸
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

  return <WikiPageInner user={user} />;
}