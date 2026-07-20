'use client';

import React from 'react';

import SmartImage from '@/components/common/SmartImage';
import LinkCardBlock from '@/components/wiki-render/blocks/LinkCardBlock';

import { cdn, withVersion } from '@lib/cdn';

import {
  decodeTitleForDisplay,
  isRdwikiWikiUrl,
  normalizeToAppHref,
  parseLinkUrl,
} from './linkUtils';

type LinkCardInputSize =
  | 'small'
  | 'large'
  | 'half'
  | 'full'
  | 'normal'
  | null
  | undefined;

type LinkCardRendererProps = {
  mode: 'read' | 'edit';
  url?: string;
  isWiki?: boolean;
  wikiPath?: string | number | null;
  wikiTitle?: string | null;
  sitename?: string | null;

  /**
   * main 기존 Slate 데이터는 small | large를 사용한다.
   * 저장된 데이터는 변경하지 않고 렌더링 경계에서만 해석한다.
   */
  size?: LinkCardInputSize;

  docIcon?: string | null;
  labelText?: string;

  /**
   * 기존 Element/editor adapter 호출부 호환 props
   */
  titleContent?: React.ReactNode;
  subtitle?: React.ReactNode;
  metaText?: React.ReactNode;
  inRow?: boolean;
  attributes?: React.HTMLAttributes<HTMLElement>;
  editControls?: React.ReactNode;
  readControls?: React.ReactNode;
  clickableInReadMode?: boolean;
  compactMobile?: boolean;
  onWikiNavigate?: (href: string) => void;
  onClick?: (event: React.MouseEvent) => void;
  children?: React.ReactNode;
};

function ExternalLinkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7z"
        fill="currentColor"
      />
    </svg>
  );
}

function looksLikeImageIcon(
  icon: string | null | undefined,
) {
  const value = String(icon ?? '').trim();

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

function isHalfLinkCardSize(size: LinkCardInputSize) {
  return size === 'small' || size === 'half';
}

export default function LinkCardRenderer({
  mode,
  url,
  isWiki,
  wikiTitle,
  sitename,
  size,
  docIcon,
  labelText,
  titleContent,
  subtitle,
  metaText,
  inRow,
  attributes,
  editControls,
  readControls,
  clickableInReadMode = true,
  compactMobile = false,
  onWikiNavigate,
  onClick,
  children,
}: LinkCardRendererProps) {
  const parsedUrl = React.useMemo(
    () => parseLinkUrl(url),
    [url],
  );

  const isWikiLink = React.useMemo(() => {
    if (isWiki) return true;
    if (!parsedUrl) return false;

    return isRdwikiWikiUrl(parsedUrl);
  }, [isWiki, parsedUrl]);

  const normalizedHref = React.useMemo(
    () => normalizeToAppHref(url || '#'),
    [url],
  );

  const [faviconFailed, setFaviconFailed] =
    React.useState(false);

  /**
   * 문서 아이콘 조회는 이 공통 렌더러에서 처리하지 않는다.
   *
   * - 읽기 화면: LinkCardReadAdapter
   * - 에디터: LinkBlockEditorAdapter
   *
   * 각 adapter가 useResolvedWikiDocIcon을 통해 해석한 아이콘을
   * docIcon prop으로 전달한다.
   */
  const resolvedDocIcon =
    String(docIcon ?? '').trim() || null;

  React.useEffect(() => {
    setFaviconFailed(false);
  }, [url, isWikiLink]);

  let displaySitename = sitename ?? '';

  if (!isWikiLink && !displaySitename && parsedUrl) {
    displaySitename = parsedUrl.hostname.replace(/^www\./, '');
  }

  const externalFavicon: string | null =
    !isWikiLink && parsedUrl
      ? `${parsedUrl.origin}/favicon.ico`
      : null;

  const isHalf = isHalfLinkCardSize(size);
  const isCompactTwoColMobile =
    compactMobile && isHalf;

  const fallbackTitleText =
    labelText ||
    (isWikiLink
      ? decodeTitleForDisplay(wikiTitle) ||
        sitename ||
        '문서'
      : displaySitename || url || '링크');

  const fallbackSubtitle = isWikiLink
    ? 'RenDog Wiki'
    : displaySitename ||
      (parsedUrl
        ? parsedUrl.origin.replace(/^https?:\/\//, '')
        : '');

  const iconNode = isWikiLink ? (
    resolvedDocIcon ? (
      looksLikeImageIcon(resolvedDocIcon) ? (
        <SmartImage
          src={withVersion(cdn(resolvedDocIcon))}
          alt="doc icon"
          width={22}
          height={22}
          style={{
            width: 22,
            height: 22,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: 20,
            lineHeight: 1,
          }}
        >
          {resolvedDocIcon}
        </span>
      )
    ) : (
      <span
        style={{
          fontSize: 18,
          lineHeight: 1,
        }}
        aria-hidden
      />
    )
  ) : externalFavicon && !faviconFailed ? (
    <img
      src={externalFavicon}
      alt=""
      loading="lazy"
      decoding="async"
      width={20}
      height={20}
      referrerPolicy="no-referrer"
      onError={() => setFaviconFailed(true)}
      style={{
        width: 20,
        height: 20,
        objectFit: 'contain',
        display: 'block',
        borderRadius: 4,
      }}
    />
  ) : (
    <span
      style={{
        fontSize: 18,
        lineHeight: 1,
        color: 'var(--muted)',
      }}
      aria-hidden
    >
      <ExternalLinkIcon />
    </span>
  );

  const renderedTitleContent =
    titleContent !== undefined && titleContent !== null
      ? titleContent
      : fallbackTitleText;

  const titleNode = (
    <span
      style={{
        fontSize: isCompactTwoColMobile ? 13 : 16,
        fontWeight: 750,
      }}
    >
      {renderedTitleContent}
    </span>
  );

  const renderedSubtitle =
    subtitle !== undefined && subtitle !== null
      ? subtitle
      : isCompactTwoColMobile
        ? undefined
        : fallbackSubtitle;

  const handleReadClick = (event: React.MouseEvent) => {
    onClick?.(event);

    if (event.defaultPrevented) return;

    if (!clickableInReadMode) {
      event.preventDefault();
      return;
    }

    if (!isWikiLink) {
      return;
    }

    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (event.button !== 0) return;

    /**
     * 읽기 adapter가 전달되지 않은 경우에는
     * 브라우저 기본 anchor 이동을 그대로 사용한다.
     */
    if (!onWikiNavigate) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onWikiNavigate(normalizedHref);
  };

  const card = (
    <LinkCardBlock
      mode={mode}
      href={normalizedHref}
      title={titleNode}
      subtitle={renderedSubtitle}
      metaText={metaText}
      icon={iconNode}
      size="normal"
      inRow={inRow}
      isWikiLink={isWikiLink}
      editControls={editControls}
      readControls={readControls}
      clickableInReadMode={false}
    />
  );

  const outerStyle: React.CSSProperties = {
    position: 'relative',
    flex: isHalf ? '1 1 calc(50% - 6px)' : undefined,
    width: isHalf ? 'calc(50% - 6px)' : '100%',
    maxWidth: isHalf ? 'calc(50% - 6px)' : '100%',
    boxSizing: 'border-box',
    display: 'block',
  };

  const mergedAttributes = attributes ?? {};

  return (
    <div
      {...mergedAttributes}
      data-wiki-block="link-block"
      data-wiki-link-kind={
        isWikiLink ? 'internal' : 'external'
      }
      style={{
        ...outerStyle,
        ...(mergedAttributes.style ?? {}),
      }}
    >
      {mode === 'read' ? (
        <a
          href={normalizedHref}
          onClick={handleReadClick}
          target={isWikiLink ? undefined : '_blank'}
          rel={
            isWikiLink
              ? undefined
              : 'noopener noreferrer nofollow'
          }
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'block',
          }}
          aria-label={
            typeof fallbackTitleText === 'string'
              ? fallbackTitleText
              : '링크'
          }
        >
          {card}
        </a>
      ) : (
        <div
          onClick={onClick}
          style={{
            display: 'block',
            color: 'inherit',
          }}
        >
          {card}
        </div>
      )}

      {mode === 'read' && children ? (
        <span
          style={{
            display: 'none',
          }}
        >
          {children}
        </span>
      ) : null}
    </div>
  );
}