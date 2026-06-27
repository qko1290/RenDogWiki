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

function getDividerText(styleType: string) {
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

function getDividerStyle(styleType: string): React.CSSProperties {
  const base: React.CSSProperties = {
    width: '100%',
    textAlign: 'center',
    color: 'var(--border-strong)',
    userSelect: 'none',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
  };

  switch (styleType) {
    case 'bold':
      return {
        ...base,
        margin: '24px 0',
        fontSize: 24,
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: '0.22em',
      };

    case 'shortbold':
      return {
        ...base,
        margin: '18px 0',
        fontSize: 20,
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: '0.14em',
      };

    case 'dotted':
      return {
        ...base,
        margin: '20px 0',
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '0.34em',
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
  const normalized = normalizeDividerStyle(styleType);
  const text = getDividerText(normalized);
  const dividerStyle = getDividerStyle(normalized);

  return (
    <div
      {...attributes}
      contentEditable={false}
      suppressContentEditableWarning
      className={[
        'wiki-divider',
        `wiki-divider-${normalized}`,
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
      {text}

      {mode === 'edit' ? (
        <span style={{ display: 'none' }}>
          {children}
        </span>
      ) : null}
    </div>
  );
}