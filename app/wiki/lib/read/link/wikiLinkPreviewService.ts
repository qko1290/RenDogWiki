import {
  getWikiDocDetailByHref,
} from '@/components/wiki-render/link/wikiDocDetailService';

import {
  parseInternalWikiHref,
} from '@/components/wiki-render/link/linkUtils';

import type {
  WikiCategoryRow,
  WikiLinkPreviewData,
} from './types';

const WIKI_LINK_PREVIEW_CACHE_KEY =
  '__rdwiki_doc_preview_cache__';

const WIKI_CATEGORY_ROWS_KEY =
  '__rdwiki_category_rows__';

const WIKI_CATEGORY_LABEL_CACHE_KEY =
  '__rdwiki_category_label_cache__';

const wikiLinkPreviewCache: Map<
  string,
  WikiLinkPreviewData
> =
  (globalThis as any)[WIKI_LINK_PREVIEW_CACHE_KEY] ??
  new Map<string, WikiLinkPreviewData>();

(globalThis as any)[WIKI_LINK_PREVIEW_CACHE_KEY] =
  wikiLinkPreviewCache;

let wikiCategoryRows: WikiCategoryRow[] | null =
  (globalThis as any)[WIKI_CATEGORY_ROWS_KEY] ??
  null;

const wikiCategoryLabelCache: Map<string, string> =
  (globalThis as any)[
    WIKI_CATEGORY_LABEL_CACHE_KEY
  ] ?? new Map<string, string>();

(globalThis as any)[WIKI_CATEGORY_LABEL_CACHE_KEY] =
  wikiCategoryLabelCache;

function setWikiCategoryRows(
  rows: WikiCategoryRow[],
) {
  wikiCategoryRows = rows;

  (globalThis as any)[WIKI_CATEGORY_ROWS_KEY] =
    rows;
}

async function getWikiCategoryRows(): Promise<
  WikiCategoryRow[]
> {
  if (wikiCategoryRows) {
    return wikiCategoryRows;
  }

  const response = await fetch('/api/categories', {
    cache: 'force-cache',
  });

  if (!response.ok) {
    return [];
  }

  const responseText = await response.text();
  const data = responseText
    ? JSON.parse(responseText)
    : [];

  const rows: WikiCategoryRow[] =
    Array.isArray(data)
      ? data
          .map((row: any) => ({
            id: Number(row?.id),

            name: String(
              row?.name ?? '',
            ).trim(),

            parent_id:
              row?.parent_id == null ||
              row?.parent_id === ''
                ? null
                : Number(row.parent_id),
          }))
          .filter(
            (row: WikiCategoryRow) =>
              Number.isFinite(row.id) &&
              row.name.length > 0,
          )
      : [];

  setWikiCategoryRows(rows);

  return rows;
}

function resolveWikiCategoryLabel(
  pathValue:
    | string
    | number
    | null
    | undefined,
  rows: WikiCategoryRow[],
) {
  if (pathValue == null) {
    return '루트';
  }

  const raw = String(pathValue).trim();

  if (!raw || raw === '0') {
    return '루트';
  }

  const cached =
    wikiCategoryLabelCache.get(raw);

  if (cached) {
    return cached;
  }

  if (!/^\d+$/.test(raw)) {
    wikiCategoryLabelCache.set(raw, raw);
    return raw;
  }

  const startId = Number(raw);

  const byId = new Map<number, WikiCategoryRow>(
    rows.map((row) => [
      Number(row.id),
      row,
    ]),
  );

  const names: string[] = [];
  const seen = new Set<number>();

  let current = byId.get(startId);

  while (
    current &&
    !seen.has(current.id)
  ) {
    seen.add(current.id);

    if (current.name) {
      names.push(current.name);
    }

    const parentId =
      current.parent_id == null ||
      !Number.isFinite(
        Number(current.parent_id),
      )
        ? null
        : Number(current.parent_id);

    if (parentId == null) {
      break;
    }

    current = byId.get(parentId);
  }

  const label =
    names.reverse().join(' / ') || raw;

  wikiCategoryLabelCache.set(raw, label);

  return label;
}

export async function getWikiLinkPreviewData(
  rawHref: string,
): Promise<WikiLinkPreviewData | null> {
  const parsed =
    parseInternalWikiHref(rawHref);

  if (!parsed) {
    return null;
  }

  const cached =
    wikiLinkPreviewCache.get(
      parsed.baseDocKey,
    );

  if (cached) {
    return cached;
  }

  const loaded =
    await getWikiDocDetailByHref(rawHref);

  if (!loaded) {
    return null;
  }

  const rows =
    await getWikiCategoryRows();

  const preview: WikiLinkPreviewData = {
    icon:
      loaded.detail.icon ??
      null,

    categoryLabel:
      resolveWikiCategoryLabel(
        loaded.detail.path ??
          loaded.parsed.pathParam,
        rows,
      ),

    title:
      loaded.detail.title?.trim() ||
      loaded.parsed.titleParam ||
      '문서',

    tags: Array.isArray(
      loaded.detail.tags,
    )
      ? loaded.detail.tags
          .map((tag) =>
            String(tag ?? '').trim(),
          )
          .filter(Boolean)
          .slice(0, 3)
      : [],
  };

  wikiLinkPreviewCache.set(
    parsed.baseDocKey,
    preview,
  );

  return preview;
}