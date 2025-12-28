// components/editor/helpers/wrapWikiRef.ts
import type { Editor } from 'slate';
import { Transforms, Range } from 'slate';

export type WikiRefType = 'quest' | 'npc' | 'qna';

export function wrapSelectionWithWikiRef(editor: Editor, refType: WikiRefType, refId: number) {
  const sel = editor.selection;
  if (!sel || Range.isCollapsed(sel)) return;

  const refEl: any = {
    type: 'wiki-ref',
    refType,
    refId,
    children: [],
  };

  // 선택 범위를 inline 요소로 감싸기 (하이퍼링크 패턴)
  Transforms.wrapNodes(editor, refEl, { split: true });
  Transforms.collapse(editor, { edge: 'end' });
}
