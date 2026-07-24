'use client';

import React from 'react';

import '../../../wiki/css/document-components/info-box.css';

import type { WikiRenderMode } from '../types';

type InfoBoxBlockProps = {
  mode: WikiRenderMode;
  tone?: string | null;
  noIcon?: boolean;
  plainText?: string | null;
  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
  editControls?: React.ReactNode;
  readControls?: React.ReactNode;
};

export type InfoBoxLegacyIndentRange = {
  start: number;
  end: number;
};

export type InfoBoxLegacyIndentChunkResult = {
  text: string;
  afterLineBreak: boolean;
  removals: InfoBoxLegacyIndentRange[];
};

const LEGACY_INDENT_CHARACTER = /[ \t\u00a0\u3000]/;
const LEGACY_SPECIAL_INDENT_CHARACTER = /[\t\u00a0\u3000]/;

function normalizeInfoBoxType(
  raw: string | null | undefined,
) {
  const value = String(raw || 'info')
    .toLowerCase()
    .trim();

  if (value === 'note') return 'info';
  if (value === 'warn') return 'warning';
  if (value === 'error') return 'danger';
  if (value === 'success') return 'tip';

  if (
    value === 'white' ||
    value === '하양' ||
    value === '흰색'
  ) {
    return 'white';
  }

  if (
    value === 'yellow' ||
    value === '노랑' ||
    value === '노란'
  ) {
    return 'yellow';
  }

  if (
    value === 'lime' ||
    value === 'green' ||
    value === 'lightgreen' ||
    value === 'mint' ||
    value === '연두'
  ) {
    return 'lime';
  }

  if (
    value === 'pink' ||
    value === 'lightpink' ||
    value === 'rose' ||
    value === '연분홍'
  ) {
    return 'pink';
  }

  if (
    value === 'red' ||
    value === 'crimson' ||
    value === '빨강' ||
    value === '빨간'
  ) {
    return 'red';
  }

  return value || 'info';
}

function getInfoBoxRole(
  type: string,
): 'note' | 'alert' {
  return type === 'danger' || type === 'red'
    ? 'alert'
    : 'note';
}

function infoBoxTypeHasIcon(type: string) {
  return (
    type === 'info' ||
    type === 'warning' ||
    type === 'danger' ||
    type === 'tip'
  );
}

/**
 * 첫 줄이 `라벨 : 내용` 형태일 때
 * 콜론 다음 한 칸까지를 들여쓰기 기준으로 반환한다.
 */
export function getInfoBoxAlignmentPrefix(
  rawText: string | null | undefined,
) {
  const text = String(rawText ?? '')
    .replace(/\u200b/g, '');

  const firstLine =
    text.split(/\r?\n/, 1)[0] ?? '';

  const match = firstLine.match(
    /^([^\n:]{1,24}:[ \t\u00a0\u3000]+)/,
  );

  if (!match) return null;

  return match[1].replace(
    /[ \t\u00a0\u3000]+$/,
    ' ',
  );
}

/**
 * Shift+Enter 뒤에 기존 수동 정렬용으로 넣었던 공백을 찾는다.
 *
 * 일반 공백 2칸 이상, 탭, NBSP, 전각 공백만 제거 대상으로 삼아
 * 의도적으로 넣은 한 칸 공백은 유지한다.
 */
export function processInfoBoxLegacyIndentChunk(
  source: string,
  startsAfterLineBreak = false,
): InfoBoxLegacyIndentChunkResult {
  let index = 0;
  let afterLineBreak = startsAfterLineBreak;
  let output = '';

  const removals: InfoBoxLegacyIndentRange[] = [];

  while (index < source.length) {
    if (afterLineBreak) {
      let indentEnd = index;

      while (
        indentEnd < source.length &&
        LEGACY_INDENT_CHARACTER.test(
          source[indentEnd],
        )
      ) {
        indentEnd += 1;
      }

      const indent = source.slice(
        index,
        indentEnd,
      );

      const shouldRemove =
        indent.length >= 2 ||
        LEGACY_SPECIAL_INDENT_CHARACTER.test(
          indent,
        );

      if (shouldRemove) {
        removals.push({
          start: index,
          end: indentEnd,
        });

        index = indentEnd;

        if (index >= source.length) {
          return {
            text: output,
            afterLineBreak: true,
            removals,
          };
        }
      }

      afterLineBreak = false;
    }

    const character = source[index];

    output += character;
    index += 1;

    afterLineBreak = character === '\n';
  }

  return {
    text: output,
    afterLineBreak,
    removals,
  };
}

type InfoBoxIconPreset = {
  accent: string;
  mask: string;
};

type InfoBoxContentStyle =
  React.CSSProperties & {
    '--info-box-hanging-indent': string;
  };

function getInfoBoxIconPreset(
  type: string,
): InfoBoxIconPreset | null {
  const presets: Record<
    string,
    InfoBoxIconPreset
  > = {
    info: {
      accent: '#3b82f6',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-info.svg?v=2&token=a463935e93',
    },
    warning: {
      accent: '#f59e0b',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-exclamation.svg?v=2&token=a463935e93',
    },
    danger: {
      accent: '#ef4444',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/triangle-exclamation.svg?v=2&token=a463935e93',
    },
    tip: {
      accent: '#10b981',
      mask:
        'https://ka-p.fontawesome.com/releases/v6.6.0/svgs/regular/circle-exclamation.svg?v=2&token=a463935e93',
    },
  };

  return presets[type] ?? null;
}

export default function InfoBoxBlock({
  mode,
  tone,
  noIcon,
  plainText,
  attributes,
  children,
  editControls,
  readControls,
}: InfoBoxBlockProps) {
  const type = normalizeInfoBoxType(tone);
  const role = getInfoBoxRole(type);

  const iconPreset =
    getInfoBoxIconPreset(type);

  const showIcon =
    !noIcon &&
    infoBoxTypeHasIcon(type) &&
    Boolean(iconPreset);

  const controls =
    mode === 'edit'
      ? editControls
      : readControls;

  const alignmentPrefix =
    React.useMemo(
      () =>
        getInfoBoxAlignmentPrefix(
          plainText,
        ),
      [plainText],
    );

  const measureRef =
    React.useRef<HTMLSpanElement | null>(
      null,
    );

  const [
    hangingIndent,
    setHangingIndent,
  ] = React.useState(0);

  React.useLayoutEffect(() => {
    if (
      !alignmentPrefix ||
      !measureRef.current
    ) {
      setHangingIndent(0);
      return;
    }

    let disposed = false;

    const measure = () => {
      if (
        disposed ||
        !measureRef.current
      ) {
        return;
      }

      const width =
        measureRef.current
          .getBoundingClientRect()
          .width;

      setHangingIndent(
        Math.min(
          Math.ceil(width),
          220,
        ),
      );
    };

    measure();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(measure)
        : null;

    resizeObserver?.observe(
      measureRef.current,
    );

    void document.fonts?.ready
      ?.then(measure)
      .catch(() => undefined);

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
    };
  }, [alignmentPrefix]);

  const {
    className: attributeClassName,
    style: attributeStyle,
    ...restAttributes
  } = attributes ?? {};

  const contentStyle:
    InfoBoxContentStyle | undefined =
    alignmentPrefix &&
    hangingIndent > 0
      ? {
          '--info-box-hanging-indent':
            `${hangingIndent}px`,
        }
      : undefined;

  return (
    <div
      {...restAttributes}
      role={role}
      data-info-box-tone={type}
      data-info-box-mode={mode}
      data-info-box-aligned={
        alignmentPrefix
          ? 'true'
          : 'false'
      }
      className={[
        'info-box',
        `info-box--${type}`,
        showIcon
          ? 'info-box--with-icon'
          : 'info-box--without-icon',
        mode === 'edit'
          ? 'info-box--edit'
          : 'info-box--read',
        attributeClassName || '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={attributeStyle}
    >
      {showIcon && iconPreset ? (
        <span
          className="info-box__icon"
          aria-hidden
          contentEditable={false}
          suppressContentEditableWarning
          style={{
            backgroundColor:
              iconPreset.accent,
            WebkitMaskImage:
              `url(${iconPreset.mask})`,
            maskImage:
              `url(${iconPreset.mask})`,
            WebkitMaskRepeat:
              'no-repeat',
            maskRepeat:
              'no-repeat',
            WebkitMaskPosition:
              'center',
            maskPosition:
              'center',
            WebkitMaskSize:
              'contain',
            maskSize:
              'contain',
          }}
        />
      ) : null}

      <div
        className={[
          'info-box__content',
          alignmentPrefix &&
          hangingIndent > 0
            ? 'info-box__content--hanging'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={contentStyle}
      >
        {children}
      </div>

      {alignmentPrefix ? (
        <span
          ref={measureRef}
          className="info-box__indent-measure"
          aria-hidden
          contentEditable={false}
          suppressContentEditableWarning
        >
          {alignmentPrefix}
        </span>
      ) : null}

      {controls ? (
        <div
          className="info-box__controls"
          contentEditable={false}
          suppressContentEditableWarning
        >
          {controls}
        </div>
      ) : null}
    </div>
  );
}
