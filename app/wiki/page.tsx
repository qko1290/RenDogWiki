'use client';

import dynamic from 'next/dynamic';
import '@wiki/css/wiki.css';

const WikiPageInner = dynamic(() => import('@/components/wiki/WikiPageInner'), {
  ssr: false,
});

export default function WikiPage() {
  // ✅ 초기 진입에서는 user를 굳이 먼저 가져오지 않음
  // 권한이 필요한 액션이 실제로 발생할 때만 서버 검증
  return <WikiPageInner user={null} />;
}