// =============================================
// File: app/components/editor/MarkButton.tsx
// =============================================
/**
 * 툴바에서 bold/italic 등 텍스트 마크(스타일) 적용·해제 토글 버튼 컴포넌트
 * - 클릭 시 selectionRef를 복원하여 해당 마크를 즉시 토글
 * - 에디터 포커스/selection 복원, isMarkActive로 활성화 표시
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
  format: MarkFormat;                       // 'bold' | 'italic' | 'underline' | 'strikethrough' 등
  icon: React.ReactNode;                    // 버튼에 표시할 아이콘
  selectionRef: React.RefObject<Range | null>; // 커서(선택) 저장 ref(툴바 드롭다운/클릭과 연동)
};

// 메인 버튼 컴포넌트
const MarkButton = ({ format, icon, selectionRef }: MarkButtonProps) => {
  const editor = useSlate();

  /**
   * [마크 버튼 클릭 시]
   * - selectionRef에서 커서/선택 복원, 에디터 포커스
   * - 해당 마크 토글(toggleMark)
   * - 타이밍 보장 위해 setTimeout
   */
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

  // 렌더링
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
