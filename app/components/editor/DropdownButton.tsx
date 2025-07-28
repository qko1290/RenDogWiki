// =============================================
// File: app/components/editor/DropdownButton.tsx
// =============================================
/**
 * 에디터 툴바의 드롭다운(글자색/폰트/배경 등) 버튼 컴포넌트
 * - label(버튼 표시명)과 items(옵션 리스트) 전달
 * - 드롭다운이 열릴 때 selectionRef로 현재 selection 저장
 * - 옵션 클릭 시 해당 마크(editor 스타일) 바로 적용
 * - 열림/닫힘 상태, 드롭다운 간 컨트롤 지원
 */

'use client';

import React from 'react';
import { useSlate, ReactEditor } from 'slate-react';
import { Editor, Range, Transforms } from 'slate';

// 드롭다운 버튼 props 타입 정의
type DropdownButtonProps = {
  label: React.ReactNode;                             // 드롭다운 버튼 텍스트(ReactNode)
  items: string[];                                    // 옵션 리스트(색상, 크기, 배경 등)
  onSelect?: (value: string) => void;                 // 옵션 선택시 콜백
  selectionRef: React.MutableRefObject<Range | null>; // 드롭다운 열 때의 selection 저장 ref
  dropdownId: string;                                 // 드롭다운 식별자(마크 타입)
  openDropdown: string | null;                        // 현재 열려있는 드롭다운 id
  setOpenDropdown: (id: string | null) => void;       // 드롭다운 열림/닫힘 제어
};

const DropdownButton = ({
  label, items, onSelect, selectionRef,
  dropdownId, openDropdown, setOpenDropdown
}: DropdownButtonProps) => {
  const editor = useSlate();
  const isOpen = openDropdown === dropdownId;

  /**
   * [옵션 클릭 시 동작]
   * - selectionRef를 사용해 드롭다운 열렸던 위치로 커서 복원
   * - 해당 마크(editor 스타일) 적용
   * - 드롭다운 닫음
   */
  const handleSelect = (item: string) => {
    // markType은 dropdownId를 그대로 사용 (color, fontSize, backgroundColor 등)
    const markType = dropdownId;
    setTimeout(() => {
      if (selectionRef.current) Transforms.select(editor, selectionRef.current);
      ReactEditor.focus(editor);
      Editor.addMark(editor, markType, item);
    }, 0);

    if (onSelect) onSelect(item);
    setOpenDropdown(null);
  };

  // 렌더링: 버튼 + 드롭다운 메뉴
  return (
    <div className="editor-dropdown">
      <button
        onMouseDown={e => {
          e.preventDefault();
          selectionRef.current = editor.selection;
          setOpenDropdown(isOpen ? null : dropdownId);
        }}
        className="editor-toolbar-btn"
      >
        {label}
      </button>

      {isOpen && (
        <ul className="editor-dropdown-menu">
          {items.map((item, idx) => (
            <li key={idx} onMouseDown={() => handleSelect(item)}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DropdownButton;
