'use client';

import { parseInternalWikiHref } from './linkUtils';

type ParsedWikiHref = NonNullable<ReturnType<typeof parseInternalWikiHref>>;

function isSameWikiDocument(
  target: ParsedWikiHref,
  current: ParsedWikiHref,
) {
  if (target.idParam && current.idParam) {
    return target.idParam === current.idParam;
  }

  if (
    target.pathParam &&
    current.pathParam &&
    target.titleParam &&
    current.titleParam
  ) {
    return (
      target.pathParam === current.pathParam &&
      target.titleParam === current.titleParam
    );
  }

  return target.baseDocKey === current.baseDocKey;
}

export function navigateSameDocumentHash(rawHref: string) {
  if (typeof window === 'undefined') return false;

  const target = parseInternalWikiHref(rawHref);
  if (!target?.hash) return false;

  const current = parseInternalWikiHref(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );

  if (!current) return false;
  if (!isSameWikiDocument(target, current)) return false;

  const encodedHash = `#${encodeURIComponent(target.hash)}`;
  const nextUrl = `${window.location.pathname}${window.location.search}${encodedHash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (currentUrl !== nextUrl) {
    window.history.pushState(null, '', nextUrl);
  }

  window.dispatchEvent(
    new CustomEvent('rdwiki:search-hash-nav', {
      detail: {
        domId: target.hash,
      },
    }),
  );

  return true;
}