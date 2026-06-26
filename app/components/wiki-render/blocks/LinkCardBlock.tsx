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
   * 문서 렌더러(WikiReadRenderer)는 이미 LinkBlockView 바깥 div에서
   * half 카드의 flex/width/maxWidth를 처리하고 있음.
   * 여기서 다시 calc(50%)를 적용하면 카드가 이중으로 줄어든다.
   *
   * 에디터 렌더러(Element.tsx)는 LinkCardBlock을 직접 반환하므로,
   * 에디터에서만 단독 half 카드 폭을 보조한다.
   */
  const wrapperStyle: React.CSSProperties =
    mode === 'edit' && half && !inRow
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

  const BORDER = hovered
    ? '1.5px solid var(--accent)'
    : '1.5px solid var(--border)';

  const SHADOW = hovered ? 'var(--shadow-lg)' : 'var(--shadow-sm)';

  /**
   * 원본 WikiReadRenderer의 LinkBlockView 카드 스타일을 그대로 복구.
   * 새 디자인 값(minHeight, c7d2fe border, 14 radius, 큰 shadow 등) 제거.
   */
  const cardStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 14px',
    border: BORDER,
    borderRadius: 12,
    marginBottom: 10,
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--surface-elevated)',
    boxShadow: SHADOW,
    transition: 'box-shadow .14s ease, border-color .14s ease, transform .14s ease',
    transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
    color: 'inherit',
    textDecoration: 'none',
    cursor: mode === 'read' && href ? 'pointer' : 'default',
  };

  /**
   * icon은 LinkBlockView에서 이미 원본 방식으로 만들어서 넘긴다.
   * 특히 외부 favicon은 원본에서 20x20 img로 직접 렌더링되므로,
   * 여기서 38x38 배경 박스로 다시 감싸면 원본과 달라진다.
   */
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
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
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
   * WikiReadRenderer는 내부/외부 링크를 상위 LinkBlockView에서 <a>로 감싸고,
   * 내부 위키 링크는 router.push로 직접 처리한다.
   * clickableInReadMode=false일 때 여기서 다시 <a>를 만들면 중첩 링크가 된다.
   */
  if (mode === 'read' && clickableInReadMode && href) {
    return (
      <a
        href={href}
        className="wiki-link-card-anchor"
        style={{
          color: 'inherit',
          textDecoration: 'none',
          display: 'block',
          width: '100%',
        }}
      >
        {content}
      </a>
    );
  }

  return content;
}