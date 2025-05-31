// File: app/components/editor/DropdownButton.tsx

/**
 * 에디터 툴바 드롭다운(글자색/폰트/배경 등) 버튼 컴포넌트
 * - label에 따라 스타일 종류 매칭, 선택 시 해당 스타일 바로 적용
 */

'use client';

import React, { useState } from 'react';
import { useSlate, ReactEditor } from 'slate-react';
import { Editor, Range, Transforms } from 'slate';

// 타입 선언
type DropdownButtonProps = {
  label: string;                             // 드롭다운 버튼 이름
  items: string[];                           // 옵션 리스트
  onSelect?: (value: string) => void;        // 선택시 콜백
  selectionRef: React.MutableRefObject<Range | null>; // 드롭다운 적용용 selection 저장 ref
  dropdownId: string;                        // 드롭다운 고유 id
  openDropdown: string | null;               // 현재 열려있는 드롭다운 id
  setOpenDropdown: (id: string | null) => void; // 드롭다운 열림/닫힘
};

// 메인 컴포넌트
const DropdownButton = ({
  label, items, onSelect, selectionRef,
  dropdownId, openDropdown, setOpenDropdown
}: DropdownButtonProps) => {
  const editor = useSlate();
  const isOpen = openDropdown === dropdownId;

  // label로 마크 타입 변환
  const getMarkType = (label: string): string | null => {
    if (label === '색상') return 'color';
    if (label === '폰트') return 'fontSize';
    if (label === '배경색') return 'backgroundColor';
    return null;
  };

  // 옵션 선택시 스타일 마크 적용+포커스/selection 복원
  const handleSelect = (item: string) => {
    const markType = getMarkType(label);
    if (markType) {
      setTimeout(() => {
        if (selectionRef.current) Transforms.select(editor, selectionRef.current);
        ReactEditor.focus(editor);
        Editor.addMark(editor, markType, item);
      }, 0);
    }
    if (onSelect) onSelect(item);
    setOpenDropdown(null); // 선택 후 무조건 닫기
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          selectionRef.current = editor.selection;
          setOpenDropdown(isOpen ? null : dropdownId);
        }}
        style={buttonStyle}
      >
        {label} ▾
      </button>

      {isOpen && (
        <ul style={dropdownStyle}>
          {items.map((item, idx) => (
            <li key={idx} style={liStyle} onMouseDown={() => handleSelect(item)}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DropdownButton;

// 인라인 스타일
// 나중에 CSS로 교체할 예정이에요
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
