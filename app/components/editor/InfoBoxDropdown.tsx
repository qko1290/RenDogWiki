// =============================================
// File: app/components/editor/InfoBoxDropdown.tsx
// =============================================

/**
 * InfoBox(정보/주의/경고) 삽입용 드롭다운 버튼 컴포넌트
 * - 툴바에서 사용, 버튼 클릭 시 드롭다운 표시 및 선택 지원
 * - selectionRef로 커서 위치 복원, 드롭다운 열림/닫힘 상태 제어
 */

'use client';

import React from 'react';
import { useSlate, ReactEditor } from 'slate-react';
import { Range, Transforms } from 'slate';
import insertInfoBox from './helpers/insertInfoBox';
import type { InfoBoxType } from '@/types/slate';

type InfoBoxDropdownProps = {
  // ✅ 커서를 저장/복원해야 하므로 MutableRefObject 사용
  selectionRef: React.MutableRefObject<Range | null>;
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

  /** InfoBox 타입 선택 → selection 복원 → info-box 삽입 → 닫기 */
  const handleSelect = (boxType: InfoBoxType) => {
    if (selectionRef.current) {
      Transforms.select(editor, selectionRef.current);
    }
    ReactEditor.focus(editor);
    // 프로젝트 전역 규칙에 맞춰 'info-box' 타입 사용
    insertInfoBox(editor, 'info-box', boxType);
    setOpenDropdown(null);
  };

  return (
    <div className="editor-dropdown">
      <button
        type="button"
        onMouseDown={e => {
          // 버튼 포커스로 인한 selection 유실 방지 + 현재 selection 저장
          e.preventDefault();
          selectionRef.current = editor.selection ?? null;
          setOpenDropdown(isOpen ? null : dropdownId);
        }}
        className="editor-toolbar-btn"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${dropdownId}-menu` : undefined}
        aria-label="InfoBox 삽입"
      >
        📦
      </button>

      {isOpen && (
        <ul
          id={`${dropdownId}-menu`}
          className="editor-dropdown-menu"
          role="menu"
          aria-label="InfoBox 종류"
        >
          <li role="menuitem" tabIndex={0} onMouseDown={() => handleSelect('info')}>
            정보
          </li>
          <li role="menuitem" tabIndex={0} onMouseDown={() => handleSelect('warning')}>
            주의
          </li>
          <li role="menuitem" tabIndex={0} onMouseDown={() => handleSelect('danger')}>
            경고
          </li>
        </ul>
      )}
    </div>
  );
};

export default InfoBoxDropdown;
