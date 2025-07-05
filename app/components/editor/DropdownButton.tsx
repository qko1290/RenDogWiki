// =============================================
// File: app/components/editor/DropdownButton.tsx
// =============================================
/**
 * 에디터 툴바 드롭다운(글자색/폰트/배경 등) 버튼 컴포넌트
 * - label(이름)로 스타일 종류 매칭, 선택 시 해당 마크 스타일 바로 적용
 * - 여러 드롭다운 중 열림/닫힘, 포커스/selection 복원, 옵션 선택 콜백 등 지원
 */

'use client';

import React from 'react';
import { useSlate, ReactEditor } from 'slate-react';
import { Editor, Range, Transforms } from 'slate';

// Props 타입 선언
type DropdownButtonProps = {
  label: string;                             // 드롭다운 버튼 텍스트
  items: string[];                           // 옵션 리스트(색상/크기 등)
  onSelect?: (value: string) => void;        // 옵션 선택시 콜백
  selectionRef: React.MutableRefObject<Range | null>; // 드롭다운을 여는 시점의 selection 저장용 ref
  dropdownId: string;                        // 드롭다운 고유 식별자
  openDropdown: string | null;               // 현재 열려있는 드롭다운 id
  setOpenDropdown: (id: string | null) => void; // 드롭다운 열림/닫힘 컨트롤
};

// 메인 컴포넌트
const DropdownButton = ({
  label, items, onSelect, selectionRef,
  dropdownId, openDropdown, setOpenDropdown
}: DropdownButtonProps) => {
  const editor = useSlate();
  const isOpen = openDropdown === dropdownId;

  // label -> Slate 마크 타입 매핑
  const getMarkType = (label: string): string | null => {
    if (label === '색상') return 'color';
    if (label === '폰트') return 'fontSize';
    if (label === '배경색') return 'backgroundColor';
    return null;
  };

  /**
   * [옵션 선택시]
   * - 해당 스타일 마크(editor에 바로 적용)
   * - selectionRef로 selection 복원 + 포커스
   * - 선택 후 드롭다운 닫기
   */
  const handleSelect = (item: string) => {
    const markType = getMarkType(label);
    if (markType) {
      // selection 복원 + 스타일 적용: 타이밍 분리 위해 setTimeout
      setTimeout(() => {
        if (selectionRef.current) Transforms.select(editor, selectionRef.current);
        ReactEditor.focus(editor);
        Editor.addMark(editor, markType, item);
      }, 0);
    }
    if (onSelect) onSelect(item);
    setOpenDropdown(null); // 항상 닫기
  };

  // 렌더링: 버튼+드롭다운 리스트
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

// 인라인 스타일(CSS 모듈 대체 예정)
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
