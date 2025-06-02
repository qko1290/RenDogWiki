// File: app/wiki/write/page.tsx

/**
 * 위키 문서 작성/수정 페이지
 * - SlateEditor에 initialDoc 전달
 */

'use client';

import { Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import SlateEditor from '@/components/editor/SlateEditor';
import '../css/write.css';
import type { Descendant } from 'slate';

const EMPTY_INITIAL_VALUE: Descendant[] = [
  { type: 'paragraph', children: [{ text: '' }] },
];

// 타입 정의
type DocType = {
  title: string;
  path: string;
  icon: string;
  tags: string[];
  content: Descendant[];
};

// 내부 함수 컴포넌트
function WritePageInner() {
  const searchParams = useSearchParams();
  const path = searchParams.get('path');

  const [doc, setDoc] = useState<DocType | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 문서 fetch & 초기값 로딩
  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    fetch(`/api/documents?path=${encodeURIComponent(path)}`)
      .then(async (res) => {
        if (res.status === 204) {
          // 새 문서 초기값
          return {
            path,
            icon: '',
            tags: [],
            content: EMPTY_INITIAL_VALUE,
          };
        } else if (res.ok) {
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
  }, [path]);

  // 렌더링
  if (loading) return <div>불러오는 중...</div>;
  if (!path) return <div>잘못된 접근입니다.</div>;

  return (
    <div className="max-w-[90%] mx-auto py-10">
      <SlateEditor initialDoc={doc} />
    </div>
  );
}

// 최상위에서 Suspense로 감싸기
export default function WritePage() {
  return (
    <Suspense>
      <WritePageInner />
    </Suspense>
  );
}
