// C:\next\rdwiki\app\components\editor\TableContextMenu.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Editor, Path, Node as SlateNode, Transforms } from 'slate';
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
} from './helpers/tableOps';
import { getDragRect, clearDrag } from './helpers/tableDrag';
import type { TableElement } from '@/types/slate';

type Props = { editor: Editor };

export default function TableContextMenu({ editor }: Props) {
  const [open, setOpen] = useState(false);
  const [xy, setXY] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cellPath, setCellPath] = useState<Path | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Element.tsx 에서 쏘는 'editor:table-menu' 이벤트로 열기
  useEffect(() => {
    const onOpen = (e: Event) => {
      const { x, y, cellPath } = (e as CustomEvent).detail || {};
      if (!cellPath) return;

      setXY({ x, y });
      setCellPath(cellPath);
      setOpen(true);
    };

    window.addEventListener('editor:table-menu' as any, onOpen as any);
    return () =>
      window.removeEventListener('editor:table-menu' as any, onOpen as any);
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
      window.removeEventListener('mousedown', close as any, {
        capture: true,
      } as any);
      window.removeEventListener('wheel', close as any);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!open || !cellPath) return null;

  // 공통 액션 래퍼: 포커스 + 실행 + 드래그 상태 초기화 + 메뉴 닫기
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

  // ✅ 비동기(clipboard) 액션 래퍼
  const actAsync = (fn: () => Promise<void>) => async () => {
    try {
      ReactEditor.focus(editor as any);
    } catch {
      /* ignore */
    }
    try {
      await fn();
    } finally {
      clearDrag();
      setOpen(false);
    }
  };

  // 현재 셀이 속한 표 path
  const tablePath = findTablePath(editor, cellPath);

  // 현재 표 정렬 상태 (TableElement.align 만 사용)
  let align: TableElement['align'] = 'left';
  try {
    const tbl = SlateNode.get(editor, tablePath) as TableElement;
    if (tbl.align === 'center' || tbl.align === 'right') {
      align = tbl.align;
    } else {
      align = 'left';
    }
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

  // 표 align 설정 (툴바 텍스트 정렬과 완전히 분리)
  const setTableAlign = (targetAlign: TableElement['align']) => {
    Transforms.setNodes<TableElement>(
      editor,
      { align: targetAlign } as Partial<TableElement>,
      { at: tablePath },
    );
  };

  // ✅ 행 추가(아래) 헬퍼
  const insertRowBelow = () => {
    try {
      const rowIndex = cellPath[cellPath.length - 2] as number;
      const rowPath = [...tablePath, rowIndex];

      const rowNode = SlateNode.get(editor, rowPath) as any;
      if (!rowNode || !Array.isArray(rowNode.children)) return;

      const newRow: any = {
        type: 'table-row',
        children: rowNode.children.map((cell: any) => {
          const newCell: any = {
            type: 'table-cell',
            children: [
              {
                type: 'paragraph',
                children: [{ text: '' }],
              },
            ],
          };
          if (cell.colspan != null) newCell.colspan = cell.colspan;
          if (cell.rowspan != null) newCell.rowspan = cell.rowspan;
          return newCell;
        }),
      };

      Transforms.insertNodes(editor, newRow, {
        at: [...tablePath, rowIndex + 1],
      });
    } catch (e) {
      console.error('insertRowBelow failed', e);
    }
  };

  // ✅ (신규) Slate fragment 인코딩 (inline-image 포함한 셀 내부 노드를 그대로 복사)
  const encodeSlateFragment = (fragment: any) => {
    // Slate 공식 패턴: btoa(encodeURIComponent(JSON.stringify(fragment)))
    const json = JSON.stringify(fragment);
    return window.btoa(encodeURIComponent(json));
  };

  const copyCellInnerContents = async () => {
    // 1) 셀 노드 가져오기
    let cellNode: any = null;
    try {
      cellNode = SlateNode.get(editor, cellPath);
    } catch {
      cellNode = null;
    }
    if (!cellNode) return;

    // 2) 셀 "내부"만: table-cell의 children(보통 paragraph들)
    const fragment = Array.isArray(cellNode.children) ? cellNode.children : [];
    const plain = SlateNode.string(cellNode) ?? '';

    // 3) 클립보드에 Slate fragment + plain text 동시 저장
    //    - fragment가 있으면 에디터에 붙여넣기 시 inline-image까지 그대로 복원됨
    //    - HTML(<td>)은 아예 넣지 않아서 “셀 자체 붙여넣기” 원천 차단
    const encoded = encodeSlateFragment(fragment);

    // ClipboardItem 지원 브라우저: mime 여러 개 넣기 가능
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.clipboard?.write && typeof (window as any).ClipboardItem === 'function') {
      const item = new (window as any).ClipboardItem({
        'application/x-slate-fragment': new Blob([encoded], {
          type: 'application/x-slate-fragment',
        }),
        // ✅ 호환용으로 하나 더
        'text/x-slate-fragment': new Blob([encoded], {
          type: 'text/x-slate-fragment',
        }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });
      await nav.clipboard.write([item]);
      return;
    }

    // fallback: plain text만이라도
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(plain);
      return;
    }

    // 최후 fallback: execCommand
    if (typeof document !== 'undefined') {
      const ta = document.createElement('textarea');
      ta.value = plain;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      ta.setAttribute('readonly', 'true');
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

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
        minWidth: 160,
        maxWidth: 240,
        fontSize: 13,
      }}
      role="menu"
      aria-label="표 메뉴"
    >
      {/* ✅ 단일 복사 메뉴: 셀 내부(텍스트 + inline-image 포함)만 복사 */}
      <MenuItem onClick={actAsync(copyCellInnerContents)}>
        셀 내용 복사
      </MenuItem>

      <MenuDivider />

      {/* 표 자체 정렬 (표 블록 align) */}
      <MenuItem
        onClick={act(() => setTableAlign('left'))}
        active={align === 'left' || !align}
      >
        표 왼쪽 정렬
      </MenuItem>
      <MenuItem
        onClick={act(() => setTableAlign('center'))}
        active={align === 'center'}
      >
        표 가운데 정렬
      </MenuItem>
      <MenuItem
        onClick={act(() => setTableAlign('right'))}
        active={align === 'right'}
      >
        표 오른쪽 정렬
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

      {/* 행 추가(아래) */}
      <MenuItem onClick={act(insertRowBelow)}>
        행 추가(아래)
      </MenuItem>

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
        {canDeleteRow
          ? '행 삭제'
          : canDeleteCol
          ? '열 삭제'
          : '삭제(행/열 전체 선택 시)'}
      </MenuItem>

      {/* 표 전체 삭제 */}
      <MenuDivider />
      <MenuItem
        danger
        onClick={act(() => {
          Transforms.removeNodes(editor, { at: tablePath });
        })}
      >
        표 삭제
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