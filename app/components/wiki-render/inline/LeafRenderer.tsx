import React from 'react';

type LeafEnv = {
  isMobile?: boolean;
  isDarkMode?: boolean;
  inDarkTableCell?: boolean;
  inTableCell?: boolean;
};

type LeafRendererProps = {
  mode: 'read' | 'edit';
  leaf: any;
  children?: React.ReactNode;
  env?: LeafEnv;
  attributes?: React.HTMLAttributes<HTMLSpanElement>;

  /**
   * read 렌더러는 기존 WikiReadRenderer처럼 기본 폰트 패밀리를 명시하고,
   * editor 렌더러는 기존 Leaf.tsx처럼 fontFamily가 있을 때만 적용한다.
   */
  useDefaultFontFamily?: boolean;
};

function normalizeFontSize(v: unknown): string | number | undefined {
  if (v == null) return undefined;

  if (typeof v === 'number') {
    return Math.max(1, v);
  }

  if (typeof v === 'string') {
    const s = v.trim();

    if (!s) return undefined;
    if (/(px|rem|em|%|vh|vw)$/i.test(s)) return s;
    if (/^\d+(\.\d+)?$/.test(s)) return `${s}px`;

    return s;
  }

  return undefined;
}

function toPxNumber(v: string | number | undefined): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return v;

  const m = /^(-?\d+(?:\.\d+)?)px$/i.exec(v);

  return m ? parseFloat(m[1]) : undefined;
}

const HANDWRITING_SCALE: Record<string, number> = {
  BareunHippy: 1.18,
  NanumHandwritingMiddleSchool: 1.14,
};

export default function LeafRenderer({
  mode,
  leaf,
  children,
  env,
  attributes,
  useDefaultFontFamily,
}: LeafRendererProps) {
  let renderedChildren = children ?? String(leaf?.text ?? '');

  if (leaf?.bold) {
    renderedChildren = <strong>{renderedChildren}</strong>;
  }

  if (leaf?.italic) {
    renderedChildren = <em>{renderedChildren}</em>;
  }

  if (leaf?.underline) {
    renderedChildren = <u>{renderedChildren}</u>;
  }

  if (leaf?.strikethrough) {
    renderedChildren = <s>{renderedChildren}</s>;
  }

  const style: React.CSSProperties & Record<string, string | number> = {};

  if (leaf?.color) {
    style.color = String(leaf.color);
  }

  const shouldIgnoreBgInDarkTable =
    env?.isDarkMode && env?.inDarkTableCell;

  if (!shouldIgnoreBgInDarkTable && leaf?.backgroundColor) {
    style.backgroundColor = String(leaf.backgroundColor);
  }

  const rawFamily = leaf?.fontFamily;
  const hasFamily = typeof rawFamily === 'string' && rawFamily.trim();

  const shouldApplyDefaultFamily =
    useDefaultFontFamily ?? mode === 'read';

  let familyKey: string | undefined;

  if (hasFamily) {
    familyKey = String(rawFamily).trim();
    style.fontFamily = familyKey;
  } else if (shouldApplyDefaultFamily) {
    familyKey = 'NanumSquareRound';
    style.fontFamily =
      "'NanumSquareRound', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
  }

  const hasCustomFontSize =
    leaf?.fontSize != null && String(leaf.fontSize).trim() !== '';

  const normalized = normalizeFontSize(leaf?.fontSize);
  const basePx = toPxNumber(normalized);
  const scale = familyKey ? HANDWRITING_SCALE[familyKey] ?? 1 : 1;

  let finalFontPx: number | undefined;

  if (scale !== 1) {
    if (typeof basePx === 'number') {
      finalFontPx = Math.round(basePx * scale);
      style.fontSize = `${finalFontPx}px`;
    } else if (normalized !== undefined) {
      style.fontSize = normalized;
    } else {
      style.fontSize = `${scale}em`;
    }

    style.lineHeight = style.lineHeight ?? 1.35;
  } else if (normalized !== undefined) {
    style.fontSize = normalized;

    if (typeof basePx === 'number') {
      finalFontPx = basePx;
    }
  }

  const extraProps: Record<string, string> = {};

  if (hasCustomFontSize) {
    extraProps['data-wiki-inline-font'] = 'custom';

    if (typeof finalFontPx === 'number' && Number.isFinite(finalFontPx)) {
      style['--wiki-inline-font-px'] = finalFontPx;
    }
  }

  return (
    <span
      {...attributes}
      {...extraProps}
      data-wiki-leaf="true"
      data-wiki-mode={mode}
      style={{
        ...style,
        ...(attributes?.style ?? {}),
      }}
    >
      {renderedChildren}
    </span>
  );
}