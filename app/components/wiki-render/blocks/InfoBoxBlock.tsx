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
    /^([^\n:]{1,64}:[ \t\u00a0\u3000]+)/,
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

type InfoBoxAlignmentPoint = {
  node: Text;
  offset: number;
};

function findInfoBoxAlignmentPoint(
  root: HTMLElement,
): InfoBoxAlignmentPoint | null {
  const walker =
    document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
    );

  const visibleText: string[] = [];
  const positions: InfoBoxAlignmentPoint[] = [];

  let current =
    walker.nextNode() as Text | null;

  while (
    current &&
    visibleText.length < 128
  ) {
    const raw = current.data;

    for (
      let offset = 0;
      offset < raw.length;
      offset += 1
    ) {
      const character = raw[offset];

      if (
        character === '\u200b' ||
        character === '\r'
      ) {
        continue;
      }

      if (character === '\n') {
        current = null;
        break;
      }

      visibleText.push(character);
      positions.push({
        node: current,
        offset: offset + 1,
      });
    }

    if (!current) break;

    current =
      walker.nextNode() as Text | null;
  }

  const firstLine =
    visibleText.join('');

  const match = firstLine.match(
    /^[^:\n]{1,64}:[ \t\u00a0\u3000]+/,
  );

  if (!match) return null;

  const colonIndex =
    match[0].indexOf(':');

  /*
   * 정렬 기준은 콜론 뒤의 첫 공백까지다.
   * 기존 문서에 공백이 여러 개 있어도 그 전체 폭을
   * 새 기준으로 사용하지 않는다.
   */
  const endIndex =
    colonIndex + 2;

  return (
    positions[endIndex - 1] ??
    null
  );
}

function measureInfoBoxHangingIndent(
  root: HTMLElement,
) {
  const point =
    findInfoBoxAlignmentPoint(root);

  if (!point) return 0;

  const range =
    document.createRange();

  range.setStart(root, 0);
  range.setEnd(
    point.node,
    point.offset,
  );

  const contentRect =
    root.getBoundingClientRect();

  const rects =
    Array.from(
      range.getClientRects(),
    ).filter(
      (rect) =>
        rect.width > 0 &&
        rect.height > 0,
    );

  if (rects.length === 0) {
    range.detach();
    return 0;
  }

  const firstLineTop =
    Math.min(
      ...rects.map(
        (rect) => rect.top,
      ),
    );

  const firstLineRects =
    rects.filter(
      (rect) =>
        Math.abs(
          rect.top - firstLineTop,
        ) <= 3,
    );

  const right =
    Math.max(
      ...firstLineRects.map(
        (rect) => rect.right,
      ),
    );

  range.detach();

  const measured =
    right - contentRect.left;

  /*
   * 비정상적으로 긴 라벨이 본문 폭 대부분을 차지하지 않도록
   * 안전 범위 안에서만 적용한다.
   */
  return Math.max(
    0,
    Math.min(
      Math.ceil(measured),
      Math.floor(
        contentRect.width * 0.72,
      ),
      360,
    ),
  );
}

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

  const contentRef =
    React.useRef<HTMLDivElement | null>(
      null,
    );

  const [
    hangingIndent,
    setHangingIndent,
  ] = React.useState(0);

  React.useLayoutEffect(() => {
    const content =
      contentRef.current;

    if (
      !alignmentPrefix ||
      !content
    ) {
      setHangingIndent(0);
      return;
    }

    let disposed = false;
    let animationFrame = 0;

    const measure = () => {
      if (disposed) return;

      const width =
        measureInfoBoxHangingIndent(
          content,
        );

      setHangingIndent(
        (previous) =>
          Math.abs(
            previous - width,
          ) < 0.5
            ? previous
            : width,
      );
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(
        animationFrame,
      );

      animationFrame =
        requestAnimationFrame(
          measure,
        );
    };

    scheduleMeasure();

    const resizeObserver =
      typeof ResizeObserver !==
      'undefined'
        ? new ResizeObserver(
            scheduleMeasure,
          )
        : null;

    resizeObserver?.observe(content);

    const mutationObserver =
      typeof MutationObserver !==
      'undefined'
        ? new MutationObserver(
            scheduleMeasure,
          )
        : null;

    mutationObserver?.observe(
      content,
      {
        childList: true,
        characterData: true,
        subtree: true,
      },
    );

    /*
     * 인라인 이미지가 늦게 로드되어 실제 너비가 바뀌는 경우도
     * 다시 측정한다. load는 버블링하지 않으므로 캡처 단계 사용.
     */
    content.addEventListener(
      'load',
      scheduleMeasure,
      true,
    );

    window.addEventListener(
      'resize',
      scheduleMeasure,
    );

    void document.fonts?.ready
      ?.then(scheduleMeasure)
      .catch(() => undefined);

    return () => {
      disposed = true;

      cancelAnimationFrame(
        animationFrame,
      );

      resizeObserver?.disconnect();
      mutationObserver?.disconnect();

      content.removeEventListener(
        'load',
        scheduleMeasure,
        true,
      );

      window.removeEventListener(
        'resize',
        scheduleMeasure,
      );
    };
  }, [
    alignmentPrefix,
    mode,
    plainText,
  ]);

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
        ref={contentRef}
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
