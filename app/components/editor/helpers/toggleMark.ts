// =============================================
// File: app/components/editor/helpers/toggleMark.ts
// =============================================
/**
 * Slate 에디터 텍스트 스타일 토글/적용 유틸
 * - 기본 마크: bold, italic, underline 등
 * - 스타일 마크: color, fontSize, backgroundColor 등
 */

import { Editor, Transforms, Text } from 'slate';
import type { MarkFormat } from '@/types/slate';

/**
 * 마크(텍스트 스타일) 활성화 여부 판별
 * - format: 'bold', 'italic', 'color', 'fontSize' 등
 */
export const isMarkActive = (editor: Editor, format: MarkFormat) => {
  const marks = Editor.marks(editor);
  return marks ? marks[format] !== undefined : false;
};

/**
 * 마크(스타일) 토글/적용 함수
 * - format: 마크명 또는 스타일명
 * - value: 스타일 값(색상/크기 등)
 * - color/fontSize/backgroundColor는 setNodes로 값 적용
 * - bold/italic 등은 addMark/removeMark로 on/off
 */
export const toggleMark = (
  editor: Editor,
  format: MarkFormat | 'color' | 'fontSize' | 'backgroundColor',
  value?: string
) => {
  const isActive = isMarkActive(editor, format as MarkFormat);

  // 스타일 마크(색상/크기/배경): 값 직접 세팅
  if (format === 'color' || format === 'fontSize' || format === 'backgroundColor') {
    Transforms.setNodes(
      editor,
      { [format]: value },
      { match: Text.isText, split: true }
    );
  } else {
    // bold/italic 등 기본 마크: 토글
    if (isActive) {
      Editor.removeMark(editor, format);
    } else {
      Editor.addMark(editor, format, true);
    }
  }
};
