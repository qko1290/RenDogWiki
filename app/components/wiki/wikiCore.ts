// =============================================
// File: app/components/wiki/wikiCore.ts
// =============================================

export const MODE_PARAM = 'mode';
export const MODE_STORAGE = 'wiki:mode';
export const MODE_EVENT = 'wiki-mode-change';
export const MODE_WHITELIST = new Set(['RPG', '렌독런', '마인팜', '부엉이타운']);

export const ROOT_FEATURED_DOC_ID = 73;

export function pathToStr(path: number[]) {
  return path.join('/');
}

export function decodeTitleFromUrlParam(v: string | null | undefined) {
  return String(v ?? '').replace(/_/g, ' ');
}

export function encodeTitleForUrlParam(v: string | null | undefined) {
  return String(v ?? '').trim().replace(/\s+/g, '_');
}

export function getInitialMode(): string | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get(MODE_PARAM);
  const fromLs = window.localStorage.getItem(MODE_STORAGE);
  const v = fromUrl ?? fromLs ?? null;
  return v && MODE_WHITELIST.has(v) ? v : null;
}

// no-cache 유틸
export const withTs = (url: string) =>
  url + (url.includes('?') ? '&' : '?') + '_ts=' + Date.now();

export const NC: RequestInit = { cache: 'no-store' };

// ---- Special 파서
export type SpecialMeta =
  | { kind: 'quest' | 'npc' | 'head'; label: string; village: string }
  | { kind: 'faq'; q?: string; tags?: string[] }
  | null;

export function parseSpecial(raw?: string | null): SpecialMeta {
  if (!raw) return null;
  const s = raw.trim();
  const lower = s.toLowerCase();

  if (lower.startsWith('faq') || lower.startsWith('질문') || lower.startsWith('자주')) {
    const after = s.split('/').slice(1).join('/') || '';
    const meta: { q?: string; tags?: string[] } = {};
    if (after.startsWith('tag:'))
      meta.tags = after
        .slice(4)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    if (after.startsWith('q:')) meta.q = after.slice(2).trim();
    return { kind: 'faq', ...meta };
  }

  const [rawKind, ...rest] = s.split(/[\/|｜]/);
  if (!rawKind || rest.length === 0) return null;

  const village = rest.join('/').trim();
  const kindKey = rawKind.trim().toLowerCase();

  let kind: 'quest' | 'npc' | 'head' | null = null;
  if (['퀘스트', 'quest', 'q'].includes(kindKey)) kind = 'quest';
  else if (['npc', '엔피씨'].includes(kindKey)) kind = 'npc';
  else if (['머리', '머리찾기', 'head', 'heads'].includes(kindKey)) kind = 'head';

  if (!kind || !village) return null;

  const label = kind === 'quest' ? '퀘스트' : kind === 'npc' ? 'NPC' : '머리';
  return { kind, label, village };
}