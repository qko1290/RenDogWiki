// File: app/manage/layout.tsx
/**
 * 관리 영역 레이아웃 가드
 * - /api/auth/me로 역할 조회 후 writer/admin만 접근 허용
 * - 권한 없으면 /wiki로, 네트워크/예외 시 /login으로 리다이렉트
 * - 로딩 중/리다이렉트 중엔 아무것도 렌더하지 않음(깜빡임 방지)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Role = 'guest' | 'writer' | 'admin';

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store', signal: ac.signal });
        const data = res.ok ? await res.json() : null;
        const role = (data?.user?.role ?? 'guest') as Role;
        const ok = role === 'writer' || role === 'admin';

        if (!alive) return;
        setAllowed(ok);
        setReady(true);

        // 권한이 없으면 위키로 돌려보냄 (정상 응답 기준)
        if (!ok) router.replace('/wiki');
      } catch (e: any) {
        // 언마운트로 인한 취소는 조용히 무시
        if ((e && e.name) === 'AbortError') return;

        if (!alive) return;
        setAllowed(false);
        setReady(true);

        // 비로그인/네트워크 오류로 가정하고 로그인으로 이동
        router.replace('/login');
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [router]);

  // 로딩/리다이렉트 중에는 렌더하지 않음(레이아웃 시프트 방지)
  if (!ready) return null;
  if (!allowed) return null;

  return <>{children}</>;
}
