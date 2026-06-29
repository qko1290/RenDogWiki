import type { ParsedWikiHref } from './types';

export function decodeTitleForDisplay(raw: string | null | undefined) {
  const s = String(raw ?? '');
  return s.replace(/_/g, ' ').trim();
}

export function encodeTitleForShare(raw: string | null | undefined) {
  const s = String(raw ?? '').trim();
  return s.replace(/\s+/g, '_');
}

export function decodeTitleFromUrlParam(value: string | null | undefined) {
  return String(value ?? '').replace(/_/g, ' ');
}

export function encodeTitleForUrlParam(value: string | null | undefined) {
  return String(value ?? '').trim().replace(/\s+/g, '_');
}

export function normalizeHostForWikiLink(hostname: string | null | undefined) {
  return String(hostname ?? '')
    .trim()
    .replace(/^www\./i, '')
    .toLowerCase();
}

export function isKnownRdwikiHost(hostname: string | null | undefined) {
  const host = normalizeHostForWikiLink(hostname);

  if (!host) return false;

  return (
    host === 'ren-dog-wiki.vercel.app' ||
    (host.startsWith('ren-dog-wiki-') && host.endsWith('.vercel.app')) ||
    host.endsWith('qko1290s-projects.vercel.app')
  );
}

export function isRdwikiWikiUrl(urlObj: URL) {
  if (!urlObj.pathname.startsWith('/wiki')) return false;

  if (typeof window === 'undefined') {
    return true;
  }

  const currentHost = normalizeHostForWikiLink(window.location.hostname);
  const targetHost = normalizeHostForWikiLink(urlObj.hostname);

  return targetHost === currentHost || isKnownRdwikiHost(targetHost);
}

export function normalizeToAppHref(rawHref: string) {
  try {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://dummy.local';

    const u = new URL(rawHref, base);

    if (isRdwikiWikiUrl(u)) {
      return `${u.pathname}${u.search}${u.hash}`;
    }

    if (typeof window !== 'undefined' && u.origin === window.location.origin) {
      return `${u.pathname}${u.search}${u.hash}`;
    }

    return rawHref;
  } catch {
    return rawHref;
  }
}

export function isInternalWikiHref(rawHref: string) {
  try {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://dummy.local';

    const u = new URL(rawHref, base);

    return isRdwikiWikiUrl(u);
  } catch {
    return false;
  }
}

export function parseInternalWikiHref(rawHref: string): ParsedWikiHref | null {
  try {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://dummy.local';

    const u = new URL(rawHref, base);

    if (!isRdwikiWikiUrl(u)) return null;

    const pathParam = (u.searchParams.get('path') ?? '').trim() || null;

    const titleParamRaw = (u.searchParams.get('title') ?? '').trim() || null;
    const titleParam = titleParamRaw
      ? decodeTitleForDisplay(titleParamRaw)
      : null;

    const idParam = (u.searchParams.get('id') ?? '').trim() || null;

    const rawHash = u.hash ? u.hash.slice(1) : '';
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
      baseDocKey: keyParts.join('|') || u.pathname,
    };
  } catch {
    return null;
  }
}
