// C:\next\rdwiki\app\components\editor\helpers\insertTable.ts
/**
 * 네이버 에디터 방식 표 삽입 헬퍼
 * - 표 크기 최대 6x6 제한
 * - 삽입 직후 커서를 "첫 번째 셀의 단락 텍스트"로 이동(leaf 포커스)
 */

import { Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import type { TableCellElement, TableElement } from '@/types/slate';

const MAX = 6;

export function insertTable(editor: Editor, rows: number, cols: number) {
  const r = Math.max(1, Math.min(MAX, rows | 0));
  const c = Math.max(1, Math.min(MAX, cols | 0));

  const makeCell = (): TableCellElement => ({
    type: 'table-cell',
    rowspan: 1,
    colspan: 1,
    children: [{ type: 'paragraph', children: [{ text: '' }] }],
  });

  const table: TableElement = {
    type: 'table',
    fullWidth: false,
    children: Array.from({ length: r }, () => ({
      type: 'table-row',
      children: Array.from({ length: c }, makeCell),
    })),
  };

  Transforms.insertNodes(editor, table);

  // 표의 첫 leaf로 이동
  try {
    const all = Array.from(Editor.nodes(editor, { at: [], match: n => (n as any).type === 'table' }));
    const last = all.at(-1);
    if (last) {
      const start = Editor.start(editor, last[1]);
      Transforms.select(editor, start);
      ReactEditor.focus(editor);
    }
  } catch {}
}
