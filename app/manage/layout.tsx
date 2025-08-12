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
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        const role = (data?.user?.role ?? 'guest') as Role;
        const ok = role === 'writer' || role === 'admin';
        if (!alive) return;
        setAllowed(ok);
        setReady(true);
        if (!ok) router.replace('/wiki'); // 권한 없으면 밀어냄
      } catch {
        if (!alive) return;
        setAllowed(false);
        setReady(true);
        router.replace('/login'); // 비로그인으로 가정
      }
    })();
    return () => { alive = false; };
  }, [router]);

  if (!ready) return null;   // 로딩 중엔 아무것도 안 그림(컨텐츠 깜빡임 방지)
  if (!allowed) return null; // 리다이렉트 중
  return <>{children}</>;
}
