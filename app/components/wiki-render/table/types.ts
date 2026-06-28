import React from 'react';

export type WikiTableMode = 'read' | 'edit';

export type WikiTableAlign = 'left' | 'center' | 'right';

export type WikiTableContainerLayoutInput = {
  maxWidth?: number | null;
  liveWidth?: number | null;
  fullWidth?: boolean | null;
  align?: WikiTableAlign | string | null;
};

export type WikiTableRendererProps = {
  mode: WikiTableMode;
  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  containerRef?: React.Ref<HTMLDivElement>;
  className?: string;
  style?: React.CSSProperties;

  tableClassName?: string;
  tableStyle?: React.CSSProperties;

  overlay?: React.ReactNode;
  editControls?: React.ReactNode;
  readControls?: React.ReactNode;

  onMouseMoveCapture?: React.MouseEventHandler<HTMLDivElement>;
  onMouseDownCapture?: React.MouseEventHandler<HTMLDivElement>;
  onMouseUpCapture?: React.MouseEventHandler<HTMLDivElement>;
};

export type WikiTableRowRendererProps = {
  attributes?: React.HTMLAttributes<HTMLTableRowElement>;
  children?: React.ReactNode;
};

export type WikiTableCellRendererProps = {
  mode: WikiTableMode;
  attributes?: React.TdHTMLAttributes<HTMLTableCellElement>;
  children?: React.ReactNode;

  colSpan?: number;
  rowSpan?: number;

  className?: string;
  style?: React.CSSProperties;

  dataAttributes?: Record<string, string | number | undefined>;

  onMouseDown?: React.MouseEventHandler<HTMLTableCellElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLTableCellElement>;
  onContextMenu?: React.MouseEventHandler<HTMLTableCellElement>;
};