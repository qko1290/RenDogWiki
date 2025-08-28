/**
 * C:\next\rdwiki\app\components\editor\helpers\tableOps.ts
 * 표 조작 유틸(병합/분할/행·열/삭제/너비맞춤)
 * - 스키마: table > table-row[] > table-cell{rowspan?:number, colspan?:number} > paragraph > text
 */

import { Editor, Element as SlateElement, Node, Path, Transforms } from 'slate';
import type { TableCellElement, TableElement } from '@/types/slate';

export type CellPos = { r: number; c: number };
const isTable = (n: any) => SlateElement.isElement(n) && n.type === 'table';
const isRow   = (n: any) => SlateElement.isElement(n) && n.type === 'table-row';
const isCell  = (n: any) => SlateElement.isElement(n) && n.type === 'table-cell';

export const makeEmptyCell = (): TableCellElement => ({
  type: 'table-cell',
  rowspan: 1,
  colspan: 1,
  children: [{ type: 'paragraph', children: [{ text: '' }] }],
});

export function findCellPos(cellPath: Path): CellPos {
  const r = cellPath[cellPath.length - 2] as number;
  const c = cellPath[cellPath.length - 1] as number;
  return { r, c };
}

export function findTablePath(editor: Editor, fromPath: Path): Path {
  const [tableEntry] =
    Editor.nodes(editor, { at: fromPath, reverse: true, match: isTable });
  if (!tableEntry) throw new Error('table not found');
  return tableEntry[1];
}

export function getTableSize(editor: Editor, tablePath: Path) {
  const tableNode = Node.get(editor, tablePath) as any;
  const rows = (tableNode.children || []).length;
  const cols = rows ? (tableNode.children[0]?.children?.length ?? 0) : 0;
  return { rows, cols };
}

/** 선택이 복수 셀이면 그 직사각형 반환, 아니면 현재 셀만 */
export function getSelectedRectOrCell(editor: Editor, fallbackCellPath: Path) {
  const sel = editor.selection;
  if (!sel) {
    const { r, c } = findCellPos(fallbackCellPath);
    return { r0: r, c0: c, r1: r, c1: c, tablePath: findTablePath(editor, fallbackCellPath) };
  }

  const anchorCell = Editor.above(editor, { at: sel.anchor, match: isCell });
  const focusCell  = Editor.above(editor, { at: sel.focus,  match: isCell });
  if (!anchorCell || !focusCell) {
    const { r, c } = findCellPos(fallbackCellPath);
    return { r0: r, c0: c, r1: r, c1: c, tablePath: findTablePath(editor, fallbackCellPath) };
  }

  const tableA = findTablePath(editor, anchorCell[1]);
  const tableB = findTablePath(editor, focusCell[1]);
  if (Path.equals(tableA, tableB)) {
    const a = findCellPos(anchorCell[1]);
    const b = findCellPos(focusCell[1]);
    return {
      r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c),
      r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c),
      tablePath: tableA
    };
  }

  // 서로 다른 표인 경우 fallback
  const { r, c } = findCellPos(fallbackCellPath);
  return { r0: r, c0: c, r1: r, c1: c, tablePath: findTablePath(editor, fallbackCellPath) };
}

/** 셀 병합(선택 직사각형). 지원: 동일 표 내 사각형 병합 */
export function mergeCells(
  editor: Editor,
  rect: { tablePath: Path; r0: number; c0: number; r1: number; c1: number }
) {
  const { tablePath, r0, c0, r1, c1 } = rect;
  if (r0 === r1 && c0 === c1) return; // 한 셀만 선택이면 무시

  Editor.withoutNormalizing(editor, () => {
    // 1) 상단행: c0+1..c1 제거(역순)
    for (let col = c1; col >= c0 + 1; col--) {
      Transforms.removeNodes(editor, { at: [...tablePath, r0, col] });
    }
    // 2) 그 아래 행들: c0..c1 제거(역순)
    for (let row = r0 + 1; row <= r1; row++) {
      for (let col = c1; col >= c0; col--) {
        Transforms.removeNodes(editor, { at: [...tablePath, row, col] });
      }
    }
    // 3) 좌상단 셀에 rowspan/colspan 부여
    Transforms.setNodes<TableCellElement>(
      editor,
      { rowspan: (r1 - r0 + 1), colspan: (c1 - c0 + 1) },
      { at: [...tablePath, r0, c0] }
    );
  });
}

/** 현재 셀을 행 기준 분할(rowspan 해제) */
export function splitCellByRow(editor: Editor, cellPath: Path) {
  const tablePath = findTablePath(editor, cellPath);
  const { r, c } = findCellPos(cellPath);
  const cell = Node.get(editor, cellPath) as any;
  const rowSpan = Math.max(1, Number(cell.rowspan) || 1);

  if (rowSpan <= 1) return; // 분할 대상 아님

  Editor.withoutNormalizing(editor, () => {
    // 1) 현재 셀은 rowspan 1로
    Transforms.setNodes<TableCellElement>(editor, { rowspan: 1 }, { at: cellPath });

    // 2) 아래 행들에 새 셀 삽입
    for (let i = 1; i < rowSpan; i++) {
      const targetRowPath = [...tablePath, r + i];
      const rowNode = Node.get(editor, targetRowPath) as any;
      const insertIndex = Math.min(c, rowNode.children.length);
      Transforms.insertNodes<TableCellElement>(editor, makeEmptyCell(), { at: [...targetRowPath, insertIndex] });
    }
  });
}

/** 현재 셀을 열 기준 분할(colspan 해제) */
export function splitCellByCol(editor: Editor, cellPath: Path) {
  const { r, c } = findCellPos(cellPath);
  const tablePath = findTablePath(editor, cellPath);
  const cell = Node.get(editor, cellPath) as any;
  const colSpan = Math.max(1, Number(cell.colspan) || 1);

  if (colSpan <= 1) return;

  Editor.withoutNormalizing(editor, () => {
    Transforms.setNodes<TableCellElement>(editor, { colspan: 1 }, { at: cellPath });
    // 오른쪽에 (colSpan-1)개 삽입
    for (let i = 1; i < colSpan; i++) {
      Transforms.insertNodes<TableCellElement>(editor, makeEmptyCell(), { at: [...tablePath, r, c + i] });
    }
  });
}

/** 표 너비 맞춤 토글 */
export function toggleTableFullWidth(editor: Editor, tablePath: Path) {
  const table = Node.get(editor, tablePath) as any;
  const next = !table.fullWidth;
  Transforms.setNodes<TableElement>(editor, { fullWidth: next }, { at: tablePath });
}

/** 표 삭제 */
export function removeTable(editor: Editor, tablePath: Path) {
  Transforms.removeNodes(editor, { at: tablePath });
}
