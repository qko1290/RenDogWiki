// =============================================
// File: app/wiki/page.tsx
// =============================================
/**
 * 위키 메인 페이지(문서 트리/본문 뷰)
 * - 인증 정보(user) 조회ㅉㅉㅉ
 * - WikiPageInner(클라이언트 컴포넌트) 동적 import
 * - @wiki/css/wiki.css 글로벌 스타일 적용
 */

import { getAuthUser } from './lib/auth';    // 인증 유저 정보 가져오기 util
import dynamic from 'next/dynamic';          // 클라이언트 컴포넌트 동적 import용
import '@wiki/css/wiki.css';                 // 글로벌 위키 스타일

// WikiPageInner를 동적으로 클라이언트에서만 렌더
const WikiPageInner = dynamic(() => import('@/components/WikiPageInner'), { ssr: false });

// 위키 메인 엔트리(서버 컴포넌트)
export default async function WikiPage() {
  // getAuthUser: 서버 컴포넌트에서 실행 (쿠키 기반 인증 유저 반환)
  const user = await getAuthUser();
  // WikiPageInner: 클라이언트 렌더
  return <WikiPageInner user={user} />;
}
