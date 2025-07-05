// =============================================
// File: app/components/editor/helpers/toggleMark.ts
// =============================================
/**
 * 에디터용 텍스트 스타일 토글/적용 유틸
 * - bold/italic/underline 등 기본 마크
 * - color/fontSize/backgroundColor
 */

import { Editor, Transforms, Text } from 'slate';
import type { MarkFormat } from '@/types/slate';

/**
 * [마크 활성화 여부 판별]
 * - format: 마크/스타일명('bold'|'italic'|'color'|'fontSize' 등)
 */
export const isMarkActive = (editor: Editor, format: MarkFormat) => {
  const marks = Editor.marks(editor);
  return marks ? marks[format] !== undefined : false;
};

/**
 * [마크(스타일) 토글/적용]
 * - format: 마크명(기본/bold/italic/underline 등 또는 커스텀 스타일 계열)
 * - value: 스타일 계열이면 적용값(색상, 크기 등)
 * - 동작:
 *   - 스타일 마크(color/fontSize/backgroundColor): setNodes로 값 직접 적용
 *   - 기본 마크(bold 등): on/off 토글(addMark/removeMark)
 */
export const toggleMark = (
  editor: Editor,
  format: MarkFormat | 'color' | 'fontSize' | 'backgroundColor',
  value?: string
) => {
  const isActive = isMarkActive(editor, format as MarkFormat);

  // 1. 스타일 마크(색상/크기/배경 등): 값으로 직접 세팅
  if (format === 'color' || format === 'fontSize' || format === 'backgroundColor') {
    Transforms.setNodes(
      editor,
      { [format]: value },                   // 스타일 적용
      { match: Text.isText, split: true }    // 텍스트 노드에만, 필요시 분할
    );
  } else {
    // 2. 기본 마크: 토글(on/off)
    if (isActive) {
      Editor.removeMark(editor, format);     // 이미 적용됨 -> 해제
    } else {
      Editor.addMark(editor, format, true);  // 미적용 -> on
    }
  }
};
