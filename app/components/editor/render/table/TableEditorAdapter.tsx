'use client';

import React from 'react';
import { Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import type { RenderElementProps } from 'slate-react';

import type { TableElement } from '@/types/slate';

import TableBlock from '@/components/wiki-render/blocks/TableBlock';
import {
  WikiTableCellRenderer,
  WikiTableRowRenderer,
} from '@/components/wiki-render/table/TableRenderer';
import {
  getTableContainerStyle,
  tableElementBaseStyle,
} from '@/components/wiki-render/table/tableLayout';

import {
  tablePathKey,
  useDragRect,
  beginDrag,
  hoverCell,
} from '../../helpers/tableDrag';

export function TableEditorAdapter(
  props: RenderElementProps & { editor: any },
) {
  const { attributes, children, element, editor } = props;
  const table = element as TableElement;
  const tablePath = ReactEditor.findPath(editor, element);
  const tkey = tablePathKey(tablePath);
  const rect = useDragRect(tkey);

  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const ovRef = React.useRef<HTMLDivElement | null>(null);

  const widthFromNode =
    typeof table.maxWidth === 'number' ? table.maxWidth : null;

  const [liveWidth, setLiveWidth] = React.useState<number | null>(
    widthFromNode,
  );

  React.useEffect(() => {
    setLiveWidth(widthFromNode);
  }, [widthFromNode]);

  const positionOverlay = React.useCallback(() => {
    const wrap = wrapRef.current;
    const ov = ovRef.current;

    if (!wrap || !ov || !rect) {
      if (ov) ov.style.display = 'none';
      return;
    }

    const queryCell = (row: number, column: number) =>
      wrap.querySelector(
        `td.slate-table__cell[data-tkey="${tkey}"][data-r="${row}"][data-c="${column}"]`,
      ) as HTMLElement | null;

    const firstCell = queryCell(rect.r0, rect.c0);
    const lastCell = queryCell(rect.r1, rect.c1);

    if (!firstCell || !lastCell) {
      ov.style.display = 'none';
      return;
    }

    const firstRect = firstCell.getBoundingClientRect();
    const lastRect = lastCell.getBoundingClientRect();
    const baseRect = wrap.getBoundingClientRect();

    const left = Math.round(firstRect.left - baseRect.left);
    const top = Math.round(firstRect.top - baseRect.top);
    const right = Math.round(lastRect.right - baseRect.left);
    const bottom = Math.round(lastRect.bottom - baseRect.top);

    ov.style.display = 'block';
    ov.style.left = `${left}px`;
    ov.style.top = `${top}px`;
    ov.style.width = `${Math.max(0, right - left - 1)}px`;
    ov.style.height = `${Math.max(0, bottom - top - 1)}px`;
  }, [rect, tkey]);

  React.useLayoutEffect(() => {
    positionOverlay();
  }, [positionOverlay]);

  React.useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const resizeObserver = new ResizeObserver(() => positionOverlay());
    resizeObserver.observe(wrap);

    return () => resizeObserver.disconnect();
  }, [positionOverlay]);

  const onResizeMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const wrap = wrapRef.current;
    if (!wrap) return;

    const startX = event.clientX;
    const wrapRect = wrap.getBoundingClientRect();
    const startWidth = liveWidth ?? wrapRect.width;
    const parentRect = wrap.parentElement?.getBoundingClientRect();
    const containerWidth = parentRect?.width ?? window.innerWidth;

    const minWidth = 400;
    const maxWidth = Math.max(minWidth, containerWidth - 16);

    let latestWidth = startWidth;

    const onMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();

      const deltaX = moveEvent.clientX - startX;
      let nextWidth = startWidth + deltaX;

      if (!Number.isFinite(nextWidth)) {
        nextWidth = startWidth;
      }

      nextWidth = Math.max(minWidth, Math.min(nextWidth, maxWidth));
      latestWidth = nextWidth;
      setLiveWidth(nextWidth);
    };

    const onUp = (upEvent: MouseEvent) => {
      upEvent.preventDefault();

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      if (!Number.isFinite(latestWidth)) return;

      const fullWidthThreshold = containerWidth - 12;

      if (latestWidth >= fullWidthThreshold) {
        Transforms.setNodes<TableElement>(
          editor,
          {
            maxWidth: null,
            fullWidth: true,
          } as Partial<TableElement>,
          { at: tablePath },
        );
        return;
      }

      Transforms.setNodes<TableElement>(
        editor,
        {
          maxWidth: Math.round(latestWidth),
          fullWidth: false,
        } as Partial<TableElement>,
        { at: tablePath },
      );
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const mergedRef = React.useCallback(
    (elementNode: HTMLDivElement | null) => {
      wrapRef.current = elementNode;

      const attributeRef = (attributes as any).ref;

      if (typeof attributeRef === 'function') {
        attributeRef(elementNode);
      } else if (attributeRef && typeof attributeRef === 'object') {
        (
          attributeRef as {
            current: HTMLDivElement | null;
          }
        ).current = elementNode;
      }
    },
    [attributes],
  );

  const overlayNode = (
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
  );

  const resizeHandle = (
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
  );

  const tableNode = (
    <table
      className="slate-table"
      onDragStart={(event) => event.preventDefault()}
      style={tableElementBaseStyle}
    >
      <tbody>{children}</tbody>
    </table>
  );

  return (
    <TableBlock
      mode="edit"
      attributes={
        {
          ...attributes,
          'data-tkey': tkey,
        } as React.HTMLAttributes<HTMLDivElement>
      }
      containerRef={mergedRef}
      containerStyle={getTableContainerStyle({
        liveWidth: liveWidth ?? widthFromNode,
        maxWidth: widthFromNode,
        fullWidth: table.fullWidth,
        align: table.align,
      })}
      table={tableNode}
      overlay={overlayNode}
      editControls={resizeHandle}
    />
  );
}

export function TableRowEditorAdapter(props: RenderElementProps) {
  const { attributes, children } = props;

  return (
    <WikiTableRowRenderer attributes={attributes}>
      {children}
    </WikiTableRowRenderer>
  );
}

export function TableCellEditorAdapter(
  props: RenderElementProps & { editor: any },
) {
  const { attributes, children, element, editor } = props;
  const cell = element as any;

  const colSpan = Math.max(1, Number(cell.colspan) || 1);
  const rowSpan = Math.max(1, Number(cell.rowspan) || 1);

  const path = ReactEditor.findPath(editor, element);
  const tablePath = path.slice(0, -2);
  const tkey = tablePathKey(tablePath);
  const row = path[path.length - 2] as number;
  const column = path[path.length - 1] as number;

  const onMouseDown: React.MouseEventHandler<HTMLTableCellElement> = (
    event,
  ) => {
    if (event.button !== 0 || !event.shiftKey) return;

    event.preventDefault();
    event.stopPropagation();

    beginDrag(
      editor,
      tablePath,
      tkey,
      row,
      column,
      event.clientX,
      event.clientY,
    );
  };

  const onMouseEnter = () => {
    hoverCell(tkey, row, column);
  };

  const onContextMenu: React.MouseEventHandler<HTMLTableCellElement> = (
    event,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    window.dispatchEvent(
      new CustomEvent('editor:table-menu', {
        detail: {
          x: event.clientX,
          y: event.clientY,
          cellPath: path,
        },
      }),
    );
  };

  return (
    <WikiTableCellRenderer
      mode="edit"
      attributes={
        attributes as React.TdHTMLAttributes<HTMLTableCellElement>
      }
      dataAttributes={{
        'data-tkey': tkey,
        'data-r': row,
        'data-c': column,
      }}
      colSpan={colSpan}
      rowSpan={rowSpan}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onContextMenu={onContextMenu}
      className="slate-table__cell"
    >
      {children}
    </WikiTableCellRenderer>
  );
}

export default TableEditorAdapter;