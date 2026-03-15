// =============================================
// File: app/wiki/page.tsx
// (전체 코드)
// - 위키 메인 페이지(문서 트리/본문 뷰)
// - 인증 정보(user) 조회
// - WikiPageInner(클라이언트 컴포넌트) 동적 import
// - auth/me 호출 시 불필요한 _ts 제거
// =============================================
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import '@wiki/css/wiki.css';

type User = {
  id: number;
  username: string;
  minecraft_name: string;
  email: string;
} | null;

const WikiPageInner = dynamic(() => import('@/components/wiki/WikiPageInner'), {
  ssr: false,
});

export default function WikiPage() {
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setUser(data?.user ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="wiki-app">
      <WikiPageInner user={user} />
    </div>
  );
}