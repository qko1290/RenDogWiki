import React from 'react';
import type { WikiRenderMode } from '../types';

type LinkCardBlockProps = {
  mode: WikiRenderMode;

  href?: string | null;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  metaText?: React.ReactNode;

  icon?: React.ReactNode;
  fallbackIcon?: React.ReactNode;

  size?: 'normal' | 'small' | 'half' | 'full' | string | null;
  inRow?: boolean;
  isWikiLink?: boolean;

  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  editControls?: React.ReactNode;
  readControls?: React.ReactNode;

  clickableInReadMode?: boolean;
};

function isHalfSize(size?: LinkCardBlockProps['size']) {
  return size === 'small' || size === 'half';
}

function DefaultIcon({ isWikiLink }: { isWikiLink?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        fontSize: 18,
        lineHeight: 1,
        color: isWikiLink ? 'var(--accent)' : 'var(--muted)',
      }}
    >
      {isWikiLink ? '📄' : '🌐'}
    </span>
  );
}

export default function LinkCardBlock({
  mode,
  href,
  title,
  subtitle,
  metaText,
  icon,
  fallbackIcon,
  size,
  inRow,
  isWikiLink,
  attributes,
  children,
  editControls,
  readControls,
  clickableInReadMode = true,
}: LinkCardBlockProps) {
  const half = isHalfSize(size);
  const controls = mode === 'edit' ? editControls : readControls;
  const [hovered, setHovered] = React.useState(false);

  const resolvedIcon =
    icon || fallbackIcon || <DefaultIcon isWikiLink={isWikiLink} />;

  /**
   * 원본 WikiReadRenderer LinkBlockView의 wrapperStyle 복구.
   * half 카드 2개가 row로 묶이는 경우는 상위 row가 폭을 담당하므로
   * LinkCardBlock 내부에서는 다시 calc(50%)를 중복 적용하지 않는다.
   */
  const wrapperStyle: React.CSSProperties = half && !inRow
    ? {
        flex: '1 1 calc(50% - 6px)',
        width: 'calc(50% - 6px)',
        maxWidth: 'calc(50% - 6px)',
        boxSizing: 'border-box',
        display: 'block',
      }
    : {
        display: 'block',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      };

  const border = hovered
    ? '1.5px solid var(--accent)'
    : '1.5px solid var(--border)';

  const shadow = hovered ? 'var(--shadow-lg)' : 'var(--shadow-sm)';

  /**
   * 원본 WikiReadRenderer 링크 카드 본체 스타일.
   * padding, radius, marginBottom, shadow, transition을 원본 쪽으로 되돌림.
   */
  const cardStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 14px',
    border,
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--surface-elevated)',
    boxShadow: shadow,
    transition: 'box-shadow .14s ease, border-color .14s ease, transform .14s ease',
    transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
    color: 'inherit',
    textDecoration: 'none',
    cursor: mode === 'read' && href ? 'pointer' : 'default',
  };

  const content = (
    <div
      {...attributes}
      className={[
        'wiki-link-card',
        mode === 'edit' ? 'wiki-link-card-edit' : 'wiki-link-card-read',
        half ? 'wiki-link-card-half' : '',
        isWikiLink ? 'wiki-link-card-wiki' : 'wiki-link-card-external',
        attributes?.className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...wrapperStyle,
        ...(attributes?.style || {}),
      }}
    >
      <div
        className="wiki-link-card-inner"
        contentEditable={mode === 'edit' ? false : undefined}
        suppressContentEditableWarning
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={cardStyle}
      >
        {controls ? (
          <span
            className="wiki-link-card-controls"
            contentEditable={false}
            suppressContentEditableWarning
            style={{
              position: 'absolute',
              top: -10,
              right: -10,
              zIndex: 2,
            }}
          >
            {controls}
          </span>
        ) : null}

        <span
          className="wiki-link-card-icon"
          contentEditable={false}
          suppressContentEditableWarning
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'var(--accent-soft)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
            overflow: 'hidden',
          }}
        >
          {resolvedIcon}
        </span>

        <span
          className="wiki-link-card-text"
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span
            className="wiki-link-card-title"
            style={{
              fontSize: 16,
              fontWeight: 750,
              color: 'var(--foreground)',
              lineHeight: 1.35,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title || children || '링크'}
          </span>

          {subtitle ? (
            <span
              className="wiki-link-card-subtitle"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--muted)',
                lineHeight: 1.35,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitle}
            </span>
          ) : null}

          {metaText ? (
            <span
              className="wiki-link-card-meta"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--muted)',
                lineHeight: 1.35,
                opacity: 0.85,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {metaText}
            </span>
          ) : null}
        </span>

        <span
          className="wiki-link-card-arrow"
          aria-hidden
          style={{
            flex: '0 0 auto',
            color: 'var(--muted)',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          →
        </span>
      </div>

      {mode === 'edit' ? children : null}
    </div>
  );

  /**
   * WikiReadRenderer 쪽은 내부/외부 링크 클릭 처리를 상위 LinkBlockView가 직접 한다.
   * 그래서 clickableInReadMode=false일 때는 여기서 a로 감싸지 않는다.
   */
  if (mode === 'read' && clickableInReadMode && href) {
    return (
      <a
        href={href}
        className="wiki-link-card-anchor"
        style={{
          color: 'inherit',
          textDecoration: 'none',
          display: half && !inRow ? 'block' : 'block',
          width: '100%',
        }}
      >
        {content}
      </a>
    );
  }

  return content;
}