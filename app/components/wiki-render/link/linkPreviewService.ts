import { extractHeadings } from '@/wiki/lib/extractHeadings';
import type {
  WikiCategoryRow,
  WikiDocDetail,
  WikiDocHeadingMeta,
  WikiLinkPreviewData,
} from './types';
import { parseInternalWikiHref } from './linkUtils';

const WIKI_DOC_DETAIL_CACHE_KEY = '__rdwiki_doc_detail_cache__';
const WIKI_LINK_PREVIEW_CACHE_KEY = '__rdwiki_doc_preview_cache__';
const WIKI_CATEGORY_ROWS_KEY = '__rdwiki_category_rows__';
const WIKI_CATEGORY_LABEL_CACHE_KEY = '__rdwiki_category_label_cache__';

const wikiDocDetailCache: Map<string, WikiDocDetail> =
  (globalThis as any)[WIKI_DOC_DETAIL_CACHE_KEY] ??
  new Map<string, WikiDocDetail>();
(globalThis as any)[WIKI_DOC_DETAIL_CACHE_KEY] = wikiDocDetailCache;

const wikiLinkPreviewCache: Map<string, WikiLinkPreviewData> =
  (globalThis as any)[WIKI_LINK_PREVIEW_CACHE_KEY] ??
  new Map<string, WikiLinkPreviewData>();
(globalThis as any)[WIKI_LINK_PREVIEW_CACHE_KEY] = wikiLinkPreviewCache;

let wikiCategoryRows: WikiCategoryRow[] | null =
  (globalThis as any)[WIKI_CATEGORY_ROWS_KEY] ?? null;

function setWikiCategoryRows(rows: WikiCategoryRow[]) {
  wikiCategoryRows = rows;
  (globalThis as any)[WIKI_CATEGORY_ROWS_KEY] = rows;
}

const wikiCategoryLabelCache: Map<string, string> =
  (globalThis as any)[WIKI_CATEGORY_LABEL_CACHE_KEY] ??
  new Map<string, string>();
(globalThis as any)[WIKI_CATEGORY_LABEL_CACHE_KEY] = wikiCategoryLabelCache;

export async function getWikiDocDetailByHref(rawHref: string): Promise<{
  parsed: NonNullable<ReturnType<typeof parseInternalWikiHref>>;
  detail: WikiDocDetail;
} | null> {
  const parsed = parseInternalWikiHref(rawHref);
  if (!parsed) return null;

  let detail = wikiDocDetailCache.get(parsed.baseDocKey);
  const hasBasicMeta =
    !!detail &&
    (detail.title !== undefined ||
      detail.path !== undefined ||
      detail.tags !== undefined);

  if (!detail || !hasBasicMeta) {
    const qs = new URLSearchParams();

    if (parsed.idParam) {
      qs.set('id', parsed.idParam);
    } else {
      if (parsed.pathParam) qs.set('path', parsed.pathParam);
      if (parsed.titleParam) qs.set('title', parsed.titleParam);
    }

    if (![...qs.keys()].length) return null;

    const res = await fetch(`/api/documents?${qs.toString()}`, {
      cache: 'force-cache',
    });

    if (!res.ok) return null;

    const text = await res.text();
    if (!text) return null;

    const data = JSON.parse(text);
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
      const headings = extractHeadings(Array.isArray(slateContent) ? slateContent : []);

      headingsMeta = headings.map((heading: any) => ({
        id: String(heading.id ?? ''),
        icon: heading.icon ?? null,
      }));
    } catch {
      headingsMeta = [];
    }

    detail = {
      icon: ((data as any).icon ?? '').trim() || null,
      title: ((data as any).title ?? '').trim() || parsed.titleParam || null,
      tags: Array.isArray((data as any).tags)
        ? (data as any).tags
            .map((tag: any) => String(tag ?? '').trim())
            .filter(Boolean)
        : [],
      path: (data as any).path ?? parsed.pathParam ?? null,
      headings: headingsMeta,
    };

    wikiDocDetailCache.set(parsed.baseDocKey, detail);
  }

  return {
    parsed,
    detail,
  };
}

export async function getWikiCategoryRows(): Promise<WikiCategoryRow[]> {
  if (wikiCategoryRows) return wikiCategoryRows;

  const res = await fetch('/api/categories', {
    cache: 'force-cache',
  });

  if (!res.ok) return [];

  const text = await res.text();
  const data = text ? JSON.parse(text) : [];

  const rows: WikiCategoryRow[] = Array.isArray(data)
    ? data
        .map((row: any) => ({
          id: Number(row?.id),
          name: String(row?.name ?? '').trim(),
          parent_id:
            row?.parent_id == null || row?.parent_id === ''
              ? null
              : Number(row.parent_id),
        }))
        .filter((row) => Number.isFinite(row.id) && row.name.length > 0)
    : [];

  setWikiCategoryRows(rows);
  return rows;
}

export function resolveWikiCategoryLabel(
  pathValue: string | number | null | undefined,
  rows: WikiCategoryRow[],
) {
  if (pathValue == null) return '루트';

  const raw = String(pathValue).trim();
  if (!raw || raw === '0') return '루트';

  const cached = wikiCategoryLabelCache.get(raw);
  if (cached) return cached;

  if (!/^\d+$/.test(raw)) {
    wikiCategoryLabelCache.set(raw, raw);
    return raw;
  }

  const startId = Number(raw);
  const byId = new Map<number, WikiCategoryRow>(
    rows.map((row) => [Number(row.id), row]),
  );

  const names: string[] = [];
  const seen = new Set<number>();
  let current = byId.get(startId);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);

    if (current.name) names.push(current.name);

    const parentId =
      current.parent_id == null || !Number.isFinite(Number(current.parent_id))
        ? null
        : Number(current.parent_id);

    if (parentId == null) break;

    current = byId.get(parentId);
  }

  const label = names.reverse().join(' / ') || raw;
  wikiCategoryLabelCache.set(raw, label);

  return label;
}

export async function getWikiLinkPreviewData(
  rawHref: string,
): Promise<WikiLinkPreviewData | null> {
  const parsed = parseInternalWikiHref(rawHref);
  if (!parsed) return null;

  const cached = wikiLinkPreviewCache.get(parsed.baseDocKey);
  if (cached) return cached;

  const loaded = await getWikiDocDetailByHref(rawHref);
  if (!loaded) return null;

  const rows = await getWikiCategoryRows();

  const preview: WikiLinkPreviewData = {
    icon: loaded.detail.icon ?? null,
    categoryLabel: resolveWikiCategoryLabel(
      loaded.detail.path ?? loaded.parsed.pathParam,
      rows,
    ),
    title:
      loaded.detail.title?.trim() ||
      loaded.parsed.titleParam ||
      '문서',
    tags: Array.isArray(loaded.detail.tags)
      ? loaded.detail.tags
          .map((tag) => String(tag ?? '').trim())
          .filter(Boolean)
          .slice(0, 3)
      : [],
  };

  wikiLinkPreviewCache.set(parsed.baseDocKey, preview);

  return preview;
}
