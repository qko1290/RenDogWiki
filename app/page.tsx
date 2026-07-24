// =============================================
// File: app/wiki/page.tsx
// 전체 코드
//
// - 위키 공통 구조 CSS를 먼저 로드
// - 문서 화면 디자인 CSS를 그 다음에 로드
// - 클라이언트 컴포넌트가 뜨기 전에 활성 색상이 확정되어
//   보라색 선이 잠깐 보이는 현상을 방지
// =============================================

'use client';

import dynamic from 'next/dynamic';

import '@wiki/css/wiki.css';

const WikiPageInner = dynamic(
  () =>
    import(
      '@/components/wiki/WikiPageInner'
    ),
  {
    ssr: false,
  },
);

export default function WikiPage() {
  return (
    <div className="wiki-app wiki-shell-page">
      <WikiPageInner user={null} />
    </div>
  );
}
