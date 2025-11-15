// C:\next\rdwiki\app\components\editor\TableContextMenu.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Editor, Path, Node as SlateNode } from 'slate';
import { ReactEditor } from 'slate-react';
import {
  getSelectedRectOrCell,
  mergeCells,
  splitCellByCol,
  splitCellByRow,
  findTablePath,
  isFullRowSelection,
  isFullColSelection,
  removeRows,
  removeCols,
  setTableAlignment,
  TableAlign,
} from './helpers/tableOps';
import { getDragRect, clearDrag } from './helpers/tableDrag';

type Props = { editor: Editor };

export default function TableContextMenu({ editor }: Props) {
  const [open, setOpen] = useState(false);
  const [xy, setXY] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cellPath, setCellPath] = useState<Path | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // 외부에서 열기 이벤트
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

  // 바깥 클릭/스크롤/ESC → 닫기
  useEffect(() => {
    if (!open) return;

    const close = (e: MouseEvent | WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (boxRef.current && target && boxRef.current.contains(target)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    window.addEventListener('mousedown', close, { capture: true });
    window.addEventListener('wheel', close, { passive: true });
    window.addEventListener('keydown', esc);

    return () => {
      window.removeEventListener('mousedown', close, { capture: true } as any);
      window.removeEventListener('wheel', close as any);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!open || !cellPath) return null;

  const act = (fn: () => void) => () => {
    try {
      ReactEditor.focus(editor as any);
    } catch {
      /* ignore */
    }
    fn();
    clearDrag();
    setOpen(false);
  };

  const tablePath = findTablePath(editor, cellPath);

  // 현재 표 정렬
  let align: TableAlign = 'left';
  try {
    const tbl = SlateNode.get(editor, tablePath) as any;
    if (tbl.align === 'center' || tbl.align === 'right') align = tbl.align;
  } catch {
    /* ignore */
  }

  // 현재 선택 영역(드래그 or selection)
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
        position: 'fixed',
        top: xy.y,
        left: xy.x,
        transform: 'translateY(-6px)',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        boxShadow: '0 6px 18px rgba(0,0,0,.12)',
        padding: 4,
        zIndex: 99999,
        minWidth: 140,
        maxWidth: 220,
        fontSize: 13,
      }}
      role="menu"
      aria-label="표 메뉴"
    >
      {/* 정렬 */}
      <MenuItem
        onClick={act(() => setTableAlignment(editor, tablePath, 'left'))}
        active={align === 'left'}
      >
        왼쪽 정렬
      </MenuItem>
      <MenuItem
        onClick={act(() => setTableAlignment(editor, tablePath, 'center'))}
        active={align === 'center'}
      >
        가운데 정렬
      </MenuItem>
      <MenuItem
        onClick={act(() => setTableAlignment(editor, tablePath, 'right'))}
        active={align === 'right'}
      >
        오른쪽 정렬
      </MenuItem>

      <MenuDivider />

      {/* 셀/행/열 조작 */}
      <MenuItem onClick={act(() => mergeCells(editor, rect))}>셀 병합</MenuItem>
      <MenuItem onClick={act(() => splitCellByRow(editor, cellPath))}>행 분할</MenuItem>
      <MenuItem onClick={act(() => splitCellByCol(editor, cellPath))}>열 분할</MenuItem>

      <MenuItem
        danger={canDelete}
        onClick={
          canDelete
            ? act(() => {
                if (canDeleteRow) {
                  removeRows(editor, rect.tablePath, rect.r0, rect.r1);
                } else if (canDeleteCol) {
                  removeCols(editor, rect.tablePath, rect.c0, rect.c1);
                }
              })
            : () => {}
        }
      >
        {canDeleteRow ? '행 삭제' : canDeleteCol ? '열 삭제' : '삭제(행/열 전체 선택 시)'}
      </MenuItem>
    </div>
  );
}

function MenuDivider() {
  return (
    <div
      style={{
        margin: '4px 4px',
        borderTop: '1px solid #e5e7eb',
      }}
    />
  );
}

function MenuItem({
  children,
  onClick,
  danger,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  const baseColor = danger ? '#e11d48' : active ? '#2563eb' : '#111827';

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '6px 8px',
        borderRadius: 6,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: baseColor,
        fontWeight: active ? 600 : 400,
        fontSize: 13,
        lineHeight: 1.2,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      role="menuitem"
    >
      {children}
    </button>
  );
}
