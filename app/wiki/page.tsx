// File: app/wiki/page.tsx

import { getAuthUser } from './lib/auth';
import dynamic from 'next/dynamic';
import '@wiki/css/wiki.css';

const WikiPageInner = dynamic(() => import('@/components/WikiPageInner'), { ssr: false });

export default async function WikiPage() {
  const user = await getAuthUser(); // 서버 컴포넌트에서 안전하게 실행
  return <WikiPageInner user={user} />;
}