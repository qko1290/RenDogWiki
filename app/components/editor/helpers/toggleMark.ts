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

/** 안전한 marks 조회: selection이 엘리먼트 경로일 때 throw 나는 문제 방지 */
const safeMarks = (editor: Editor) => {
  try {
    // selection 이 없거나 비정상일 때는 null 반환
    if (!editor.selection) return null;
    // 내부적으로 leaf를 찾다가 throw 될 수 있으므로 try/catch
    return Editor.marks(editor);
  } catch {
    return null;
  }
};

/**
 * 마크(텍스트 스타일) 활성화 여부
 * - format: 'bold', 'italic', 'color', 'fontSize' 등
 */
export const isMarkActive = (editor: Editor, format: MarkFormat | StyleMark) => {
  try {
    const { selection } = editor;
    if (!selection) return false;

    // 선택 범위에 텍스트 노드가 하나라도 있는지 확인
    const iter = Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: Text.isText,
      universal: true,
    });
    const first = iter.next().value;
    if (!first) return false;

    const marks = Editor.marks(editor);
    return marks ? (marks as any)[format] !== undefined : false;
  } catch {
    return false;
  }
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

  const isStyle = (fmt: string): fmt is StyleMark =>
    fmt === 'color' || fmt === 'fontSize' || fmt === 'backgroundColor';

  if (isStyle(format)) {
    let current: any;
    try { current = (Editor.marks(editor) as any)?.[format]; } catch { current = undefined; }

    const nextValue = value ?? '';

    if (!nextValue) {
      if (Range.isCollapsed(selection)) Editor.removeMark(editor, format);
      else {
        Transforms.unsetNodes(editor, format as any, { match: Text.isText, split: true });
      }
      return;
    }
    if (current === nextValue) return;

    if (Range.isCollapsed(selection)) Editor.addMark(editor, format, nextValue);
    else {
      Transforms.setNodes(editor, { [format]: nextValue } as any, { match: Text.isText, split: true });
    }
    return;
  }

  // 기본 마크 토글(bold/italic/...)
  let active = false;
  try { active = isMarkActive(editor, format as MarkFormat); } catch { active = false; }
  if (active) Editor.removeMark(editor, format);
  else Editor.addMark(editor, format, true);
};