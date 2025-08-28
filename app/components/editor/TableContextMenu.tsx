'use client';

/**
 * C:\next\rdwiki\app\components\editor\TableContextMenu.tsx
 * 표 우클릭 컨텍스트 메뉴
 * - open 이벤트: window.dispatchEvent(new CustomEvent('editor:table-menu', { detail:{ x,y, cellPath } }))
 * - 항목: 셀 병합(선택 직사각형), 행 분할(rowspan 해제), 열 분할(colspan 해제), 너비 맞춤, 삭제
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Editor, Path } from 'slate';
import { ReactEditor } from 'slate-react';
import {
  getSelectedRectOrCell,
  mergeCells,
  splitCellByCol,
  splitCellByRow,
  toggleTableFullWidth,
  removeTable,
  findTablePath
} from './helpers/tableOps';

type Props = { editor: Editor };

export default function TableContextMenu({ editor }: Props) {
  const [open, setOpen] = useState(false);
  const [xy, setXY] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cellPath, setCellPath] = useState<Path | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // 메뉴 오픈 이벤트 구독
  useEffect(() => {
    const onOpen = (e: Event) => {
      const { x, y, cellPath } = (e as CustomEvent).detail || {};
      setXY({ x, y });
      setCellPath(cellPath);
      setOpen(true);
    };
    window.addEventListener('editor:table-menu' as any, onOpen as any);
    return () => window.removeEventListener('editor:table-menu' as any, onOpen as any);
  }, []);

  // 외부 클릭/휠/ESC 닫기
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

  // 화면 가장자리 클램프
  useLayoutEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      const box = boxRef.current?.getBoundingClientRect();
      if (!box) return;
      let { x, y } = xy;
      if (x + box.width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - 8 - box.width);
      if (y + box.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - 8 - box.height);
      if (x !== xy.x || y !== xy.y) setXY({ x, y });
    });
  }, [open, xy]);

  if (!open || !cellPath) return null;

  const act = (fn: () => void) => () => {
    try { ReactEditor.focus(editor as any); } catch {}
    fn();
    setOpen(false);
  };

  const rect = getSelectedRectOrCell(editor, cellPath);
  const tablePath = findTablePath(editor, cellPath);

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
      <MenuItem danger onClick={act(() => removeTable(editor, tablePath))}>삭제</MenuItem>
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
