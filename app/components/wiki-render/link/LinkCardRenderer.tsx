"use client";

import React from 'react';
import { useRouter } from 'next/navigation';

import SmartImage from '@/components/common/SmartImage';
import LinkCardBlock from '@/components/wiki-render/blocks/LinkCardBlock';
import { cdn, withVersion } from '@lib/cdn';
import { markNextDocViewSource } from '@/wiki/lib/viewSource';

import {
  decodeTitleForDisplay,
  isRdwikiWikiUrl,
  normalizeToAppHref,
} from './linkUtils';

import { getWikiDocDetailByHref } from './linkPreviewService';

type LinkCardRendererProps = {
  mode: 'read' | 'edit';

  url?: string;
  isWiki?: boolean;
  wikiPath?: string | number | null;
  wikiTitle?: string | null;
  sitename?: string | null;
  size?: 'small' | 'half' | 'full';
  docIcon?: string | null;

  labelText?: string;
  compactMobile?: boolean;

  onWikiNavigate?: (href: string) => void;
  onClick?: (event: React.MouseEvent) => void;

  children?: React.ReactNode;
};

function getParsedUrl(url?: string | null) {
  if (!url) return null;

  try {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://dummy.local';

    return new URL(url, base);
  } catch {
    return null;
  }
}

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

function looksLikeImageIcon(icon: string | null | undefined) {
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

export default function LinkCardRenderer({
  mode,
  url,
  isWiki,
  wikiTitle,
  sitename,
  size,
  docIcon,
  labelText,
  compactMobile = false,
  onWikiNavigate,
  onClick,
  children,
}: LinkCardRendererProps) {
  const router = useRouter();

  const parsedUrl = React.useMemo(() => getParsedUrl(url), [url]);

  const isWikiLink = React.useMemo(() => {
    if (isWiki) return true;
    if (!parsedUrl) return false;

    return isRdwikiWikiUrl(parsedUrl);
  }, [isWiki, parsedUrl]);

  const normalizedHref = React.useMemo(
    () => normalizeToAppHref(url || '#'),
    [url],
  );

  const [faviconFailed, setFaviconFailed] = React.useState(false);

  const [resolvedDocIcon, setResolvedDocIcon] = React.useState<string | null>(
    () => String(docIcon ?? '').trim() || null,
  );

  React.useEffect(() => {
    setFaviconFailed(false);
  }, [url, isWikiLink]);

  React.useEffect(() => {
    let cancelled = false;

    const fallbackIcon = String(docIcon ?? '').trim() || null;
    setResolvedDocIcon(fallbackIcon);

    if (!isWikiLink) return;
    if (!normalizedHref || normalizedHref === '#') return;

    (async () => {
      try {
        const loaded = await getWikiDocDetailByHref(normalizedHref);

        if (!loaded || cancelled) return;

        const { parsed, detail } = loaded;

        let iconCandidate: string | null = null;
        const hash = String(parsed.hash ?? '').trim();

        if (hash && Array.isArray(detail.headings)) {
          const target = hash;
          const normalizedTarget = target.startsWith('heading-')
            ? target
            : `heading-${target}`;

          const matched = detail.headings.find((heading) => {
            const headingId = String(heading.id ?? '');
            const normalizedHeadingId = headingId.startsWith('heading-')
              ? headingId
              : `heading-${headingId}`;

            return (
              headingId === target ||
              headingId === normalizedTarget ||
              normalizedHeadingId === target ||
              normalizedHeadingId === normalizedTarget
            );
          });

          if (matched?.icon) {
            iconCandidate = String(matched.icon).trim() || null;
          }
        }

        if (!iconCandidate && detail.icon) {
          iconCandidate = String(detail.icon).trim() || null;
        }

        if (!cancelled && iconCandidate) {
          setResolvedDocIcon(iconCandidate);
        }
      } catch {
        // 문서 아이콘 로딩 실패 시 기존 fallback 유지
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [docIcon, isWikiLink, normalizedHref]);

  let displaySitename = sitename ?? '';

  if (!isWikiLink && !displaySitename && parsedUrl) {
    displaySitename = parsedUrl.hostname.replace(/^www\./, '');
  }

  const externalFavicon: string | null =
    !isWikiLink && parsedUrl ? `${parsedUrl.origin}/favicon.ico` : null;

  const isSmall = size === 'small' || size === 'half';
  const isCompactTwoColMobile = compactMobile && isSmall;

  const safeLabel =
    labelText ||
    (isWikiLink
      ? decodeTitleForDisplay(wikiTitle) || sitename || '문서'
      : displaySitename || url || '링크');

  const subText = isWikiLink
    ? 'RenDog Wiki'
    : displaySitename ||
      (parsedUrl ? parsedUrl.origin.replace(/^https?:\/\//, '') : '');

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
        <span style={{ fontSize: 20, lineHeight: 1 }}>
          {resolvedDocIcon}
        </span>
      )
    ) : (
      <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
        📄
      </span>
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

  const titleNode = (
    <span
      style={{
        fontSize: isCompactTwoColMobile ? 13 : 16,
        fontWeight: 750,
      }}
    >
      {safeLabel}
    </span>
  );

  const card = (
    <LinkCardBlock
      mode={mode}
      href={normalizedHref}
      title={titleNode}
      subtitle={isCompactTwoColMobile ? undefined : subText}
      icon={iconNode}
      size={isSmall ? 'half' : 'normal'}
      inRow={isCompactTwoColMobile}
      isWikiLink={isWikiLink}
      clickableInReadMode={false}
    />
  );

  const handleClick = (event: React.MouseEvent) => {
    onClick?.(event);

    if (event.defaultPrevented) return;

    if (!isWikiLink) return;

    const anyEvent = event as any;

    if (
      anyEvent.metaKey ||
      anyEvent.ctrlKey ||
      anyEvent.shiftKey ||
      anyEvent.altKey
    ) {
      return;
    }

    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    markNextDocViewSource('link');

    if (onWikiNavigate) {
      onWikiNavigate(normalizedHref);
      return;
    }

    router.push(normalizedHref);
  };

  return (
    <div
      data-wiki-block="link-block"
      data-wiki-link-kind={isWikiLink ? 'internal' : 'external'}
      style={{
        position: 'relative',
        flex: isSmall ? '1 1 calc(50% - 6px)' : undefined,
        width: isSmall ? 'calc(50% - 6px)' : '100%',
        maxWidth: isSmall ? 'calc(50% - 6px)' : '100%',
        boxSizing: 'border-box',
        display: 'block',
      }}
    >
      <a
        href={normalizedHref}
        onClick={isWikiLink ? handleClick : onClick}
        target={isWikiLink ? undefined : '_blank'}
        rel={isWikiLink ? undefined : 'noopener noreferrer nofollow'}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'block',
        }}
        aria-label={safeLabel}
      >
        {card}
      </a>

      {children}
    </div>
  );
}
