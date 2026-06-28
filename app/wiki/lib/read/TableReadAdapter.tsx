'use client';

import React from 'react';

import TableBlock from '@/components/wiki-render/blocks/TableBlock';
import {
  WikiTableCellRenderer,
  WikiTableRowRenderer,
} from '@/components/wiki-render/table/TableRenderer';
import { tableElementBaseStyle } from '@/components/wiki-render/table/tableLayout';

import { flexJustifyFromAlign } from '../readRendererUtils';

type ReadRenderEnv = {
  isMobile?: boolean;
  isDarkMode?: boolean;
  inDarkTableCell?: boolean;
  inTableCell?: boolean;
  inLinkBlockRow?: boolean;
  onWikiNavigate?: (href: string) => void;
};

type RenderNodeFn = (
  node: any,
  key?: React.Key,
  ctx?: any,
  handlers?: any,
  env?: ReadRenderEnv,
) => React.ReactNode;

type TableReadAdapterProps = {
  node: any;
  children: React.ReactNode;
};

export function TableReadAdapter({
  node,
  children,
}: TableReadAdapterProps) {
  const align = node.align || 'left';
  const justify = flexJustifyFromAlign(align);

  const widthPx =
    typeof node.maxWidth === 'number'
      ? node.maxWidth
      : typeof node.maxWidth === 'string' && Number.isFinite(Number(node.maxWidth))
        ? Number(node.maxWidth)
        : undefined;

  const tableWidth = widthPx
    ? `${widthPx}px`
    : node.fullWidth
      ? '100%'
      : 'auto';

  const tableNode = (
    <table
      style={{
        ...tableElementBaseStyle,
      }}
    >
      <tbody>{children}</tbody>
    </table>
  );

  return (
    <TableBlock
      mode="read"
      table={tableNode}
      containerStyle={{
        display: 'flex',
        justifyContent: justify,
        overflowX: 'auto',
        margin: '16px 0',
      }}
      tableInnerStyle={{
        width: tableWidth,
        maxWidth: '100%',
      }}
    />
  );
}

type TableRowReadAdapterProps = {
  children: React.ReactNode;
};

export function TableRowReadAdapter({
  children,
}: TableRowReadAdapterProps) {
  return (
    <WikiTableRowRenderer>
      {children}
    </WikiTableRowRenderer>
  );
}

type TableCellReadAdapterProps = {
  node: any;
  keyProp?: React.Key;
  ctx?: any;
  handlers?: any;
  env?: ReadRenderEnv;
  renderNode: RenderNodeFn;
};

export function TableCellReadAdapter({
  node,
  keyProp,
  ctx,
  handlers,
  env,
  renderNode,
}: TableCellReadAdapterProps) {
  const colSpan = Math.max(1, Number(node.colspan) || 1);
  const rowSpan = Math.max(1, Number(node.rowspan) || 1);

  const customCellBg =
    typeof node.backgroundColor === 'string' && node.backgroundColor.trim()
      ? node.backgroundColor
      : typeof node.bgColor === 'string' && node.bgColor.trim()
        ? node.bgColor
        : undefined;

  const resolvedCellBg = env?.isDarkMode
    ? 'var(--surface-elevated)'
    : customCellBg || 'var(--surface-elevated)';

  const cellChildren = node.children?.map((child: any, index: number) =>
    renderNode(
      child,
      keyProp ? `${keyProp}-${index}` : index,
      ctx,
      handlers,
      {
        ...env,
        inDarkTableCell: !!env?.isDarkMode,
        inTableCell: true,
      },
    ),
  );

  return (
    <WikiTableCellRenderer
      mode="read"
      colSpan={colSpan}
      rowSpan={rowSpan}
      style={{
        border: '1px solid var(--border)',
        padding: '6px 8px',
        verticalAlign: 'top',
        background: resolvedCellBg,
        color: 'var(--foreground)',
      }}
    >
      {cellChildren}
    </WikiTableCellRenderer>
  );
}