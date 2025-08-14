// =============================================
// File: app/components/editor/ReadOnlyRenderer.tsx
// =============================================
/**
 * 읽기 전용 Slate 문서 뷰어
 * - 슬레이트 JSON(Descendant[])을 readOnly로 그대로 출력
 * - 편집 기능 완전 비활성화(키 입력/변경 무시)
 * - 편집 모드에서 쓰는 Element/Leaf 렌더러 재사용
 * - Element가 요구하는 priceTableEdit 관련 prop은 안전한 no-op으로 전달
 */

'use client';

import React, { useMemo, type Dispatch, type SetStateAction } from 'react';
import { createEditor, type Descendant, type Path } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';

import Element from './Element'; // 커스텀 블록 요소 렌더
import Leaf from './Leaf';       // 인라인 스타일(leaf) 렌더

// Element.tsx 내부의 PriceTableEditState와 구조를 맞춘 로컬 타입(해당 타입이 export 되지 않음)
type PriceTableEditLike = {
  blockPath: Path | null;
  idx: number | null;
  item: any | null;
};

export default function ReadOnlyRenderer({ value }: { value: Descendant[] }) {
  // 읽기 전용 에디터 인스턴스
  const editor = useMemo(() => withReact(createEditor()), []);

  // 읽기 전용에서 사용할 고정 상태/함수(no-op)
  const readOnlyPriceTableEdit = useMemo<PriceTableEditLike>(
    () => ({ blockPath: null, idx: null, item: null }),
    []
  );
  const noopSetPriceTableEdit = useMemo<
    Dispatch<SetStateAction<PriceTableEditLike>>
  >(() => () => {}, []);

  return (
    <Slate editor={editor} value={value} onChange={() => { /* readOnly: 변경 무시 */ }}>
      <Editable
        readOnly
        renderElement={(props) => (
          <Element
            {...props}
            editor={editor}
            onIconClick={() => { /* readOnly: 무시 */ }}
            priceTableEdit={readOnlyPriceTableEdit}
            setPriceTableEdit={noopSetPriceTableEdit}
          />
        )}
        renderLeaf={(props) => <Leaf {...props} />}
        style={{ padding: '16px' }}
      />
    </Slate>
  );
}
