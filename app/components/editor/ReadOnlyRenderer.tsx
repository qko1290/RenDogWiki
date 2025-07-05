// =============================================
// File: app/components/editor/ReadOnlyRenderer.tsx
// =============================================
/**
 * 문서 읽기 전용(뷰어) 렌더러
 * - 위키/문서 뷰에서 슬레이트 JSON을 불러와 마크/스타일까지 그대로 출력
 * - 아이콘 클릭/수정/드롭다운 등 편집 관련 기능은 모두 비활성화(readOnly)
 */

'use client';

import { Descendant } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { useMemo } from 'react';
import { createEditor } from 'slate';

import Element from './Element'; // 커스텀 블록 렌더
import Leaf from './Leaf';       // 인라인 스타일 렌더

// 읽기 전용 렌더러 컴포넌트
export default function ReadOnlyRenderer({ value }: { value: Descendant[] }) {
  const editor = useMemo(() => withReact(createEditor()), []);

  // 렌더링
  // - onChange 무시, onIconClick 등 모두 빈 함수로 전달(편집 불가)
  return (
    <Slate editor={editor} value={value} onChange={() => {}}>
      <Editable
        readOnly
        renderElement={(props) => (
          <Element {...props} editor={editor} onIconClick={() => {}} />
        )}
        renderLeaf={(props) => <Leaf {...props} />}
        style={{ padding: '16px' }}
      />
    </Slate>
  );
}
