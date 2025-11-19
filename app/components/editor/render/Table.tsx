// components/editor/render/Table.tsx
import React from 'react';
import { ReactEditor } from 'slate-react';
import type { RenderElementProps } from "slate-react";
import { Node, Transforms } from 'slate';
import type { TableElement } from '@/types/slate';
import {
  tablePathKey,
  useDragRect,
  beginDrag,
  hoverCell,
  isDragPrimedOrActive,
} from '../helpers/tableDrag';

export function TableElementRenderer(props: RenderElementProps & { editor: any }) {
  const { attributes, children, element, editor } = props;
  const table = element as TableElement;

  // 이 테이블의 고유 키
  const tablePath = ReactEditor.findPath(editor, element);
  const tkey = tablePathKey(tablePath);

  // 드래그 사각형 상태
  const rect = useDragRect(tkey);

  // 오버레이/레일/폭 조절용 ref & 상태
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const ovRef = React.useRef<HTMLDivElement | null>(null);

  // 노드에 저장된 폭(px)
  const widthFromNode =
    typeof table.maxWidth === 'number' ? table.maxWidth : null;
  const [liveWidth, setLiveWidth] = React.useState<number | null>(
    widthFromNode,
  );

  React.useEffect(() => {
    setLiveWidth(widthFromNode);
  }, [widthFromNode]);

  // 오버레이 위치 맞추기
  const positionOverlay = React.useCallback(() => {
    const wrap = wrapRef.current;
    const ov = ovRef.current;
    if (!wrap || !ov || !rect) {
      if (ov) ov.style.display = 'none';
      return;
    }

    const q = (r: number, c: number) =>
      wrap.querySelector(
        `td.slate-table__cell[data-tkey="${tkey}"][data-r="${r}"][data-c="${c}"]`,
      ) as HTMLElement | null;

    const a = q(rect.r0, rect.c0);
    const b = q(rect.r1, rect.c1);
    if (!a || !b) {
      ov.style.display = 'none';
      return;
    }

    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const base = wrap.getBoundingClientRect();

    const left = Math.round(ra.left - base.left);
    const top = Math.round(ra.top - base.top);
    const right = Math.round(rb.right - base.left);
    const bottom = Math.round(rb.bottom - base.top);

    ov.style.display = 'block';
    ov.style.left = left + 'px';
    ov.style.top = top + 'px';
    ov.style.width = Math.max(0, right - left - 1) + 'px';
    ov.style.height = Math.max(0, bottom - top - 1) + 'px';
  }, [rect, tkey]);

  React.useLayoutEffect(() => {
    positionOverlay();
  }, [positionOverlay]);

  React.useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => positionOverlay());
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [positionOverlay]);

  // 폭 조절 핸들 드래그
  const onResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const wrap = wrapRef.current;
    if (!wrap) return;

    const startX = e.clientX;
    const rectDom = wrap.getBoundingClientRect();
    const startWidth = liveWidth ?? rectDom.width;
    const parentRect = wrap.parentElement?.getBoundingClientRect();
    const containerWidth = parentRect?.width ?? window.innerWidth;

    // ✅ 표 최소 너비: 400px
    const MIN = 400;
    const MAX = Math.max(MIN, containerWidth - 16);
    let latest = startWidth;

    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const dx = ev.clientX - startX;
      let next = startWidth + dx;
      if (!Number.isFinite(next)) next = startWidth;
      next = Math.max(MIN, Math.min(next, MAX));
      latest = next;
      setLiveWidth(next);
    };

    const onUp = (ev: MouseEvent) => {
      ev.preventDefault();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      if (!Number.isFinite(latest)) return;

      const fullThreshold = containerWidth - 12;
      if (latest >= fullThreshold) {
        // 거의 전체 폭이면 100% 모드
        Transforms.setNodes<TableElement>(
          editor,
          {
            maxWidth: null,
            fullWidth: true,
          } as Partial<TableElement>,
          { at: tablePath },
        );
      } else {
        Transforms.setNodes<TableElement>(
          editor,
          {
            maxWidth: Math.round(latest),
            fullWidth: false,
          } as Partial<TableElement>,
          { at: tablePath },
        );
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const wrapWidth = liveWidth ?? widthFromNode;
  const tableAlign = table.align ?? 'left';

  const wrapStyle: React.CSSProperties = {
    position: 'relative',
    width: wrapWidth ? `${wrapWidth}px` : table.fullWidth ? '100%' : undefined,
    maxWidth: '100%',
  };

  // fullWidth(100%)가 아닌 경우에만 표 자체 정렬 적용
  if (!table.fullWidth) {
    if (tableAlign === 'center') {
      wrapStyle.marginLeft = 'auto';
      wrapStyle.marginRight = 'auto';
    } else if (tableAlign === 'right') {
      wrapStyle.marginLeft = 'auto';
      wrapStyle.marginRight = 0;
    } else {
      // left
      wrapStyle.marginLeft = 0;
      wrapStyle.marginRight = 'auto';
    }
  }

  const mergedRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      wrapRef.current = el;

      const attrRef = (attributes as any).ref;
      if (typeof attrRef === 'function') {
        attrRef(el);
      } else if (attrRef && typeof attrRef === 'object') {
        // MutableRefObject 같은 경우
        (attrRef as { current: any }).current = el;
      }
    },
    [attributes],
  );

  return (
    <div
      {...attributes}
      ref={mergedRef}
      data-tkey={tkey}
      style={wrapStyle}
      onMouseMoveCapture={(e) => {
        if (isDragPrimedOrActive()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onMouseUpCapture={(e) => {
        if (isDragPrimedOrActive()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <table
        className="slate-table"
        onDragStart={(e) => e.preventDefault()}
        style={{
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          width: '100%',
        }}
      >
        <tbody>{children}</tbody>
      </table>

      {/* 드래그 선택 오버레이 */}
      <div
        ref={ovRef}
        contentEditable={false}
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          border: '2px solid #2a9d6f',
          borderRadius: 6,
          boxSizing: 'border-box',
          background: 'rgba(42,157,111,.12)',
          pointerEvents: 'none',
          display: 'none',
        }}
      />

      {/* 폭 조절 핸들 */}
      <div
        contentEditable={false}
        aria-hidden
        onMouseDown={onResizeMouseDown}
        style={{
          position: 'absolute',
          right: -6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 12,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'col-resize',
          zIndex: 4,
        }}
      >
        <div
          style={{
            width: 3,
            height: '70%',
            borderRadius: 999,
            background: '#cbd5e1',
          }}
        />
      </div>
    </div>
  );
}

export function TableRowRenderer(props: RenderElementProps) {
  const { attributes, children } = props;
  return <tr {...attributes}>{children}</tr>;
}

export function TableCellRenderer(props: RenderElementProps & { editor: any }) {
  const { attributes, children, element, editor } = props;
  const el = element as any;
  const colSpan = Math.max(1, Number(el.colspan) || 1);
  const rowSpan = Math.max(1, Number(el.rowspan) || 1);

  const path = ReactEditor.findPath(editor, element);
  const tablePath = path.slice(0, -2);
  const tkey = tablePathKey(tablePath);
  const r = path[path.length - 2] as number;
  const c = path[path.length - 1] as number;

  const onDown: React.MouseEventHandler<HTMLTableCellElement> = (e) => {
    if (e.button !== 0) return; // 좌클릭만
    e.preventDefault(); // 네이티브 선택/드래그 차단
    e.stopPropagation(); // Slate 핸들러로 버블 금지
    beginDrag(editor, tablePath, tkey, r, c, e.clientX, e.clientY);
  };

  const onEnter = () => hoverCell(tkey, r, c);

  const onCtx: React.MouseEventHandler<HTMLTableCellElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('editor:table-menu', {
        detail: { x: e.clientX, y: e.clientY, cellPath: path },
      }),
    );
  };

  return (
    <td
      {...attributes}
      data-tkey={tkey}
      data-r={r}
      data-c={c}
      colSpan={colSpan}
      rowSpan={rowSpan}
      onMouseDown={onDown}
      onMouseEnter={onEnter}
      onContextMenu={onCtx}
      onDragStart={(e) => e.preventDefault()} // 네이티브 HTML drag 이미지 방지
      draggable={false}
      className="slate-table__cell"
      style={{
        border: '1px solid #e5e7eb',
        background: '#ffffff',
        padding: '4px 6px',
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  );
}

export default TableElementRenderer;