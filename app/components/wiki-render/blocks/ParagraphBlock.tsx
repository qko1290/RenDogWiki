import React from 'react';
import type { WikiRenderMode } from '../types';

type ParagraphBlockProps = {
  mode: WikiRenderMode;
  textAlign?: string | null;
  indentLine?: boolean;
  indentClassName?: string;
  attributes?: React.HTMLAttributes<HTMLParagraphElement>;
  children?: React.ReactNode;

  /**
   * WikiReadRenderer에서 이미 계산해서 넘기고 있으면 사용.
   * 없으면 children에서 최대한 텍스트를 추출해서 계산.
   */
  plainText?: string;
  isEmpty?: boolean;
  isMobileTableText?: boolean;
};

function textFromReact(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textFromReact).join('');
  }

  if (React.isValidElement(node)) {
    return textFromReact((node.props as any).children);
  }

  return '';
}

function autoFont(
  base: number,
  text: string,
  steps?: Array<[number, number]>
) {
  const len = Array.from(text ?? '').length;
  const rules: Array<[number, number]> =
    steps ??
    [
      [8, base],
      [12, base - 2],
      [16, base - 4],
      [22, base - 6],
      [30, base - 8],
      [40, base - 9],
    ];

  for (const [threshold, size] of rules) {
    if (len <= threshold) return size;
  }

  return Math.max(11, (rules.at(-1)?.[1] ?? base) - 2);
}

function normalizeTextAlign(
  textAlign?: string | null
): React.CSSProperties['textAlign'] {
  if (textAlign === 'center') return 'center';
  if (textAlign === 'right') return 'right';
  return 'left';
}

export default function ParagraphBlock({
  mode,
  textAlign,
  indentLine,
  indentClassName,
  attributes,
  children,
  plainText: plainTextProp,
  isEmpty: isEmptyProp,
  isMobileTableText,
}: ParagraphBlockProps) {
  const plainText = (plainTextProp ?? textFromReact(children))
    .replace(/\u200B/g, '')
    .trim();

  const isEmpty =
    typeof isEmptyProp === 'boolean' ? isEmptyProp : plainText.length === 0;

  const mobileTable = Boolean(isMobileTableText);
  const baseFont = mobileTable ? 13 : 19;

  const paragraphFontPx = mobileTable
    ? 13
    : isEmpty
      ? baseFont
      : autoFont(baseFont, plainText, [
          [40, baseFont],
          [80, baseFont - 1],
          [120, baseFont - 2],
          [170, baseFont - 3],
          [230, baseFont - 4],
          [320, baseFont - 5],
          [450, baseFont - 6],
        ]);

  const style: React.CSSProperties = {
    textAlign: normalizeTextAlign(textAlign),
    margin: 0,
    lineHeight: mobileTable ? 1.45 : 1.6,
    minHeight: isEmpty ? (mobileTable ? '1.45em' : '1.6em') : undefined,
    fontSize: `${paragraphFontPx}px`,
    whiteSpace: 'pre-wrap',
    color: 'var(--foreground)',
    ...(attributes?.style || {}),
  };

  if (indentLine) {
    style.borderLeft = '2px solid var(--border-strong)';
    style.paddingLeft = 16;
  }

  return (
    <p
      {...attributes}
      className={[attributes?.className || '', indentClassName || '']
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {children}
    </p>
  );
}