import React from 'react';
import type { WikiRenderMode } from '../types';

type DividerBlockProps = {
  mode: WikiRenderMode;
  styleType?: string | null;
  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
};

function normalizeDividerStyle(styleType?: string | null) {
  return String(styleType || 'default').trim().toLowerCase();
}

function HiddenChildren({
  mode,
  children,
}: {
  mode: WikiRenderMode;
  children?: React.ReactNode;
}) {
  if (mode !== 'edit') return null;

  return (
    <span style={{ display: 'none' }}>
      {children}
    </span>
  );
}

export default function DividerBlock({
  mode,
  styleType,
  attributes,
  children,
}: DividerBlockProps) {
  const style = normalizeDividerStyle(styleType);
  const borderColor = 'var(--border-strong)';

  const commonClassName = [
    'wiki-divider',
    `wiki-divider-${style}`,
    mode === 'edit' ? 'wiki-divider-edit' : 'wiki-divider-read',
    attributes?.className || '',
  ]
    .filter(Boolean)
    .join(' ');

  const wrapperBase: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    userSelect: 'none',
    ...(attributes?.style || {}),
  };

  switch (style) {
    case 'bold':
      return (
        <div
          {...attributes}
          contentEditable={false}
          suppressContentEditableWarning
          className={commonClassName}
          style={{
            ...wrapperBase,
            margin: '28px 0',
          }}
        >
          <div
            style={{
              width: '100%',
              height: 0,
              borderTop: `2px solid ${borderColor}`,
            }}
          />
          <HiddenChildren mode={mode}>{children}</HiddenChildren>
        </div>
      );

    case 'shortbold':
      return (
        <div
          {...attributes}
          contentEditable={false}
          suppressContentEditableWarning
          className={commonClassName}
          style={{
            ...wrapperBase,
            margin: '24px 0',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '42%',
              height: 0,
              borderTop: `2px solid ${borderColor}`,
            }}
          />
          <HiddenChildren mode={mode}>{children}</HiddenChildren>
        </div>
      );

    case 'dotted':
      return (
        <div
          {...attributes}
          contentEditable={false}
          suppressContentEditableWarning
          className={commonClassName}
          style={{
            ...wrapperBase,
            margin: '26px 0',
          }}
        >
          <div
            style={{
              width: '100%',
              height: 0,
              borderTop: `2px dotted ${borderColor}`,
            }}
          />
          <HiddenChildren mode={mode}>{children}</HiddenChildren>
        </div>
      );

    case 'diamond':
      return (
        <div
          {...attributes}
          contentEditable={false}
          suppressContentEditableWarning
          className={commonClassName}
          style={{
            ...wrapperBase,
            margin: '24px 0',
            textAlign: 'center',
            color: borderColor,
            fontWeight: 700,
            fontSize: 18,
            lineHeight: 1,
            letterSpacing: '0.12em',
            whiteSpace: 'nowrap',
          }}
        >
          ◇───◇
          <HiddenChildren mode={mode}>{children}</HiddenChildren>
        </div>
      );

    case 'diamonddot':
      return (
        <div
          {...attributes}
          contentEditable={false}
          suppressContentEditableWarning
          className={commonClassName}
          style={{
            ...wrapperBase,
            margin: '24px 0',
            textAlign: 'center',
            color: borderColor,
            fontWeight: 700,
            fontSize: 18,
            lineHeight: 1,
            letterSpacing: '0.12em',
            whiteSpace: 'nowrap',
          }}
        >
          ◇ ⋅ ⋅ ⋅ ◇
          <HiddenChildren mode={mode}>{children}</HiddenChildren>
        </div>
      );

    case 'dotdot':
      return (
        <div
          {...attributes}
          contentEditable={false}
          suppressContentEditableWarning
          className={commonClassName}
          style={{
            ...wrapperBase,
            margin: '24px 0',
            textAlign: 'center',
            color: borderColor,
            fontWeight: 700,
            fontSize: 18,
            lineHeight: 1,
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}
        >
          • • • • • • •
          <HiddenChildren mode={mode}>{children}</HiddenChildren>
        </div>
      );

    case 'slash':
      return (
        <div
          {...attributes}
          contentEditable={false}
          suppressContentEditableWarning
          className={commonClassName}
          style={{
            ...wrapperBase,
            margin: '24px 0',
            textAlign: 'center',
            color: borderColor,
            fontWeight: 700,
            fontSize: 18,
            lineHeight: 1,
            letterSpacing: '0.24em',
            whiteSpace: 'nowrap',
          }}
        >
          / / /
          <HiddenChildren mode={mode}>{children}</HiddenChildren>
        </div>
      );

    case 'bar':
      return (
        <div
          {...attributes}
          contentEditable={false}
          suppressContentEditableWarning
          className={commonClassName}
          style={{
            ...wrapperBase,
            margin: '24px 0',
            textAlign: 'center',
            color: borderColor,
            fontWeight: 700,
            fontSize: 20,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          |
          <HiddenChildren mode={mode}>{children}</HiddenChildren>
        </div>
      );

    case 'default':
    default:
      return (
        <div
          {...attributes}
          contentEditable={false}
          suppressContentEditableWarning
          className={commonClassName}
          style={{
            ...wrapperBase,
            margin: '28px 0',
          }}
        >
          <div
            style={{
              width: '100%',
              height: 0,
              borderTop: `1px solid ${borderColor}`,
            }}
          />
          <HiddenChildren mode={mode}>{children}</HiddenChildren>
        </div>
      );
  }
}