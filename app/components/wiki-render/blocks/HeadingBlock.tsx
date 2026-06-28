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
 * main 원본 WikiReadRenderer 기준:
 * h1: 28px
 * h2: 22px
 * h3: 18px
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
  const shouldRenderAsImage = looksLikeImageIcon(safeIcon) && !imageFailed;
  const iconSize = getHeadingIconSize(level);

  if (!safeIcon) return null;

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