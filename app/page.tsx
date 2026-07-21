// =============================================
// File: app/page.tsx
// (전체 코드)
// - Home 서버 데이터 조회
// - 최근 업데이트 문서를 HomePage에 전달
// =============================================

import HomePage from '@/components/home/HomePage';
import { getRecentHomeDocuments } from '@/components/home/homeData';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const recentDocuments =
    await getRecentHomeDocuments(4);

  return (
    <HomePage recentDocuments={recentDocuments} />
  );
}