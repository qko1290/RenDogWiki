import React from 'react';
import type { WikiRenderMode } from '../types';

type TableBlockProps = {
  mode: WikiRenderMode;

  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  containerRef?: React.Ref<HTMLDivElement>;
  containerStyle?: React.CSSProperties;

  onMouseMoveCapture?: React.MouseEventHandler<HTMLDivElement>;
  onMouseDownCapture?: React.MouseEventHandler<HTMLDivElement>;
  onMouseUpCapture?: React.MouseEventHandler<HTMLDivElement>;

  table: React.ReactNode;
  overlay?: React.ReactNode;

  editControls?: React.ReactNode;
  readControls?: React.ReactNode;

  scrollable?: boolean;
  compact?: boolean;
  tableInnerStyle?: React.CSSProperties;
};

export default function TableBlock({
  mode,
  attributes,
  children,
  containerRef,
  containerStyle,
  onMouseMoveCapture,
  onMouseDownCapture,
  onMouseUpCapture,
  table,
  overlay,
  editControls,
  readControls,
}: TableBlockProps) {
  const controls = mode === 'edit' ? editControls : readControls;

  return (
    <div
      {...attributes}
      ref={containerRef}
      className={[
        mode === 'edit' ? 'wiki-table-edit' : 'wiki-table-read',
        attributes?.className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...(containerStyle || {}),
        ...(attributes?.style || {}),
      }}
      onMouseMoveCapture={onMouseMoveCapture}
      onMouseDownCapture={onMouseDownCapture}
      onMouseUpCapture={onMouseUpCapture}
    >
      {table}
      {overlay}
      {controls}
      {mode === 'edit' ? children : null}
    </div>
  );
}