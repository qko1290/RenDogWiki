// =============================================
// File: app/components/editor/helpers/toggleMark.ts
// =============================================
/**
 * Slate 에디터 텍스트 스타일 토글/적용 유틸
 * - 기본 마크: bold, italic, underline 등
 * - 스타일 마크: color, fontSize, backgroundColor 등(값 기반)
 */

import { Editor, Transforms, Text, Range } from 'slate';
import type { MarkFormat } from '@/types/slate';

type StyleMark = 'color' | 'fontSize' | 'backgroundColor';

/**
 * 마크(텍스트 스타일) 활성화 여부
 * - format: 'bold', 'italic', 'color', 'fontSize' 등
 */
export const isMarkActive = (editor: Editor, format: MarkFormat | StyleMark) => {
  const marks = Editor.marks(editor);
  return marks ? (marks as any)[format] !== undefined : false;
};

/**
 * 마크(스타일) 토글/적용
 * - format: 마크명 또는 스타일명
 * - value: 스타일 값(색상/크기 등). 없으면 스타일 마크는 제거 동작.
 * - color/fontSize/backgroundColor는 값 기반 적용/제거
 * - bold/italic 등은 addMark/removeMark로 on/off
 */
export const toggleMark = (
  editor: Editor,
  format: MarkFormat | StyleMark,
  value?: string
) => {
  const { selection } = editor;
  if (!selection) return;

  const isCollapsed = Range.isCollapsed(selection);
  const isStyle = (fmt: string): fmt is StyleMark =>
    fmt === 'color' || fmt === 'fontSize' || fmt === 'backgroundColor';

  // ----- 값 기반 스타일 마크 처리 -----
  if (isStyle(format)) {
    // 현재 값과 동일하면 불필요한 업데이트 방지
    const current = (Editor.marks(editor) as any)?.[format];
    const nextValue = value ?? '';

    // 제거(값이 비었거나 동일 값 재요청 시 제거 의도)
    if (!nextValue) {
      if (isCollapsed) {
        Editor.removeMark(editor, format);
      } else {
        Transforms.unsetNodes(editor, format as any, {
          match: Text.isText,
          split: true,
        });
      }
      return;
    }

    // 동일 값이면 히스토리 오염 방지 차단
    if (current === nextValue) return;

    // 적용
    if (isCollapsed) {
      // 커서만 있을 때는 addMark로 이후 타이핑에도 유지
      Editor.addMark(editor, format, nextValue);
    } else {
      // 영역 선택일 때는 해당 범위 텍스트 노드에 직접 값 세팅
      Transforms.setNodes(
        editor,
        { [format]: nextValue } as any,
        { match: Text.isText, split: true }
      );
    }
    return;
  }

  // ----- 기본 토글 마크 처리(bold/italic/underline/...) -----
  const active = isMarkActive(editor, format as MarkFormat);
  if (active) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
};
