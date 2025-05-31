// File: app/components/editor/ReadOnlyRenderer.tsx

/**
 * Slate. 기반 문서 읽기 전용 렌더러
 * - 위키/문서 뷰에서 슬레이트 JSON을 불러와서 스타일/마크 효과까지 모두 반영해 출력
 * - 에디터의 커스텀 Element/Leaf를 그대로 활용
 * - 아이콘 클릭, onChange 등 편집 관련 기능은 모두 비활성화
 */

'use client';

import { Descendant } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { useMemo } from 'react';
import { createEditor } from 'slate';

import Element from './Element';
import Leaf from './Leaf';

// 읽기 전용 렌더러 컴포넌트
export default function ReadOnlyRenderer({ value }: { value: Descendant[] }) {
  // editor 인스턴스
  const editor = useMemo(() => withReact(createEditor()), []);

  return (
    <Slate editor={editor} value={value} onChange={() => {}}>
      <Editable
        readOnly
        renderElement={(props) => <Element {...props} editor={editor} onIconClick={() => {}} />}
        renderLeaf={(props) => <Leaf {...props} />}
        style={{ padding: '16px' }}
      />
    </Slate>
  );
}
