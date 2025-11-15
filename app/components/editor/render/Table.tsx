// components/editor/render/Table.tsx
import React from 'react';
import type { RenderElementProps } from 'slate-react';
import type { TableElement } from '@/types/slate';

// Element.tsx 에서 사용하는 props 구조에 맞춘 타입들
export type TableElementRendererProps = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: TableElement;
  editor: any;
};

export type TableRowRendererProps = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
};

export type TableCellRendererProps = {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  editor: any;
};

// -------------------- table --------------------

export const TableElementRenderer: React.FC<TableElementRendererProps> = ({
  attributes,
  children,
}) => {
  // 기본 스타일만 부여 (스크롤 + 최소 테이블 스타일)
  return (
    <div
      {...attributes}
      style={{
        overflowX: 'auto',
        margin: '12px 0',
      }}
    >
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
        }}
      >
        <tbody>{children}</tbody>
      </table>
    </div>
  );
};

// -------------------- tr --------------------

export const TableRowRenderer: React.FC<TableRowRendererProps> = ({
  attributes,
  children,
}) => {
  return <tr {...attributes}>{children}</tr>;
};

// -------------------- td --------------------

export const TableCellRenderer: React.FC<TableCellRendererProps> = ({
  attributes,
  children,
}) => {
  return (
    <td
      {...attributes}
      style={{
        border: '1px solid #e2e8f0',
        padding: '6px 8px',
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  );
};

export default TableElementRenderer;
