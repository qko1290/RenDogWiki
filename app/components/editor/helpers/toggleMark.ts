// File: app/components/editor/helpers/toggleMark.ts

/**
 * 에디터용 텍스트 스타일 토글 적용 유틸
 * - bold/italic/underline 등 기본 마크, color/fontSize/background 등 스타일 마크 모두 지원
 */

import { Editor, Transforms, Text } from 'slate';
import type { MarkFormat } from '@/types/slate';

// 마크 활성화 여부 판별
export const isMarkActive = (editor: Editor, format: MarkFormat) => {
  const marks = Editor.marks(editor);
  return marks ? marks[format] !== undefined : false;
};

// 마크(스타일) 토글/적용
/**
 * editor Slate 에디터 인스턴스
 * format 마크/스타일명('bold'|'italic'|'color'|'fontSize' 등)
 * value 스타일 계열이면 적용값(색상/크기 등)
 */
export const toggleMark = (
  editor: Editor,
  format: MarkFormat | 'color' | 'fontSize' | 'backgroundColor',
  value?: string
) => {
  const isActive = isMarkActive(editor, format as MarkFormat);

  // 스타일 마크는 값 직접 세팅
  if (format === 'color' || format === 'fontSize' || format === 'backgroundColor') {
    Transforms.setNodes(
      editor,
      { [format]: value },
      { match: Text.isText, split: true }
    );
  } else {
    // 기본 마크는 on/off 토글
    if (isActive) {
      Editor.removeMark(editor, format);
    } else {
      Editor.addMark(editor, format, true);
    }
  }
};
