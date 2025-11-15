// C:\next\rdwiki\app\components\editor\helpers\insertTable.ts
/**
 * 심플 표 삽입 헬퍼
 * - rows × cols 크기의 기본 표 삽입
 * - 표 정렬(align)과 최대 너비(maxWidth) 메타 정보 포함
 * - 삽입 직후 커서를 "첫 번째 셀의 단락 텍스트"로 이동
 */

import { Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import type { TableCellElement, TableElement } from '@/types/slate';

export type TableAlign = 'left' | 'center' | 'right';

export type InsertTableOptions = {
  rows: number;
  cols: number;
  /** 표 정렬 (기본: left) */
  align?: TableAlign;
  /**
   * 표 최대 너비(px)
   * - null/undefined 이면 100% (가로 전체)
   * - 기본값: 800px
   */
  maxWidth?: number | null;
};

const MAX_ROWS = 20;
const MAX_COLS = 20;

/** 빈 셀 생성 유틸 */
const makeCell = (): TableCellElement => ({
  type: 'table-cell',
  rowspan: 1,
  colspan: 1,
  children: [{ type: 'paragraph', children: [{ text: '' }] }],
});

/**
 * rows × cols 표 삽입
 * - align / maxWidth 옵션 포함
 */
export function insertTable(editor: Editor, opts: InsertTableOptions) {
  const rawRows = opts.rows | 0;
  const rawCols = opts.cols | 0;

  const rows = Math.max(1, Math.min(MAX_ROWS, rawRows));
  const cols = Math.max(1, Math.min(MAX_COLS, rawCols));

  const align: TableAlign = opts.align ?? 'left';
  const maxWidth =
    typeof opts.maxWidth === 'number'
      ? Math.max(240, opts.maxWidth) // 너무 작은 값 방지
      : opts.maxWidth ?? 800; // 기본 800px

  type TableWithLayout = TableElement & {
    align?: TableAlign;
    maxWidth?: number | null;
    fullWidth?: boolean;
  };

  const table: TableWithLayout = {
    type: 'table',
    align,
    maxWidth,
    // 기존 fullWidth 필드를 쓰고 있다면 호환용으로 유지
    fullWidth: maxWidth == null,
    children: Array.from({ length: rows }, () => ({
      type: 'table-row',
      children: Array.from({ length: cols }, makeCell),
    })),
  };

  // 표 삽입
  Transforms.insertNodes(editor, table as any, { select: false });

  // 삽입된 "마지막 표"의 첫 leaf로 이동
  try {
    const allTables = Array.from(
      Editor.nodes(editor, {
        at: [],
        match: n => (n as any).type === 'table',
      })
    );
    const last = allTables.at(-1);
    if (last) {
      const [, tablePath] = last;
      const start = Editor.start(editor, tablePath);
      Transforms.select(editor, start);
      ReactEditor.focus(editor as any);
    }
  } catch {
    // 포커스 이동 실패해도 에러 무시
  }
}
