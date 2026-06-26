import React from 'react';
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
  attributes?: React.HTMLAttributes<HTMLHeadingElement>;
  children?: React.ReactNode;
};

function getHeadingTag(level: HeadingLevel): 'h1' | 'h2' | 'h3' {
  if (level === 1) return 'h1';
  if (level === 2) return 'h2';
  return 'h3';
}

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
  textAlign?: string | null
): React.CSSProperties['textAlign'] {
  if (textAlign === 'center') return 'center';
  if (textAlign === 'right') return 'right';
  return 'left';
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
  const fontSize = getHeadingFontSize(level);
  const fontWeight = getHeadingFontWeight(level);
  const justify = getJustify(textAlign);

  const iconNode = icon ? (
    <span
      onClick={
        mode === 'edit'
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onIconClick?.();
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
        flex: '0 0 auto',
      }}
    >
      {typeof icon === 'string' && icon.startsWith('http') ? (
        <img
          src={icon}
          alt=""
          style={{
            width: 28,
            height: 28,
            objectFit: 'contain',
            display: 'block',
          }}
          draggable={false}
        />
      ) : (
        <span
          style={{
            fontSize: 26,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {icon}
        </span>
      )}
    </span>
  ) : null;

  return (
    <Tag
      {...attributes}
      id={domId}
      data-heading-id={dataHeadingId}
      className={[
        mode === 'read' ? 'wiki-heading' : '',
        attributes?.className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      suppressHydrationWarning={mode === 'read' ? true : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: justify,
        gap: 0,
        textAlign: getTextAlign(textAlign),
        fontSize,
        fontWeight,
        lineHeight: 1.25,
        ...(attributes?.style || {}),
      }}
    >
      {iconNode}
      {children}
    </Tag>
  );
}