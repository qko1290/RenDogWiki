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

function InfoBoxIcon({
  type,
}: {
  type: string;
}) {
  if (type === 'warning') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        focusable="false"
      >
        <path
          d="M12 4.1 21 20H3L12 4.1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M12 9v5.2M12 17.3h.01"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === 'danger') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        focusable="false"
      >
        <path
          d="M12 4.1 21 20H3L12 4.1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M12 9v5.2M12 17.3h.01"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === 'tip') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        focusable="false"
      >
        <path
          d="m7.3 12.2 3 3 6.5-6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="12"
          cy="12"
          r="8.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="8.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 10.7v5M12 7.6h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
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

  const showIcon =
    !noIcon &&
    infoBoxTypeHasIcon(type);

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

  const contentStyle =
    alignmentPrefix &&
    hangingIndent > 0
      ? ({
          '--info-box-hanging-indent':
            `${hangingIndent}px`,
        } as React.CSSProperties &
          Record<string, string>)
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
      {showIcon ? (
        <span
          className="info-box__icon"
          aria-hidden
          contentEditable={false}
          suppressContentEditableWarning
        >
          <InfoBoxIcon type={type} />
        </span>
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
