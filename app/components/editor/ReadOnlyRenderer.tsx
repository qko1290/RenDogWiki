// =============================================
// File: app/components/editor/ReadOnlyRenderer.tsx
// =============================================
/**
 * 읽기 전용 Slate 문서 뷰어
 * - 슬레이트 JSON 문서 데이터를 readOnly로 그대로 출력
 * - 마크업/블록/스타일 유지, 편집 기능 완전 비활성화
 * - 인라인/블록 렌더러는 편집 모드와 동일하게 재사용
 */

'use client';

import { Descendant, Path } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { SetStateAction, useMemo } from 'react';
import { createEditor } from 'slate';

import Element from './Element'; // 커스텀 블록 요소 렌더
import Leaf from './Leaf';       // 인라인 스타일(leaf) 렌더

/**
 * @param value Slate Descendant[] 문서 데이터(JSON)
 * @returns readOnly로 렌더링되는 Slate 문서(편집 불가)
 */
export default function ReadOnlyRenderer({ value }: { value: Descendant[] }) {
  // 슬레이트 에디터 인스턴스 (readOnly라 메모리 관리만)
  const editor = useMemo(() => withReact(createEditor()), []);

  return (
    <Slate
      editor={editor}
      value={value}
      onChange={() => {}} // 읽기 전용: 변경 무시
    >
      <Editable
        readOnly // 모든 입력/편집 비활성화
        renderElement={props =>
          <Element
          priceTableEdit={{
            blockPath: null,
            idx: null,
            item: undefined
          }} setPriceTableEdit={function (value: SetStateAction<{ blockPath: Path | null; idx: number | null; item: any | null; }>): void {
            throw new Error('Function not implemented.');
          } } {...props}
          editor={editor}
          onIconClick={() => { } } // heading 등 아이콘 클릭도 무효
          />
        }
        renderLeaf={props => <Leaf {...props} />}
        style={{ padding: '16px' }} // 기본 padding만 적용
      />
    </Slate>
  );
}
