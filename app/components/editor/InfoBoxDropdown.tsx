// =============================================
// File: app/components/editor/InfoBoxDropdown.tsx
// =============================================
/**
 * 에디터 InfoBox(정보/주의/경고 박스) 삽입 드롭다운 컴포넌트
 * - 툴바에서 사용, 버튼 클릭 시 드롭다운 열기
 * - 정보/주의/경고(박스 유형) 선택 즉시 해당 info-box 블록 삽입
 * - selectionRef로 커서 위치 복원, 드롭다운 열림/닫힘 제어 등 지원
 */

'use client';

import React from 'react';
import { useSlate } from 'slate-react';
import { Editor, Range, Transforms } from 'slate';
import type { InfoBoxType } from '@/types/slate';
import insertInfoBox from './helpers/insertInfoBox';
import { ReactEditor } from 'slate-react';

// Props 타입 선언
type InfoBoxDropdownProps = {
  selectionRef: React.RefObject<Range | null>;   // 커서 복원용 ref
  dropdownId: string;                            // 드롭다운 고유 id
  openDropdown: string | null;                   // 현재 열려있는 드롭다운 id
  setOpenDropdown: (id: string | null) => void;  // 드롭다운 열림/닫힘 setter
};

// 메인 컴포넌트
const InfoBoxDropdown = ({
  selectionRef,
  dropdownId,
  openDropdown,
  setOpenDropdown,
}: InfoBoxDropdownProps) => {
  const editor = useSlate();
  const isOpen = openDropdown === dropdownId;

  /**
   * [박스 유형 선택시]
   * - selectionRef(커서) 복원, 에디터 포커스
   * - 해당 타입의 info-box 블록 삽입
   * - 드롭다운 닫기
   */
  const handleSelect = (boxType: InfoBoxType) => {
    if (selectionRef.current) {
      Transforms.select(editor, selectionRef.current);
      ReactEditor.focus(editor);
    }
    insertInfoBox(editor, 'info-box', boxType);
    setOpenDropdown(null); // 항상 닫기
  };

  // 렌더링
  return (
    <div className="editor-dropdown">
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          setOpenDropdown(isOpen ? null : dropdownId);
        }}
        className="editor-toolbar-btn"
      >
        📦
      </button>

      {isOpen && (
        <ul className="editor-dropdown-menu">
          <li onMouseDown={() => handleSelect('info')}>ℹ️ 정보</li>
          <li onMouseDown={() => handleSelect('warning')}>⚠️ 주의</li>
          <li onMouseDown={() => handleSelect('danger')}>🚫 경고</li>
        </ul>
      )}
    </div>
  );
};

export default InfoBoxDropdown;