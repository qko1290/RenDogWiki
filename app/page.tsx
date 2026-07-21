// =============================================
// File: app/page.tsx
// 전체 교체용 코드
// - Home 서버 데이터 병렬 조회
// - 최근 업데이트 문서 전달
// - 대표 카테고리 실제 링크 전달
// - 인기 문서는 클라이언트에서 별도 API로 조회
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
    getRecentHomeDocuments(5),
    getHomeCategoryLinks(),
  ]);

  return (
    <HomePage
      recentDocuments={recentDocuments}
      categoryLinks={categoryLinks}
    />
  );
}
