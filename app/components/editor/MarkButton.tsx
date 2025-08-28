// =============================================
// File: app/components/editor/MarkButton.tsx
// =============================================
/**
 * 툴바에서 bold/italic 등 텍스트 마크(스타일) 적용·해제 토글 버튼
 * - 클릭 시 selectionRef로 커서/선택 복원 → 포커스 → 해당 마크 토글
 * - isMarkActive로 활성화 UI/ARIA 반영
 */

'use client';

import React from 'react';
import { useSlate, ReactEditor } from 'slate-react';
import { Range, Transforms } from 'slate';
import type { MarkFormat } from '@/types/slate';
import { isMarkActive, toggleMark } from './helpers/toggleMark';

type MarkButtonProps = {
  /** 'bold' | 'italic' | 'underline' | 'strikethrough' 등 */
  format: MarkFormat;
  /** 버튼 표시 아이콘(텍스트/이모지/ReactNode) */
  icon: React.ReactNode;
  /** 드롭다운/버튼 클릭 전의 selection 저장 ref */
  selectionRef: React.RefObject<Range | null>;
};

const MarkButton = ({ format, icon, selectionRef }: MarkButtonProps) => {
  const editor = useSlate();
  const active = isMarkActive(editor, format);

  /**
   * 클릭 시:
   * - selectionRef에서 선택 복원(없으면 현재 selection 유지)
   * - 에디터 포커스 후 해당 마크 토글
   * - setTimeout: DOM 업데이트/selection 타이밍 충돌 방지
   */
  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    setTimeout(() => {
      const saved = selectionRef.current;
      if (saved) {
        try { Transforms.select(editor, saved); } catch {}
      }
      ReactEditor.focus(editor);
      toggleMark(editor, format);
    }, 0);
  };

  return (
    <button
      type="button"
      onMouseDown={handleMouseDown}
      className={`mark-button ${active ? 'active' : ''}`}
      aria-pressed={active}
      aria-label={`${format} 토글`}
      title={`${format} 토글`}
    >
      <span>{icon}</span>
    </button>
  );
};

export default MarkButton;
