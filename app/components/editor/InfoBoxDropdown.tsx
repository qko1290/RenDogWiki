// File: app/components/editor/InfoBoxDropdown.tsx

/**
 * 에디터에서서 InfoBox(정보/주의/경고 박스) 삽입 드롭다운
 * - 툴바에서 사용, 클릭 시 드롭다운에서 박스 유형 선택
 * - 선택 즉시 info/warning/danger 박스 블록 삽입
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
  selectionRef: React.RefObject<Range | null>;
  dropdownId: string;
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
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

  // 박스 유형 선택시 커서 복원/포커스 후 박스 삽입
  const handleSelect = (boxType: InfoBoxType) => {
    if (selectionRef.current) {
      Transforms.select(editor, selectionRef.current);
      ReactEditor.focus(editor);
    }
    insertInfoBox(editor, 'info-box', boxType);
    setOpenDropdown(null); // 무조건 닫기
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          setOpenDropdown(isOpen ? null : dropdownId);
        }}
        style={buttonStyle}
      >
        📦 박스 삽입 ▾
      </button>

      {isOpen && (
        <ul style={dropdownStyle}>
          <li style={liStyle} onMouseDown={() => handleSelect('info')}>ℹ️ 정보</li>
          <li style={liStyle} onMouseDown={() => handleSelect('warning')}>⚠️ 주의</li>
          <li style={liStyle} onMouseDown={() => handleSelect('danger')}>🚫 경고</li>
        </ul>
      )}
    </div>
  );
};

export default InfoBoxDropdown;

// 드롭다운/리스트/버튼 인라인 스타일
// 이후 CSS로 대체할 예정이에요
const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  margin: 0,
  padding: '4px 0',
  background: 'white',
  border: '1px solid #ccc',
  borderRadius: '4px',
  listStyle: 'none',
  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  zIndex: 100,
};

const liStyle: React.CSSProperties = {
  padding: '6px 12px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontSize: '14px',
  userSelect: 'none',
};

const buttonStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  background: '#f9f9f9',
  cursor: 'pointer',
  marginRight: '8px',
  fontSize: '14px',
};
