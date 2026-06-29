import React from 'react';

import SmartImage from '@/components/common/SmartImage';
import { cdn, withVersion } from '@lib/cdn';
import type { WikiRenderMode } from '../types';

type HeadingLevel = 1 | 2 | 3;

type HeadingBlockProps = {
  mode: WikiRenderMode;
  level: HeadingLevel;
  textAlign?: string | null;
  icon?: string | null;
  domId?: string;
  dataHeadingId?: string;
  onIconClick?: () => void;
  attributes?: React.HTMLAttributes<HTMLElement>;
  children?: React.ReactNode;
};

function getHeadingTag(level: HeadingLevel): 'h1' | 'h2' | 'h3' {
  if (level === 1) return 'h1';
  if (level === 2) return 'h2';
  return 'h3';
}

function getHeadingIconSize(level: HeadingLevel) {
  if (level === 1) return 28;
  if (level === 2) return 26;
  return 22;
}

/**
 * main 원본 WikiReadRenderer 기준 heading 크기.
 */
function getHeadingFontSize(level: HeadingLevel) {
  if (level === 1) return '28px';
  if (level === 2) return '22px';
  return '18px';
}

function getHeadingFontWeight(level: HeadingLevel) {
  if (level === 1) return 800;
  if (level === 2) return 750;
  return 700;
}

function getJustify(textAlign?: string | null) {
  if (textAlign === 'center') return 'center';
  if (textAlign === 'right') return 'flex-end';
  return 'flex-start';
}

function getTextAlign(
  textAlign?: string | null,
): React.CSSProperties['textAlign'] {
  if (textAlign === 'center') return 'center';
  if (textAlign === 'right') return 'right';
  return 'left';
}

function getHeadingMargin(level: HeadingLevel): React.CSSProperties['margin'] {
  if (level === 1) return '0 0 18px';
  if (level === 2) return '34px 0 24px';
  return '28px 0 18px';
}

function looksLikeImageIcon(icon: string) {
  const value = icon.trim();

  if (!value) return false;

  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/api/') ||
    value.startsWith('/uploads/') ||
    value.startsWith('/images/') ||
    value.startsWith('/_next/') ||
    /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(value)
  );
}

function HeadingIcon({
  icon,
  mode,
  level,
  onIconClick,
}: {
  icon: string;
  mode: WikiRenderMode;
  level: HeadingLevel;
  onIconClick?: () => void;
}) {
  const [imageFailed, setImageFailed] = React.useState(false);

  const safeIcon = String(icon ?? '').trim();

  if (!safeIcon) return null;

  const shouldRenderAsImage = looksLikeImageIcon(safeIcon) && !imageFailed;
  const iconSize = getHeadingIconSize(level);

  return (
    <span
      onMouseDown={
        mode === 'edit' && onIconClick
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              onIconClick();
            }
          : undefined
      }
      contentEditable={false}
      suppressContentEditableWarning
      style={{
        cursor: mode === 'edit' && onIconClick ? 'pointer' : 'default',
        marginRight: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
        width: iconSize,
        height: iconSize,
        lineHeight: 1,
      }}
    >
      {shouldRenderAsImage ? (
        <SmartImage
          src={withVersion(cdn(safeIcon))}
          alt=""
          width={iconSize}
          height={iconSize}
          onError={() => setImageFailed(true)}
          style={{
            width: iconSize,
            height: iconSize,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: iconSize,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {safeIcon}
        </span>
      )}
    </span>
  );
}

export default function HeadingBlock({
  mode,
  level,
  textAlign,
  icon,
  domId,
  dataHeadingId,
  onIconClick,
  attributes,
  children,
}: HeadingBlockProps) {
  const Tag = getHeadingTag(level);

  return (
    <>
      <style>
        {`
          [data-rdwiki-heading="true"] [data-wiki-leaf="true"] {
            font-size: inherit !important;
            font-weight: inherit;
            line-height: inherit;
          }

          [data-rdwiki-heading="true"] [data-wiki-leaf="true"] * {
            font-size: inherit !important;
            line-height: inherit;
          }

          [data-rdwiki-heading="true"] .wiki-heading-anchor-btn {
            margin-left: 8px;
            padding: 0;
            border: 0;
            background: transparent;
            color: inherit;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transform: translateX(-2px);
            transition: opacity 0.14s ease, transform 0.14s ease;
            flex: 0 0 auto;
          }

          [data-rdwiki-heading="true"]:hover .wiki-heading-anchor-btn {
            opacity: 1;
            transform: translateX(0);
          }

          [data-rdwiki-heading="true"] .wiki-heading-anchor-pill {
            width: 20px;
            height: 20px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--muted);
            font-size: 12px;
            font-weight: 800;
            line-height: 1;
            background: transparent;
            border: 1px solid transparent;
            position: relative;
            transition:
              background 0.14s ease,
              border-color 0.14s ease,
              color 0.14s ease,
              transform 0.14s ease;
          }

          [data-rdwiki-heading="true"] .wiki-heading-anchor-pill::before {
            content: "";
            width: 13px;
            height: 13px;
            display: block;
            opacity: 0.78;
            background: currentColor;
            -webkit-mask:
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.43'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.33-1.33'/%3E%3C/svg%3E")
              center / contain no-repeat;
            mask:
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.43'/%3E%3Cpath d='M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.33-1.33'/%3E%3C/svg%3E")
              center / contain no-repeat;
          }

          [data-rdwiki-heading="true"] .wiki-heading-anchor-pill--copied::before {
            display: none;
          }

          [data-rdwiki-heading="true"] .wiki-heading-anchor-btn:hover .wiki-heading-anchor-pill {
            background: var(--surface-soft);
            border-color: var(--border);
            color: var(--foreground);
          }

          [data-rdwiki-heading="true"] .wiki-heading-anchor-pill--copied {
            background: var(--accent-soft);
            border-color: var(--accent);
            color: var(--accent);
            transform: scale(1.04);
          }
        `}
      </style>

      <Tag
        {...attributes}
        id={domId ?? attributes?.id}
        data-rdwiki-heading="true"
        data-wiki-mode={mode}
        data-heading-id={dataHeadingId}
        suppressHydrationWarning
        style={{
          ...(attributes?.style ?? {}),
          display: 'flex',
          alignItems: 'center',
          justifyContent: getJustify(textAlign),
          textAlign: getTextAlign(textAlign),
          margin: getHeadingMargin(level),
          padding: 0,
          color: 'var(--foreground)',
          fontSize: getHeadingFontSize(level),
          fontWeight: getHeadingFontWeight(level),
          lineHeight: 1.35,
          letterSpacing: '-0.02em',
          scrollMarginTop: 96,
        }}
      >
        {icon ? (
          <HeadingIcon
            icon={icon}
            mode={mode}
            level={level}
            onIconClick={onIconClick}
          />
        ) : null}

        {children}
      </Tag>
    </>
  );
}