// =============================================
// File: app/wiki/page.tsx
// (전체 코드)
// - 위키 메인 엔트리
// - 초기 진입에서는 auth/me를 치지 않음
// - 실제 현재 레포 경로 기준으로 WikiPageInner 렌더
// =============================================
'use client';

import dynamic from 'next/dynamic';
import '@wiki/css/wiki.css';

const WikiPageInner = dynamic(() => import('@/components/wiki/WikiPageInner'), {
  ssr: false,
});

export default function WikiPage() {
  return (
    <div className="wiki-app">
      <WikiPageInner user={null} />
    </div>
  );
}