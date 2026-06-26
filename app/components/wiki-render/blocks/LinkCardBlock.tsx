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

  size?: 'normal' | 'small' | 'half' | string | null;
  inRow?: boolean;
  isWikiLink?: boolean;

  attributes?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;

  /**
   * 편집 화면 전용 버튼 자리.
   * 예: 삭제 버튼, 편집 버튼
   */
  editControls?: React.ReactNode;

  /**
   * 읽기 화면 전용 버튼 자리.
   * 예: 새 창 열기, 복사 버튼
   */
  readControls?: React.ReactNode;

  /**
   * 읽기 모드에서만 카드 전체를 링크로 감쌀지 여부.
   * 에디터에서는 Slate 선택/편집과 충돌할 수 있으므로 기본적으로 감싸지 않는다.
   */
  clickableInReadMode?: boolean;
};

function isHalfSize(size?: LinkCardBlockProps['size']) {
  return size === 'small' || size === 'half';
}

function defaultFallbackIcon(isWikiLink?: boolean) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isWikiLink ? '#eef6ff' : '#f1f5f9',
        color: isWikiLink ? '#2563eb' : '#64748b',
        fontSize: 20,
        flex: '0 0 auto',
      }}
    >
      {isWikiLink ? '📘' : '↗'}
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
  const resolvedIcon = icon || fallbackIcon || defaultFallbackIcon(isWikiLink);

  const wrapperStyle: React.CSSProperties = half
    ? {
        display: inRow ? 'block' : 'inline-block',
        verticalAlign: 'top',
        width: 'calc(50% - 6px)',
        maxWidth: 'calc(50% - 6px)',
        marginRight: inRow ? 0 : 12,
        }
    : {
        display: 'block',
        width: '100%',
        maxWidth: '100%',
        };

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minHeight: 76,
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid #c7d2fe',
    background: 'var(--surface-elevated, #fff)',
    boxShadow: '0 8px 22px rgba(15,23,42,0.06)',
    color: 'inherit',
    textDecoration: 'none',
    transition: 'border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease',
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
        style={cardStyle}
        contentEditable={mode === 'edit' ? false : undefined}
        suppressContentEditableWarning
      >
        {controls ? (
          <span
            className="wiki-link-card-controls"
            style={{
              position: 'absolute',
              top: -10,
              right: -10,
              zIndex: 2,
            }}
            contentEditable={false}
            suppressContentEditableWarning
          >
            {controls}
          </span>
        ) : null}

        <span
          className="wiki-link-card-icon"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
          }}
        >
          {resolvedIcon}
        </span>

        <span
          className="wiki-link-card-text"
          style={{
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            flex: '1 1 auto',
          }}
        >
          <span
            className="wiki-link-card-title"
            style={{
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.35,
              color: 'var(--foreground)',
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
                fontSize: 13,
                lineHeight: 1.35,
                color: 'var(--muted-foreground)',
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
                fontSize: 12,
                lineHeight: 1.35,
                color: 'var(--muted-foreground)',
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
          aria-hidden="true"
          style={{
            color: 'var(--muted-foreground)',
            fontSize: 18,
            flex: '0 0 auto',
          }}
        >
          →
        </span>
      </div>

      {mode === 'edit' ? children : null}
    </div>
  );

  if (mode === 'read' && clickableInReadMode && href) {
    return (
      <a
        href={href}
        className="wiki-link-card-anchor"
        style={{
            color: 'inherit',
            textDecoration: 'none',
            display: half && !inRow ? 'inline-block' : 'block',
        }}
        >
        {content}
      </a>
    );
  }

  return content;
}