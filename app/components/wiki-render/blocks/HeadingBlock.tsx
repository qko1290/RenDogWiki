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

function getHeadingFontSize(level: HeadingLevel) {
  if (level === 1) return '28px';
  if (level === 2) return '22px';
  return '18px';
}

function getDefaultIcon(level: HeadingLevel) {
  if (level === 1) return '';
  if (level === 2) return '';
  return '';
}

function getJustify(textAlign?: string | null) {
  if (textAlign === 'center') return 'center';
  if (textAlign === 'right') return 'flex-end';
  return 'flex-start';
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
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  const fontSize = getHeadingFontSize(level);
  const justify = getJustify(textAlign);
  const resolvedIcon = icon || getDefaultIcon(level);

  const iconNode =
    resolvedIcon && resolvedIcon.startsWith('http') ? (
      <img
        src={resolvedIcon}
        alt=""
        style={{
          width: 28,
          height: 28,
          objectFit: 'contain',
          display: 'block',
        }}
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
        {resolvedIcon}
      </span>
    );

  const headingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: justify,
    gap: 0,
    textAlign: (textAlign as React.CSSProperties['textAlign']) || 'left',
    fontSize,
    fontWeight: level === 1 ? 800 : level === 2 ? 750 : 700,
    lineHeight: 1.25,
  };

  return React.createElement(
    Tag,
    {
      ...attributes,
      id: domId,
      'data-heading-id': dataHeadingId,
      className: mode === 'read' ? 'wiki-heading' : attributes?.className,
      style: {
        ...headingStyle,
        ...(attributes?.style || {}),
      },
    },
    <>
      {resolvedIcon ? (
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
          contentEditable={mode === 'edit' ? false : undefined}
          suppressContentEditableWarning
          style={{
            cursor: mode === 'edit' && onIconClick ? 'pointer' : 'default',
            marginRight: 8,
            display: 'inline-flex',
            alignItems: 'center',
            flex: '0 0 auto',
          }}
        >
          {iconNode}
        </span>
      ) : null}

      <span
        style={{
          minWidth: 0,
        }}
      >
        {children}
      </span>
    </>
  );
}