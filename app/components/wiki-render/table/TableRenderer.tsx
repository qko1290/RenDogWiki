import React from 'react';

import {
  tableCellBaseStyle,
  tableElementBaseStyle,
} from './tableLayout';

import type {
  WikiTableCellRendererProps,
  WikiTableRendererProps,
  WikiTableRowRendererProps,
} from './types';

function mergeClassName(...names: Array<string | undefined | null | false>) {
  return names.filter(Boolean).join(' ') || undefined;
}

export function WikiTableRenderer({
  mode,
  attributes,
  children,
  containerRef,
  className,
  style,
  table,
  tableClassName,
  tableStyle,
  overlay,
  editControls,
  readControls,
  afterContent,
  scrollable = false,
  tableInnerStyle,
  onMouseMoveCapture,
  onMouseDownCapture,
  onMouseUpCapture,
}: WikiTableRendererProps) {
  const controls = mode === 'edit' ? editControls : readControls;
  const attrStyle = attributes?.style;

  const tableNode =
    table ?? (
      <table
        className={tableClassName}
        onDragStart={(e) => e.preventDefault()}
        style={{
          ...tableElementBaseStyle,
          ...tableStyle,
        }}
      >
        <tbody>{children}</tbody>
      </table>
    );

  const content = (
    <>
      {tableNode}
      {overlay}
      {controls}
      {afterContent}
    </>
  );

  return (
    <div
      {...attributes}
      ref={containerRef}
      data-wiki-block="table"
      data-wiki-mode={mode}
      className={mergeClassName(attributes?.className, className)}
      onMouseMoveCapture={onMouseMoveCapture}
      onMouseDownCapture={onMouseDownCapture}
      onMouseUpCapture={onMouseUpCapture}
      style={{
        ...style,
        ...attrStyle,
      }}
    >
      {scrollable ? (
        <div
          style={{
            overflowX: 'auto',
            maxWidth: '100%',
            ...tableInnerStyle,
          }}
        >
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
}

export function WikiTableRowRenderer({
  attributes,
  children,
}: WikiTableRowRendererProps) {
  return <tr {...attributes}>{children}</tr>;
}

export function WikiTableCellRenderer({
  mode,
  attributes,
  children,
  colSpan = 1,
  rowSpan = 1,
  className,
  style,
  dataAttributes,
  onMouseDown,
  onMouseEnter,
  onContextMenu,
}: WikiTableCellRendererProps) {
  return (
    <td
      {...attributes}
      {...dataAttributes}
      colSpan={colSpan}
      rowSpan={rowSpan}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onContextMenu={onContextMenu}
      onDragStart={(e) => e.preventDefault()}
      draggable={false}
      className={mergeClassName(attributes?.className, className)}
      data-wiki-mode={mode}
      style={{
        ...tableCellBaseStyle,
        ...style,
        ...(attributes?.style ?? {}),
      }}
    >
      {children}
    </td>
  );
}

export default WikiTableRenderer;