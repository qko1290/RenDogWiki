import { extractHeadings } from '@/wiki/lib/extractHeadings';

import type {
  WikiDocDetail,
  WikiDocHeadingMeta,
} from './types';

import {
  parseInternalWikiHref,
} from './linkUtils';

const WIKI_DOC_DETAIL_CACHE_KEY =
  '__rdwiki_doc_detail_cache__';

const wikiDocDetailCache: Map<string, WikiDocDetail> =
  (globalThis as any)[WIKI_DOC_DETAIL_CACHE_KEY] ??
  new Map<string, WikiDocDetail>();

(globalThis as any)[WIKI_DOC_DETAIL_CACHE_KEY] =
  wikiDocDetailCache;

type ParsedInternalWikiHref = NonNullable<
  ReturnType<typeof parseInternalWikiHref>
>;

type WikiDocDetailResult = {
  parsed: ParsedInternalWikiHref;
  detail: WikiDocDetail;
};

export async function getWikiDocDetailByHref(
  rawHref: string,
): Promise<WikiDocDetailResult | null> {
  const parsed = parseInternalWikiHref(rawHref);

  if (!parsed) {
    return null;
  }

  let detail = wikiDocDetailCache.get(parsed.baseDocKey);

  const hasBasicMeta =
    !!detail &&
    (
      detail.title !== undefined ||
      detail.path !== undefined ||
      detail.tags !== undefined
    );

  if (!detail || !hasBasicMeta) {
    const query = new URLSearchParams();

    if (parsed.idParam) {
      query.set('id', parsed.idParam);
    } else {
      if (parsed.pathParam) {
        query.set('path', parsed.pathParam);
      }

      if (parsed.titleParam) {
        query.set('title', parsed.titleParam);
      }
    }

    if (![...query.keys()].length) {
      return null;
    }

    const response = await fetch(
      `/api/documents?${query.toString()}`,
      {
        cache: 'force-cache',
      },
    );

    if (!response.ok) {
      return null;
    }

    const responseText = await response.text();

    if (!responseText) {
      return null;
    }

    const data = JSON.parse(responseText);
    const rawContent = (data as any).content;

    let slateContent: any[] = [];

    try {
      slateContent =
        typeof rawContent === 'string'
          ? JSON.parse(rawContent)
          : Array.isArray(rawContent)
            ? rawContent
            : [];
    } catch {
      slateContent = [];
    }

    let headingsMeta: WikiDocHeadingMeta[] = [];

    try {
      const headings = extractHeadings(
        Array.isArray(slateContent)
          ? slateContent
          : [],
      );

      headingsMeta = headings.map((heading: any) => ({
        id: String(heading.id ?? ''),
        icon: heading.icon ?? null,
      }));
    } catch {
      headingsMeta = [];
    }

    detail = {
      icon:
        String((data as any).icon ?? '').trim() ||
        null,

      title:
        String((data as any).title ?? '').trim() ||
        parsed.titleParam ||
        null,

      tags: Array.isArray((data as any).tags)
        ? (data as any).tags
            .map((tag: any) =>
              String(tag ?? '').trim(),
            )
            .filter(Boolean)
        : [],

      path:
        (data as any).path ??
        parsed.pathParam ??
        null,

      headings: headingsMeta,
    };

    wikiDocDetailCache.set(
      parsed.baseDocKey,
      detail,
    );
  }

  return {
    parsed,
    detail,
  };
}