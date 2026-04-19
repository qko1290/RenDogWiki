// =============================================
// File: app/wiki/lib/viewSource.ts
// (전체 코드)
// - 다음 1회 문서 조회의 유입 source를 sessionStorage에 잠깐 저장
// - 실제 조회수 전송 시 consume 해서 사용
// =============================================

export type DocViewSource = 'category' | 'search' | 'link' | 'other';

const KEY = 'rdwiki:next-doc-view-source';
const TTL_MS = 15_000;

type StoredPayload = {
  source: DocViewSource;
  expiresAt: number;
};

const ALLOWED = new Set<DocViewSource>(['category', 'search', 'link', 'other']);

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function normalizeSource(raw: unknown): DocViewSource {
  const value = String(raw ?? '').trim() as DocViewSource;
  return ALLOWED.has(value) ? value : 'other';
}

export function markNextDocViewSource(source: DocViewSource) {
  if (!canUseSessionStorage()) return;

  const payload: StoredPayload = {
    source: normalizeSource(source),
    expiresAt: Date.now() + TTL_MS,
  };

  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {}
}

export function consumeNextDocViewSource(fallback: DocViewSource = 'other'): DocViewSource {
  if (!canUseSessionStorage()) return fallback;

  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return fallback;

    window.sessionStorage.removeItem(KEY);

    const parsed = JSON.parse(raw) as Partial<StoredPayload>;
    const source = normalizeSource(parsed?.source);
    const expiresAt = Number(parsed?.expiresAt ?? 0);

    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      return fallback;
    }

    return source;
  } catch {
    return fallback;
  }
}