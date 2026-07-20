import type { ParsedWikiHref } from './types';

export function decodeTitleForDisplay(
  raw: string | null | undefined,
) {
  const value = String(raw ?? '');
  return value.replace(/_/g, ' ').trim();
}

export function encodeTitleForShare(
  raw: string | null | undefined,
) {
  const value = String(raw ?? '').trim();
  return value.replace(/\s+/g, '_');
}

export function decodeTitleFromUrlParam(
  value: string | null | undefined,
) {
  return String(value ?? '').replace(/_/g, ' ');
}

export function encodeTitleForUrlParam(
  value: string | null | undefined,
) {
  return String(value ?? '').trim().replace(/\s+/g, '_');
}

export function parseLinkUrl(
  rawHref: string | null | undefined,
): URL | null {
  if (!rawHref) return null;

  try {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://dummy.local';

    return new URL(rawHref, base);
  } catch {
    return null;
  }
}

export function normalizeHostForWikiLink(
  hostname: string | null | undefined,
) {
  return String(hostname ?? '')
    .trim()
    .replace(/^www\./i, '')
    .toLowerCase();
}

export function isKnownRdwikiHost(
  hostname: string | null | undefined,
) {
  const host = normalizeHostForWikiLink(hostname);

  if (!host) return false;

  return (
    host === 'ren-dog-wiki.vercel.app' ||
    (host.startsWith('ren-dog-wiki-') &&
      host.endsWith('.vercel.app')) ||
    host.endsWith('qko1290s-projects.vercel.app')
  );
}

export function isRdwikiWikiUrl(urlObj: URL) {
  if (!urlObj.pathname.startsWith('/wiki')) return false;

  if (typeof window === 'undefined') {
    return true;
  }

  const currentHost = normalizeHostForWikiLink(
    window.location.hostname,
  );
  const targetHost = normalizeHostForWikiLink(urlObj.hostname);

  return (
    targetHost === currentHost ||
    isKnownRdwikiHost(targetHost)
  );
}

export function normalizeToAppHref(rawHref: string) {
  const url = parseLinkUrl(rawHref);

  if (!url) return rawHref;

  if (isRdwikiWikiUrl(url)) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  if (
    typeof window !== 'undefined' &&
    url.origin === window.location.origin
  ) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  return rawHref;
}

export function isInternalWikiHref(rawHref: string) {
  const url = parseLinkUrl(rawHref);
  return url ? isRdwikiWikiUrl(url) : false;
}

export function parseInternalWikiHref(
  rawHref: string,
): ParsedWikiHref | null {
  const url = parseLinkUrl(rawHref);

  if (!url || !isRdwikiWikiUrl(url)) {
    return null;
  }

  const pathParam =
    (url.searchParams.get('path') ?? '').trim() || null;
  const titleParamRaw =
    (url.searchParams.get('title') ?? '').trim() || null;
  const titleParam = titleParamRaw
    ? decodeTitleForDisplay(titleParamRaw)
    : null;
  const idParam =
    (url.searchParams.get('id') ?? '').trim() || null;

  const rawHash = url.hash ? url.hash.slice(1) : '';
  const hash = rawHash
    ? (() => {
        try {
          return decodeURIComponent(rawHash);
        } catch {
          return rawHash;
        }
      })()
    : '';

  const keyParts: string[] = [];

  if (idParam) keyParts.push(`id:${idParam}`);
  if (pathParam) keyParts.push(`p:${pathParam}`);
  if (titleParam) keyParts.push(`t:${titleParam}`);

  return {
    normalizedHref: normalizeToAppHref(rawHref),
    pathParam,
    titleParam,
    idParam,
    hash,
    baseDocKey: keyParts.join('|') || url.pathname,
  };
}