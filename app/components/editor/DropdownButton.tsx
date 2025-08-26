// =============================================
// File: app/components/editor/DropdownButton.tsx
// =============================================
/**
 * 에디터 툴바 드롭다운 버튼
 * - label(표시명) + items(옵션 문자열 배열) 렌더링
 * - 드롭다운이 열릴 때 selectionRef에 현재 selection 저장
 * - 항목 클릭(또는 Enter/Space) 시 selectionRef로 커서 복원 → 포커스 → 해당 마크 적용
 * - 열림/닫힘은 부모의 openDropdown 상태로 제어(동일 툴바 내 상호 배타 열림)
 * - (옵션) itemsMap으로 표시 라벨 → 실제 값 매핑 가능
 */

'use client';

import React, { useCallback } from 'react';
import { useSlate, ReactEditor } from 'slate-react';
import { Editor, Range, Transforms } from 'slate';

type DropdownButtonProps = {
  label: React.ReactNode;
  items: string[];
  /** 표시 라벨 → 실제 값 매핑(없으면 라벨 그대로 값 사용) */
  itemsMap?: Record<string, string>;
  onSelect?: (appliedValue: string) => void;
  selectionRef: React.MutableRefObject<Range | null>;
  dropdownId: string;
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
};

const DropdownButton = ({
  label, items, itemsMap, onSelect, selectionRef,
  dropdownId, openDropdown, setOpenDropdown
}: DropdownButtonProps) => {
  const editor = useSlate();
  const isOpen = openDropdown === dropdownId;

  const handleSelect = useCallback((itemLabel: string) => {
    const markType = dropdownId;
    const applied = itemsMap?.[itemLabel] ?? itemLabel;

    setTimeout(() => {
      if (selectionRef.current) {
        Transforms.select(editor, selectionRef.current);
      }
      ReactEditor.focus(editor);
      Editor.addMark(editor, markType, applied);
    }, 0);

    onSelect?.(applied);
    setOpenDropdown(null);
  }, [dropdownId, editor, itemsMap, onSelect, selectionRef, setOpenDropdown]);

  const onItemKeyDown: React.KeyboardEventHandler<HTMLLIElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const label = (e.currentTarget.getAttribute('data-value') ?? '') as string;
      handleSelect(label);
    }
  };

  const onMenuKeyDown: React.KeyboardEventHandler<HTMLUListElement> = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpenDropdown(null);
      setTimeout(() => ReactEditor.focus(editor), 0);
    }
  };

  return (
    <div className="editor-dropdown">
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
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
          {items.map((itemLabel, idx) => (
            <li
              key={idx}
              role="menuitem"
              tabIndex={0}
              data-value={itemLabel}
              onMouseDown={() => handleSelect(itemLabel)}
              onKeyDown={onItemKeyDown}
            >
              {itemLabel}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default React.memo(DropdownButton);
