// C:\next\rdwiki\app\components\editor\TableContextMenu.tsx
'use client';

/**
 * 표 우클릭 컨텍스트 메뉴
 * - open 이벤트: window.dispatchEvent(new CustomEvent('editor:table-menu', { detail:{ x,y, cellPath } }))
 * - 항목:
 *   · 표 정렬(왼쪽/가운데/오른쪽)
 *   · 표 최대 너비 프리셋(480 / 720 / 100%)
 *   · 셀 병합/분할
 *   · 행/열 삭제
 */

import React, { useEffect, useRef, useState } from 'react';
import { Editor, Path, Node as SlateNode } from 'slate'; // ★ Node 이름 충돌 방지
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
  setTableAlignment,
  setTableMaxWidth,
  TableAlign,
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
      const target = e.target as HTMLElement | null;
      // ★ target 을 HTMLElement 로 취급해서 타입 에러 제거
      if (boxRef.current && target && boxRef.current.contains(target)) return;
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

  // 현재 표 속성(정렬/최대 너비)
  let align: TableAlign = 'left';
  let maxWidth: number | null = null;
  try {
    const tbl = SlateNode.get(editor, tablePath) as any; // ★ SlateNode 사용
    if (tbl.align === 'center' || tbl.align === 'right') align = tbl.align;
    maxWidth = typeof tbl.maxWidth === 'number' ? tbl.maxWidth : null;
  } catch {}

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
        padding: 6, zIndex: 99999, minWidth: 160
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

      {/* 최대 너비 프리셋 */}
      <MenuItem
        onClick={act(() => setTableMaxWidth(editor, tablePath, 480))}
        active={maxWidth === 480}
      >
        폭 480px
      </MenuItem>
      <MenuItem
        onClick={act(() => setTableMaxWidth(editor, tablePath, 720))}
        active={maxWidth === 720}
      >
        폭 720px
      </MenuItem>
      <MenuItem
        onClick={act(() => setTableMaxWidth(editor, tablePath, null))}
        active={maxWidth == null}
      >
        폭 100% (가로 전체)
      </MenuItem>

      <MenuDivider />

      {/* 셀/행/열 조작 */}
      <MenuItem onClick={act(() => mergeCells(editor, rect))}>
        셀 병합
      </MenuItem>
      <MenuItem onClick={act(() => splitCellByRow(editor, cellPath))}>
        행 분할
      </MenuItem>
      <MenuItem onClick={act(() => splitCellByCol(editor, cellPath))}>
        열 분할
      </MenuItem>

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

function MenuDivider() {
  return (
    <div
      style={{
        margin: '4px 6px',
        borderTop: '1px solid #e5e7eb',
      }}
    />
  );
}

function MenuItem(
  {
    children,
    onClick,
    danger,
    active,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
    active?: boolean;
  }
) {
  const baseColor = danger ? '#e11d48' : active ? '#2563eb' : '#111827';

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
        color: baseColor,
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      role="menuitem"
    >
      {children}
    </button>
  );
}
