// =============================================
// File: app/wiki/write/page.tsx
// =============================================
/**
 * 위키 문서 작성/수정 페이지
 * - path, title 기준 문서 생성/수정 모드 구분
 * - 문서 데이터 로드 후 SlateEditor에 전달
 * - /wiki/write?path=카테고리경로&title=문서제목 형식으로 진입
 */

'use client';

import { Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import SlateEditor from '@/components/editor/SlateEditor';
import '../css/write.css';
import type { Descendant } from 'slate';

// 빈 문서 기본값
const EMPTY_INITIAL_VALUE: Descendant[] = [
  { type: 'paragraph', children: [{ text: '' }] },
];

// 문서 데이터 타입 정의
type DocType = {
  title: string;
  path: string;
  icon: string;
  tags: string[];
  content: Descendant[];
};

// 메인 로직
function WritePageInner() {
  const searchParams = useSearchParams();
  const path = searchParams.get('path');     // 카테고리 경로
  const title = searchParams.get('title');   // 문서 제목

  const [doc, setDoc] = useState<DocType | null>(null); // 현재 문서 상태
  const [loading, setLoading] = useState(true);         // 로딩 상태

  useEffect(() => {
    // path 없으면 잘못된 진입
    if (!path) {
      setLoading(false);
      return;
    }

    // 1. 수정 모드: title 있으면 해당 문서 불러옴
    // 2. 작성 모드: title 없으면 새 문서 상태로 진입
    if (title) {
      fetch(`/api/documents?path=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}`)
        .then(async (res) => {
          if (res.status === 204) {
            // 204 No Content: 문서 없음
            return {
              title: title,
              path: path,
              icon: '',
              tags: [],
              content: EMPTY_INITIAL_VALUE,
            };
          } else if (res.ok) {
            // 기존 문서 데이터 반환
            return res.json();
          } else {
            throw new Error('문서 불러오기 실패');
          }
        })
        .then((data) => setDoc(data))
        .catch((err) => {
          console.error('문서 로딩 실패:', err);
          alert('문서를 불러올 수 없습니다.');
        })
        .finally(() => setLoading(false));
    } else {
      // 새 문서(제목 없음)
      setDoc({
        title: '',      // 빈 제목
        path: path,
        icon: '',
        tags: [],
        content: EMPTY_INITIAL_VALUE,
      });
      setLoading(false);
    }
  }, [path, title]);

  // 렌더링 분기 (로딩, 잘못된 진입, 에디터)
  if (loading) return <div>불러오는 중...</div>;
  if (!path) return <div>잘못된 접근입니다.</div>;

  return (
    <div className="max-w-[90%] mx-auto py-10">
      <SlateEditor initialDoc={doc} />
    </div>
  );
}

// Suspense로 감싸서 클라이언트 환경 SSR 대응
export default function WritePage() {
  return (
    <Suspense>
      <WritePageInner />
    </Suspense>
  );
}
