// =============================================
// File: app/page.tsx
// 전체 교체용 코드
// - 최근 업데이트 문서 조회
// - Home 대표 카테고리 링크 조회
// =============================================

import HomePage from '@/components/home/HomePage';
import {
  getHomeCategoryLinks,
  getRecentHomeDocuments,
} from '@/components/home/homeData';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [
    recentDocuments,
    categoryLinks,
  ] = await Promise.all([
    getRecentHomeDocuments(4),
    getHomeCategoryLinks(),
  ]);

  return (
    <HomePage
      recentDocuments={recentDocuments}
      categoryLinks={categoryLinks}
    />
  );
}