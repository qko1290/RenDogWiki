// C:\next\rdwiki\app\wiki\write\layout.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Role = 'guest' | 'writer' | 'admin';

export default function WriteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        const role = (data?.user?.role ?? data?.role ?? 'guest') as Role;
        const ok = role === 'writer' || role === 'admin';
        if (!alive) return;
        setAllowed(ok);
        setReady(true);
        if (!ok) router.replace('/wiki'); // 작성/수정 권한 차단
      } catch {
        if (!alive) return;
        setAllowed(false);
        setReady(true);
        router.replace('/login');
      }
    })();
    return () => { alive = false; };
  }, [router]);

  if (!ready) return null;
  if (!allowed) return null;
  return <>{children}</>;
}
