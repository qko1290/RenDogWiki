import React from 'react';
import type { WikiRenderMode } from '../types';

type DividerStyle =
  | 'default'
  | 'bold'
  | 'shortbold'
  | 'dotted'
  | 'diamond'
  | 'diamonddot'
  | 'dotdot'
  | 'slash'
  | 'bar';

type DividerBlockProps = {
  mode: WikiRenderMode;
  styleType?: DividerStyle | string | null;
  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
};

function getDividerContent(styleType?: string | null) {
  switch (styleType) {
    case 'diamond':
      return '◇───◇';
    case 'diamonddot':
      return '◇ ⋅ ⋅ ⋅ ◇';
    case 'dotdot':
      return '• • • • • • •';
    case 'slash':
      return '/ / /';
    case 'bar':
      return '|';
    case 'bold':
    case 'shortbold':
    case 'dotted':
    case 'default':
    default:
      return '* * *';
  }
}

function getDividerStyle(styleType?: string | null): React.CSSProperties {
  const borderColor = 'var(--border-strong)';

  const base: React.CSSProperties = {
    width: '100%',
    textAlign: 'center',
    color: borderColor,
    userSelect: 'none',
    boxSizing: 'border-box',
  };

  switch (styleType) {
    case 'bold':
      return {
        ...base,
        margin: '22px 0',
        fontSize: 22,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: '0.2em',
      };

    case 'shortbold':
      return {
        ...base,
        margin: '14px 0',
        fontSize: 18,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: '0.12em',
      };

    case 'dotted':
      return {
        ...base,
        margin: '20px 0',
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '0.35em',
      };

    case 'diamond':
      return {
        ...base,
        margin: '22px 0',
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '0.12em',
      };

    case 'diamonddot':
      return {
        ...base,
        margin: '22px 0',
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '0.12em',
      };

    case 'dotdot':
      return {
        ...base,
        margin: '20px 0',
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '0.1em',
      };

    case 'slash':
      return {
        ...base,
        margin: '20px 0',
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '0.25em',
      };

    case 'bar':
      return {
        ...base,
        margin: '18px 0',
        fontSize: 22,
        fontWeight: 700,
        lineHeight: 1,
      };

    case 'default':
    default:
      return {
        ...base,
        margin: '18px 0',
        fontSize: 18,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: '0.16em',
      };
  }
}

export default function DividerBlock({
  mode,
  styleType,
  attributes,
  children,
}: DividerBlockProps) {
  const content = getDividerContent(styleType);
  const dividerStyle = getDividerStyle(styleType);

  return (
    <div
      {...attributes}
      contentEditable={false}
      suppressContentEditableWarning
      className={[
        'wiki-divider',
        `wiki-divider-${styleType || 'default'}`,
        mode === 'edit' ? 'wiki-divider-edit' : 'wiki-divider-read',
        attributes?.className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...dividerStyle,
        ...(attributes?.style || {}),
      }}
    >
      {content}

      {mode === 'edit' ? (
        <span
          style={{
            display: 'none',
          }}
        >
          {children}
        </span>
      ) : null}
    </div>
  );
}