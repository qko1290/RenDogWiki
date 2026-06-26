import React from 'react';
import type { WikiRenderMode } from '../types';

type ParagraphBlockProps = {
  mode: WikiRenderMode;
  textAlign?: string | null;
  indentLine?: boolean;
  indentClassName?: string;
  plainText?: string;
  isMobileTableText?: boolean;
  attributes?: React.HTMLAttributes<HTMLParagraphElement>;
  children?: React.ReactNode;
};

function autoFont(
  base: number,
  text: string,
  rules: Array<[number, number]>
) {
  const len = String(text ?? '').length;

  for (const [limit, size] of rules) {
    if (len <= limit) return size;
  }

  return rules.length > 0 ? rules[rules.length - 1][1] : base;
}

export default function ParagraphBlock({
  mode,
  textAlign,
  indentLine,
  indentClassName,
  plainText = '',
  isMobileTableText = false,
  attributes,
  children,
}: ParagraphBlockProps) {
  if (mode === 'edit') {
    const className = [
      'wiki-paragraph',
      indentLine ? 'indent-line' : '',
      indentClassName || '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <p
        {...attributes}
        className={className}
        style={{
          textAlign: (textAlign as React.CSSProperties['textAlign']) || 'left',
        }}
      >
        {children}
      </p>
    );
  }

  const cleanedText = String(plainText ?? '').replace(/\u200B/g, '').trim();
  const isEmpty = cleanedText.length === 0;
  const baseFont = isMobileTableText ? 13 : 19;

  const paragraphFontPx = isMobileTableText
    ? 13
    : isEmpty
      ? baseFont
      : autoFont(baseFont, cleanedText, [
          [40, baseFont],
          [80, baseFont - 1],
          [120, baseFont - 2],
          [170, baseFont - 3],
          [230, baseFont - 4],
          [320, baseFont - 5],
          [450, baseFont - 6],
        ]);

  const style: React.CSSProperties = {
    textAlign: (textAlign as React.CSSProperties['textAlign']) || 'left',
    margin: 0,
    lineHeight: isMobileTableText ? 1.45 : 1.6,
    minHeight: isEmpty ? (isMobileTableText ? '1.45em' : '1.6em') : undefined,
    fontSize: `${paragraphFontPx}px`,
    whiteSpace: 'pre-wrap',
    color: 'var(--foreground)',
  };

  if (indentLine) {
    style.borderLeft = '2px solid var(--border-strong)';
    style.paddingLeft = 16;
  }

  return <p style={style}>{children}</p>;
}