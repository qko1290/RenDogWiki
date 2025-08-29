'use client';

/**
 * C:\next\rdwiki\app\components\editor\TableContextMenu.tsx
 * 표 우클릭 컨텍스트 메뉴
 * - open 이벤트: window.dispatchEvent(new CustomEvent('editor:table-menu', { detail:{ x,y, cellPath } }))
 * - 항목: 셀 병합(선택 직사각형), 행 분할(rowspan 해제), 열 분할(colspan 해제), 너비 맞춤, 삭제(행/열 전체 선택 시)
 */

import React, { useEffect, useRef, useState } from 'react';
import { Editor, Path } from 'slate';
import { ReactEditor } from 'slate-react';
import {
  getSelectedRectOrCell,
  mergeCells,
  splitCellByCol,
  splitCellByRow,
  toggleTableFullWidth,
  removeTable,
  findTablePath,
  isFullRowSelection,
  isFullColSelection,
  removeRows,
  removeCols,
} from './helpers/tableOps';
import { getDragRect, clearDrag } from './helpers/tableDrag';

type Props = { editor: Editor };

export default function TableContextMenu({ editor }: Props) {
  const [open, setOpen] = useState(false);
  const [xy, setXY] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cellPath, setCellPath] = useState<Path | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = (e: any) => {
      const { x, y, cellPath } = (e as CustomEvent).detail || {};
      setXY({ x, y });
      setCellPath(cellPath);
      setOpen(true);
    };
    window.addEventListener('editor:table-menu' as any, onOpen as any);
    return () => window.removeEventListener('editor:table-menu' as any, onOpen as any);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && e.target instanceof Node && boxRef.current.contains(e.target)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('mousedown', close);
    addEventListener('wheel', close, { passive: true });
    addEventListener('keydown', esc);
    return () => {
      removeEventListener('mousedown', close);
      removeEventListener('wheel', close);
      removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!open || !cellPath) return null;

  const act = (fn: () => void) => () => {
    try { ReactEditor.focus(editor as any); } catch {}
    fn();
    clearDrag(); // 작업 후 드래그 상태 초기화
    setOpen(false);
  };

  const tablePath = findTablePath(editor, cellPath);

  // 드래그 rect 우선, 없으면 selection 기반
  const rect = (() => {
    const drag = getDragRect();
    if (drag && Path.equals(drag.tablePath, tablePath)) return drag;
    return getSelectedRectOrCell(editor, cellPath);
  })();

  const canDeleteRow = isFullRowSelection(editor, rect);
  const canDeleteCol = isFullColSelection(editor, rect);
  const canDelete = canDeleteRow || canDeleteCol;

  return (
    <div
      ref={boxRef}
      style={{
        position: 'fixed', top: xy.y, left: xy.x,
        transform: 'translateY(-8px)',
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,.12)',
        padding: 6, zIndex: 99999, minWidth: 140
      }}
      role="menu"
      aria-label="표 메뉴"
    >
      <MenuItem onClick={act(() => mergeCells(editor, rect))}>셀 병합</MenuItem>
      <MenuItem onClick={act(() => splitCellByRow(editor, cellPath))}>행 분할</MenuItem>
      <MenuItem onClick={act(() => splitCellByCol(editor, cellPath))}>열 분할</MenuItem>
      <MenuItem onClick={act(() => toggleTableFullWidth(editor, tablePath))}>너비 맞춤</MenuItem>

      <MenuItem
        danger={canDelete}
        onClick={
          canDelete
            ? act(() => {
                if (canDeleteRow) removeRows(editor, rect.tablePath, rect.r0, rect.r1);
                else if (canDeleteCol) removeCols(editor, rect.tablePath, rect.c0, rect.c1);
              })
            : () => {}
        }
      >
        {canDeleteRow ? '행 삭제' : canDeleteCol ? '열 삭제' : '삭제(행/열 전체 선택 시)'}
      </MenuItem>
    </div>
  );
}

function MenuItem(
  { children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }
) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        borderRadius: 6,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: danger ? '#e11d48' : '#111827'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      role="menuitem"
    >
      {children}
    </button>
  );
}
