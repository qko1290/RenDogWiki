// =============================================
// File: app/page.tsx
// 전체 교체용 코드
// - Home 서버 데이터 병렬 조회
// - 최근 업데이트 문서 전달
// - 대표 카테고리 실제 링크 전달
// - 최근 7일 인기 문서 전달
// =============================================

import HomePage from '@/components/home/HomePage';
import {
  getHomeCategoryLinks,
  getPopularHomeDocuments,
  getRecentHomeDocuments,
} from '@/components/home/homeData';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [
    recentDocuments,
    popularDocuments,
    categoryLinks,
  ] = await Promise.all([
    getRecentHomeDocuments(4),
    getPopularHomeDocuments(5),
    getHomeCategoryLinks(),
  ]);

  return (
    <HomePage
      recentDocuments={recentDocuments}
      popularDocuments={popularDocuments}
      categoryLinks={categoryLinks}
    />
  );
}
