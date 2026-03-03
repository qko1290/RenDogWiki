// =============================================
// File: app/wiki/page.tsx
// =============================================
import '@wiki/css/wiki.css';
import { cookies, headers } from 'next/headers';
import WikiPageClient from './WikiPageClient';

async function fetchMe() {
  try {
    // 서버 컴포넌트에서 내부 API 호출 시 쿠키 전달 필요
    const h = headers();
    const cookie = cookies().toString();

    const base =
      h.get('x-forwarded-proto') && h.get('host')
        ? `${h.get('x-forwarded-proto')}://${h.get('host')}`
        : `http://localhost:3000`;

    const res = await fetch(`${base}/api/auth/me`, {
      headers: {
        cookie,
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

export default async function WikiPage() {
  const user = await fetchMe();
  return <WikiPageClient user={user} />;
}