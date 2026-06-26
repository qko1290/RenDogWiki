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

export default function DividerBlock({
  mode,
  styleType,
  attributes,
  children,
}: DividerBlockProps) {
  const resolvedStyle = styleType || 'default';

  const commonStyle: React.CSSProperties = {
    textAlign: 'center',
    color: 'var(--border-strong)',
    margin: '18px 0',
    userSelect: mode === 'edit' ? 'none' : undefined,
  };

  let content: React.ReactNode = '* * *';
  let style: React.CSSProperties = commonStyle;

  switch (resolvedStyle) {
    case 'bold':
      content = '* * *';
      style = {
        ...commonStyle,
        fontWeight: 800,
        letterSpacing: '0.2em',
      };
      break;

    case 'shortbold':
      content = '* * *';
      style = {
        ...commonStyle,
        fontWeight: 800,
        letterSpacing: '0.12em',
        margin: '12px 0',
      };
      break;

    case 'dotted':
      content = '* * *';
      style = {
        ...commonStyle,
        letterSpacing: '0.35em',
      };
      break;

    case 'diamond':
      content = '◇───◇';
      style = {
        ...commonStyle,
        letterSpacing: '0.12em',
      };
      break;

    case 'diamonddot':
      content = '◇ ⋅ ⋅ ⋅ ◇';
      style = {
        ...commonStyle,
        letterSpacing: '0.12em',
      };
      break;

    case 'dotdot':
      content = '• • • • • • •';
      style = {
        ...commonStyle,
        letterSpacing: '0.1em',
      };
      break;

    case 'slash':
      content = '/ / /';
      style = {
        ...commonStyle,
        letterSpacing: '0.25em',
      };
      break;

    case 'bar':
      content = '|';
      style = {
        ...commonStyle,
        fontWeight: 700,
      };
      break;

    case 'default':
    default:
      content = '* * *';
      break;
  }

  return (
    <div
      {...attributes}
      className={`wiki-divider wiki-divider-${resolvedStyle}`}
      style={style}
      contentEditable={mode === 'edit' ? false : undefined}
      suppressContentEditableWarning
    >
      {content}
      {mode === 'edit' ? children : null}
    </div>
  );
}