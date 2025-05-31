// File: app/components/editor/MarkButton.tsx

/**
 * 툴바에서 bold/italic 등 텍스트 마크 적용·해제 토글 버튼 컴포넌트
 * - 클릭 시 selectionRef를 복원하여 해당 마크를 한 번에 토글 적용
 */

'use client';

import React from 'react';
import { useSlate } from 'slate-react';
import { Range, Transforms } from 'slate';
import type { MarkFormat } from '@/types/slate';
import { isMarkActive, toggleMark } from './helpers/toggleMark';
import { ReactEditor } from 'slate-react';

// 타입 정의
type MarkButtonProps = {
  format: MarkFormat;
  icon: React.ReactNode;
  selectionRef: React.RefObject<Range | null>;
};

// 메인 버튼 컴포넌트
const MarkButton = ({ format, icon, selectionRef }: MarkButtonProps) => {
  const editor = useSlate();

  // 클릭 시 selection 복원 -> 포커스 -> 마크 토글
  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setTimeout(() => {
      const selection = selectionRef.current;
      if (selection) {
        Transforms.select(editor, selection);
        ReactEditor.focus(editor);
        toggleMark(editor, format);
      }
    }, 0);
  };

  return (
    <button
      type="button"
      onMouseDown={handleMouseDown}
      className={`mark-button ${isMarkActive(editor, format) ? 'active' : ''}`}
    >
      <span>{icon}</span>
    </button>
  );
};

export default MarkButton;
