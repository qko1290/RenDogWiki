// =============================================
// File: app/components/editor/DropdownButton.tsx
// =============================================
/**
 * 에디터 툴바 드롭다운 버튼
 * - label(표시명) + items(옵션 문자열 배열) 렌더링
 * - 드롭다운이 열릴 때 selectionRef에 현재 selection 저장
 * - 항목 클릭(또는 Enter/Space) 시 selectionRef로 커서 복원 → 포커스 → 해당 마크 적용
 * - 열림/닫힘은 부모의 openDropdown 상태로 제어(동일 툴바 내 상호 배타 열림)
 */

'use client';

import React, { useCallback } from 'react';
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
   * [옵션 선택 처리]
   * - 이벤트 흐름상 드롭다운 DOM 업데이트 전 selection 복원이 필요하므로
   *   다음 tick에서: selection 복원 → 포커스 → 마크 적용 순으로 실행
   * - markType은 dropdownId를 그대로 사용(color, fontSize, backgroundColor 등)
   */
  const handleSelect = useCallback((item: string) => {
    const markType = dropdownId;

    setTimeout(() => {
      if (selectionRef.current) {
        Transforms.select(editor, selectionRef.current);
      }
      ReactEditor.focus(editor);
      Editor.addMark(editor, markType, item);
    }, 0);

    onSelect?.(item);
    setOpenDropdown(null);
  }, [dropdownId, editor, onSelect, selectionRef, setOpenDropdown]);

  /** 키보드 접근성: Enter/Space로 선택 */
  const onItemKeyDown: React.KeyboardEventHandler<HTMLLIElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const value = (e.currentTarget.getAttribute('data-value') ?? '') as string;
      handleSelect(value);
    }
  };

  /** 드롭다운 전체에서 Escape로 닫기 */
  const onMenuKeyDown: React.KeyboardEventHandler<HTMLUListElement> = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpenDropdown(null);
      // 닫힌 뒤 원래 에디터로 포커스 복구
      setTimeout(() => ReactEditor.focus(editor), 0);
    }
  };

  // 렌더링: 버튼 + 드롭다운 메뉴
  return (
    <div className="editor-dropdown">
      <button
        type="button" // 폼 내에서 암묵적 submit 방지
        onMouseDown={e => {
          e.preventDefault(); // 버튼 포커스/블러로 selection 유실 방지
          selectionRef.current = editor.selection ?? null;
          setOpenDropdown(isOpen ? null : dropdownId);
        }}
        className="editor-toolbar-btn"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${dropdownId}-menu` : undefined}
      >
        {label}
      </button>

      {isOpen && items.length > 0 && (
        <ul
          id={`${dropdownId}-menu`}
          className="editor-dropdown-menu"
          role="menu"
          aria-label={typeof label === 'string' ? label : undefined}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, idx) => (
            <li
              key={idx}
              role="menuitem"
              tabIndex={0}
              data-value={item}
              onMouseDown={() => handleSelect(item)}   // 마우스 선택(버블링 전 처리)
              onKeyDown={onItemKeyDown}                // 키보드 선택
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default React.memo(DropdownButton);
