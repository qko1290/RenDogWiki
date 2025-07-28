// =============================================
// File: app/components/editor/InfoBoxDropdown.tsx
// =============================================

/**
 * InfoBox(정보/주의/경고) 삽입용 드롭다운 버튼 컴포넌트
 * - 툴바에서 사용, 버튼 클릭시 드롭다운 표시 및 선택 지원
 * - selectionRef로 커서 위치 복원, 드롭다운 열림/닫힘 상태 제어
 */

'use client';

import React from 'react';
import { useSlate } from 'slate-react';
import { Editor, Range, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import insertInfoBox from './helpers/insertInfoBox';
import type { InfoBoxType } from '@/types/slate';

type InfoBoxDropdownProps = {
  selectionRef: React.RefObject<Range | null>;
  dropdownId: string;
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
};

const InfoBoxDropdown = ({
  selectionRef,
  dropdownId,
  openDropdown,
  setOpenDropdown,
}: InfoBoxDropdownProps) => {
  const editor = useSlate();
  const isOpen = openDropdown === dropdownId;

  // InfoBox 타입 선택시: selection 복원, info-box 삽입, 드롭다운 닫기
  const handleSelect = (boxType: InfoBoxType) => {
    if (selectionRef.current) {
      Transforms.select(editor, selectionRef.current);
      ReactEditor.focus(editor);
    }
    insertInfoBox(editor, 'info-box', boxType);
    setOpenDropdown(null);
  };

  return (
    <div className="editor-dropdown">
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          setOpenDropdown(isOpen ? null : dropdownId);
        }}
        className="editor-toolbar-btn"
        aria-label="InfoBox 삽입"
      >
        📦
      </button>
      {isOpen && (
        <ul className="editor-dropdown-menu">
          <li onMouseDown={() => handleSelect('info')}>정보</li>
          <li onMouseDown={() => handleSelect('warning')}>주의</li>
          <li onMouseDown={() => handleSelect('danger')}>경고</li>
        </ul>
      )}
    </div>
  );
};

export default InfoBoxDropdown;
