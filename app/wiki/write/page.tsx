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

type DocType = {
  title: string;
  path: string;
  icon: string;
  tags: string[];
  content: Descendant[];
};

function WritePageInner() {
  const searchParams = useSearchParams();
  const path = searchParams.get('path');
  const title = searchParams.get('title'); // title 없으면 '작성 모드', 있으면 '수정 모드'

  const [doc, setDoc] = useState<DocType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // path 없으면 접근 불가
    if (!path) {
      setLoading(false);
      return;
    }

    // title이 있으면 해당 path+title 문서 조회 (수정 모드)
    // title 없으면 새 문서 (작성 모드)
    if (title) {
      fetch(`/api/documents?path=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}`)
        .then(async (res) => {
          if (res.status === 204) {
            // 문서 없음 = 새 문서로 진입 (이 경우 거의 없음)
            return {
              title: title,
              path: path,
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
    } else {
      // title 없으면 무조건 새 문서
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

  if (loading) return <div>불러오는 중...</div>;
  if (!path) return <div>잘못된 접근입니다.</div>;

  return (
    <div className="max-w-[90%] mx-auto py-10">
      <SlateEditor initialDoc={doc} />
    </div>
  );
}

export default function WritePage() {
  return (
    <Suspense>
      <WritePageInner />
    </Suspense>
  );
}
