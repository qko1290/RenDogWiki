// =============================================
// File: app/components/editor/helpers/insertFootnote.ts
// (전체 코드)
// =============================================

import { Editor, Range, Transforms } from 'slate';
import type { FootnoteElement } from '@/types/slate';

type InsertFootnoteInitial = Partial<Pick<FootnoteElement, 'label' | 'content'>>;

export function insertFootnote(editor: Editor, initial?: InsertFootnoteInitial) {
  if (!editor.selection) return;

  // 드래그된 텍스트가 있어도 텍스트를 감싸지 않고,
  // "커서 위치에 오브젝트 삽입" 느낌으로 동작하도록 끝점으로 collapse
  if (Range.isExpanded(editor.selection)) {
    Transforms.collapse(editor, { edge: 'end' });
  }

  const footnote: FootnoteElement = {
    type: 'footnote',
    label: (initial?.label ?? '각주').trim() || '각주',
    content: initial?.content ?? '',
    children: [{ text: '' }],
  };

  Transforms.insertNodes(editor, footnote as any);
}