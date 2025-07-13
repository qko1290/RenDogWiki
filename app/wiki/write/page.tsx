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
import type { Descendant } from 'slate';
import WikiHeader from "@/components/common/Header";

// 빈 문서 기본값
const EMPTY_INITIAL_VALUE: Descendant[] = [
  { type: 'paragraph', children: [{ text: '' }] },
];

// 문서 데이터 타입 정의
type DocType = {
  id?: number;
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
  const title = searchParams.get('title'); 
  const idStr = searchParams.get('id');
  const id = idStr ? Number(idStr) : undefined;
  const main = searchParams.get('main') === '1';

  const [doc, setDoc] = useState<DocType | null>(null); // 현재 문서 상태
  const [loading, setLoading] = useState(true);         // 로딩 상태

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }

    // === [1] path와 title이 모두 있을 때만 "수정 모드" ===
    if (path && title && id) {
      fetch(`/api/documents?path=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}`)
        .then(res => {
          if (res.status === 204) return null;
          return res.json();
        })
        .then(data => {
          console.log('[2] API로부터 받은 data:', data, '현재 id:', id);
          if (data) {
            setDoc({
              id: data.id ?? id, // ← **항상 id를 세팅! (data.id 없으면 쿼리 id)**
              title: data.title ?? title,
              path: data.path ?? path,
              icon: data.icon ?? '',
              tags: Array.isArray(data.tags) ? data.tags : [],
              content:
                Array.isArray(data.content) && data.content.length > 0
                  ? data.content
                  : EMPTY_INITIAL_VALUE,
            });
          } else {
            // 찾는 문서 없음(새 문서로 진입)
            setDoc({
              id, // 쿼리스트링에서 받은 id 사용
              title: title,
              path: path,
              icon: '',
              tags: [],
              content: EMPTY_INITIAL_VALUE,
            });
          }
          setLoading(false);
        });
      return;
    }

    // === [2] title 없이 진입(대표문서 or 새문서) ===
    setDoc({
      id,
      title: '',
      path: path,
      icon: '',
      tags: [],
      content: EMPTY_INITIAL_VALUE,
    });
    setLoading(false);
  }, [path, title, id]);

  // 렌더링 분기 (로딩, 잘못된 진입, 에디터)
  if (loading) return <div>불러오는 중...</div>;
  if (!path) return <div>잘못된 접근입니다.</div>;

  return (
    <div className="max-w-[95%] mx-auto py-10">
      <SlateEditor initialDoc={doc} isMain={main} />
    </div>
  );
}

// Suspense로 감싸서 클라이언트 환경 SSR 대응
export default function WritePage() {
  return (
    <Suspense>
      <WikiHeader user={null} />
      <WritePageInner />
    </Suspense>
  );
}
