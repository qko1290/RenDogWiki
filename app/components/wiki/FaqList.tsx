// =============================================
// File: app/components/wiki/FaqList.tsx
// (전체 코드)
// - 로직 유지
// - FAQ 목록 / 상세 모달 / 검색창 / 페이징 / 메뉴에 다크모드 적용
// =============================================
'use client';

import { useEffect, useMemo, useState } from 'react';
import FaqUpsertModal from '@/components/wiki/FaqUpsertModal';

type User = {
  id: number;
  username: string;
  minecraft_name: string;
  email: string;
} | null;

export type FaqItem = {
  id: number;
  title: string;
  content: string;
  tags: string[];
  uploader: string;
  created_at?: string;
  updated_at?: string;
};

/** 권한 플래그: canWrite(작성 가능), isAdmin(관리자 전용 UI) */
function useAuthFlags(user: User) {
  const [flags, setFlags] = useState({
    canWrite: false,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user) {
          setFlags({ canWrite: false, isAdmin: false, loading: false });
          return;
        }
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        const me = r.ok ? await r.json() : null;

        const role = (me?.role ?? me?.user?.role ?? '').toLowerCase?.() || '';
        const roles: string[] = (
          me?.roles ??
          me?.user?.roles ??
          me?.permissions ??
          me?.user?.permissions ??
          []
        ).map((v: any) => String(v).toLowerCase());

        const isAdmin = role === 'admin' || roles.includes('admin');
        const canWrite = isAdmin || role === 'writer' || roles.includes('writer');

        if (!cancelled) setFlags({ canWrite, isAdmin, loading: false });
      } catch {
        if (!cancelled) {
          setFlags({ canWrite: false, isAdmin: false, loading: false });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return flags;
}

// ────────────────────────────────────────────────────────────
// 단건 조회 유틸: 항상 최신값을 가져오도록 no-store
// ────────────────────────────────────────────────────────────
export async function fetchFaqDetail(id: number): Promise<FaqItem | null> {
  try {
    const r = await fetch(`/api/faq/${id}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

export function FaqDetailModal({
  sel,
  onClose,
}: {
  sel: FaqItem;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="faq-modal-backdrop"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div className="faq-modal" onClick={(e) => e.stopPropagation()}>
          <div className="faq-modal-header">
            <div className="faq-modal-title">
              <span className="faq-qa q">Q</span>
              <h3>{sel.title}</h3>
            </div>
            <button className="faq-modal-close" onClick={onClose} aria-label="close">
              <svg
                className="x-ic"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
              >
                <path d="M6 6L18 18M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="faq-modal-body">
            <div className="qa-line a">
              <span className="faq-qa a">A</span>
              <pre className="qa-text">{sel.content}</pre>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .faq-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: grid;
          place-items: center;
          padding: 16px;
          z-index: 1000;
        }

        .faq-modal {
          width: min(760px, 100%);
          background: var(--surface-elevated, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 20px;
          padding: 18px 18px 20px;
          box-shadow: var(--shadow-xl, 0 24px 80px rgba(0, 0, 0, 0.28));
          color: var(--foreground, #0f172a);
        }

        .faq-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .faq-modal-title {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .faq-modal-title h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          color: var(--foreground, #0f172a);
          min-width: 0;
          word-break: break-word;
          line-height: 1.4;
        }

        .faq-modal-close {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          background: transparent;
          border: 0;
          border-radius: 10px;
          color: #ef4444;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease;
          flex: 0 0 36px;
        }

        .faq-modal-close:hover {
          transform: scale(1.06);
          background: var(--surface-soft, #f3f4f6);
        }

        .faq-modal-close:focus {
          outline: none;
        }

        .faq-modal-close .x-ic {
          width: 18px;
          height: 18px;
        }

        .faq-modal-body {
          display: grid;
          gap: 10px;
          margin-top: 6px;
        }

        .faq-qa {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          font-weight: 900;
          font-size: 13.5px;
          line-height: 1;
          vertical-align: middle;
          transform: translateY(-1px);
          flex: 0 0 22px;
        }

        .faq-qa.q {
          background: rgba(59, 130, 246, 0.12);
          color: #1d4ed8;
        }

        .faq-qa.a {
          background: rgba(239, 68, 68, 0.12);
          color: #dc2626;
        }

        .qa-line {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          border-radius: 12px;
          padding: 12px 14px;
        }

        .qa-line.a {
          background: rgba(239, 68, 68, 0.06);
          border: 1px solid rgba(239, 68, 68, 0.14);
        }

        .qa-text {
          margin: 0;
          white-space: pre-wrap;
          font: inherit;
          color: var(--foreground, #111827);
          font-size: 14px;
          line-height: 1.6;
        }

        [data-theme='dark'] .faq-qa.q {
          background: rgba(96, 165, 250, 0.18);
          color: #93c5fd;
        }

        [data-theme='dark'] .faq-qa.a {
          background: rgba(248, 113, 113, 0.18);
          color: #fca5a5;
        }

        [data-theme='dark'] .qa-line.a {
          background: rgba(248, 113, 113, 0.08);
          border-color: rgba(248, 113, 113, 0.18);
        }

        @media (max-width: 768px) {
          .faq-modal-backdrop {
            padding: 10px;
          }

          .faq-modal {
            width: min(100%, 340px);
            border-radius: 14px;
            padding: 12px 12px 14px;
          }

          .faq-modal-header {
            gap: 8px;
            margin-bottom: 6px;
          }

          .faq-modal-title {
            gap: 8px;
          }

          .faq-modal-title h3 {
            font-size: 12px;
            line-height: 1.35;
          }

          .faq-modal-close {
            width: 30px;
            height: 30px;
            flex: 0 0 30px;
          }

          .faq-modal-close .x-ic {
            width: 14px;
            height: 14px;
          }

          .faq-qa {
            width: 18px;
            height: 18px;
            font-size: 10px;
            flex: 0 0 18px;
          }

          .qa-line {
            gap: 8px;
            padding: 8px 9px;
            border-radius: 10px;
          }

          .qa-text {
            font-size: 12px;
            line-height: 1.5;
          }
        }
      `}</style>
    </>
  );
}

export default function FaqList({
  query = '',
  tags = [],
  user,
  refreshSignal = 0,
}: {
  query?: string;
  tags?: string[];
  user: User;
  refreshSignal?: number;
}) {
  const { canWrite, isAdmin } = useAuthFlags(user);

  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<FaqItem | null>(null);
  const [editTarget, setEditTarget] = useState<FaqItem | null>(null);

  const [menu, setMenu] = useState<{
    open: boolean;
    id: number | null;
    x: number;
    y: number;
  }>({
    open: false,
    id: null,
    x: 0,
    y: 0,
  });

  const [bottomSearch, setBottomSearch] = useState('');
  const [page, setPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const PAGE_SIZE = isMobile ? 10 : 12;
  const MAX_VISIBLE_PAGE_BTNS = isMobile ? 5 : Number.MAX_SAFE_INTEGER;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsMobile(mq.matches);

    apply();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }

    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);

  const normalizedBottomSearch = bottomSearch.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedBottomSearch) return items;

    return items.filter((it) => {
      const title = (it.title ?? '').toLowerCase();
      const content = (it.content ?? '').toLowerCase();
      const tagsText = Array.isArray(it.tags) ? it.tags.join(' ').toLowerCase() : '';
      const uploader = (it.uploader ?? '').toLowerCase();

      return (
        title.includes(normalizedBottomSearch) ||
        content.includes(normalizedBottomSearch) ||
        tagsText.includes(normalizedBottomSearch) ||
        uploader.includes(normalizedBottomSearch)
      );
    });
  }, [items, normalizedBottomSearch]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));

  const viewItems = useMemo(
    () => filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredItems, page, PAGE_SIZE]
  );

  const visiblePageNumbers = useMemo(() => {
    if (!isMobile || pageCount <= MAX_VISIBLE_PAGE_BTNS) {
      return Array.from({ length: pageCount }, (_, i) => i);
    }

    const half = Math.floor(MAX_VISIBLE_PAGE_BTNS / 2);
    let start = Math.max(0, page - half);
    let end = start + MAX_VISIBLE_PAGE_BTNS - 1;

    if (end >= pageCount) {
      end = pageCount - 1;
      start = Math.max(0, end - MAX_VISIBLE_PAGE_BTNS + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [isMobile, page, pageCount, MAX_VISIBLE_PAGE_BTNS]);

  useEffect(() => {
    const maxIdx = Math.max(0, Math.ceil(filteredItems.length / PAGE_SIZE) - 1);
    if (page > maxIdx) setPage(0);
  }, [filteredItems, page, PAGE_SIZE]);

  useEffect(() => {
    setPage(0);
  }, [bottomSearch, isMobile]);

  const qs = useMemo(() => {
    const usp = new URLSearchParams();
    if (query) usp.set('q', query);
    if (tags?.length) usp.set('tags', tags.join(','));
    return usp.toString();
  }, [query, tags]);

  async function refresh() {
    setLoading(true);
    try {
      const limit = 100;
      let offset = 0;
      let all: FaqItem[] = [];

      const MAX_ROUNDS = 200;
      let rounds = 0;

      while (rounds < MAX_ROUNDS) {
        const r = await fetch(
          `/api/faq?${qs}${qs ? '&' : ''}limit=${limit}&offset=${offset}`,
          { cache: 'no-store' }
        );

        const data = r.ok ? await r.json() : null;
        const chunk = Array.isArray(data?.items) ? (data.items as FaqItem[]) : [];

        all = all.concat(chunk);

        if (chunk.length < limit) break;

        offset += limit;
        rounds += 1;
      }

      setItems(all);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!menu.open) return;

    const close = () => setMenu({ open: false, id: null, x: 0, y: 0 });

    const onPointer = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest('.faq-popover') && !el?.closest('.faq-menu-btn')) close();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', onPointer, true);
    document.addEventListener('touchstart', onPointer, true);
    document.addEventListener('scroll', onPointer, true);
    window.addEventListener('resize', close, { passive: true });
    window.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', onPointer, true);
      document.removeEventListener('touchstart', onPointer, true);
      document.removeEventListener('scroll', onPointer, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu.open]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  useEffect(() => {
    if (refreshSignal) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제할까요?')) return;
    const r = await fetch(`/api/faq/${id}`, { method: 'DELETE' });
    if (r.ok) refresh();
  };

  return (
    <div className="faq-wrap">
      <div className="faq-list-card">
        {loading ? (
          <div className="faq-row muted">불러오는 중…</div>
        ) : filteredItems.length === 0 ? (
          <div className="faq-row muted">
            {bottomSearch.trim() ? '검색 결과가 없습니다.' : '등록된 질문이 없습니다.'}
          </div>
        ) : (
          viewItems.map((it) => (
            <div key={it.id} className="faq-row">
              <button
                className="faq-title"
                onClick={async () => {
                  const fresh = await fetchFaqDetail(it.id);
                  setSel(fresh ?? it);
                }}
                title={it.title}
              >
                <span className="faq-q">Q</span>
                <span className="faq-title-text">{it.title}</span>
              </button>

              {isAdmin && (
                <div className="faq-menu" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="faq-menu-btn"
                    aria-label="more"
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const x = Math.min(
                        window.innerWidth - 100 - 8,
                        Math.max(8, rect.right - 100)
                      );
                      const y = rect.bottom + 6;

                      setMenu((m) => ({
                        open: !(m.open && m.id === it.id),
                        id: it.id,
                        x,
                        y,
                      }));
                    }}
                    aria-expanded={menu.open && menu.id === it.id}
                    type="button"
                  >
                    ⋯
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="faq-between-spacer" aria-hidden="true" />

      {menu.open && (
        <div
          className="faq-menu-pop faq-popover open"
          style={{
            position: 'fixed',
            left: Math.max(10, menu.x),
            top: menu.y,
            zIndex: 2000,
            minWidth: 100,
            width: 100,
          }}
          role="menu"
        >
          <button
            role="menuitem"
            onClick={async () => {
              const id = menu.id!;
              setMenu({ open: false, id: null, x: 0, y: 0 });
              const fresh = await fetchFaqDetail(id);
              setEditTarget(fresh ?? items.find((i) => i.id === id) ?? null);
            }}
            type="button"
          >
            수정
          </button>
          <button
            role="menuitem"
            className="danger"
            onClick={() => {
              const id = menu.id!;
              setMenu({ open: false, id: null, x: 0, y: 0 });
              handleDelete(id);
            }}
            type="button"
          >
            삭제
          </button>
        </div>
      )}

      {pageCount > 1 && (
        <div className="faq-paging">
          <div className="faq-paging-seg">
            <button
              className="faq-page-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              type="button"
              aria-label="이전 페이지"
            >
              <svg
                className="ico"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <ul className="faq-pages">
              {visiblePageNumbers.map((i) => (
                <li key={i}>
                  <button
                    className={`faq-page ${i === page ? 'active' : ''}`}
                    onClick={() => setPage(i)}
                    type="button"
                  >
                    {i + 1}
                  </button>
                </li>
              ))}
            </ul>

            <button
              className="faq-page-btn next"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page === pageCount - 1}
              type="button"
              aria-label="다음 페이지"
            >
              <svg
                className="ico"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="faq-bottom-search">
        <div className="faq-search-box">
          <svg
            className="faq-search-ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>

          <input
            type="text"
            value={bottomSearch}
            onChange={(e) => setBottomSearch(e.target.value)}
            placeholder="목록 내 검색"
            aria-label="FAQ 목록 내 검색"
          />

          {bottomSearch && (
            <button
              type="button"
              className="faq-search-clear"
              onClick={() => setBottomSearch('')}
              aria-label="검색어 지우기"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {sel && <FaqDetailModal sel={sel} onClose={() => setSel(null)} />}

      {editTarget && (
        <FaqUpsertModal
          open
          mode="edit"
          initial={{
            id: editTarget.id,
            title: editTarget.title,
            content: editTarget.content,
            tags: editTarget.tags,
          }}
          onClose={() => setEditTarget(null)}
          onSaved={async () => {
            setEditTarget(null);
            await refresh();
            if (sel?.id) {
              const fresh = await fetchFaqDetail(sel.id);
              if (fresh) setSel(fresh);
            }
          }}
        />
      )}

      <style jsx>{`
        .faq-wrap {
          padding-top: 12px;
          display: flex;
          flex-direction: column;
          min-height: calc(52px * 12 + 64px + 32px);
        }

        .faq-list-card {
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 14px;
          padding: 6px;
          background: var(--surface-elevated, #fff);
          box-shadow: var(--shadow-sm, 0 8px 24px rgba(16, 24, 40, 0.04));
        }

        .faq-between-spacer {
          flex: 1 1 auto;
          min-height: 12px;
        }

        .faq-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-top: 1px solid var(--border, #eef0f2);
          gap: 12px;
          transition: background 0.15s ease;
        }

        .faq-row:first-child {
          border-top: 0;
        }

        .faq-row.muted {
          color: var(--muted, #888);
        }

        .faq-row:hover {
          background: var(--surface-soft, #f8fafc);
        }

        .faq-title {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 700;
          background: none;
          border: 0;
          padding: 2px 0;
          cursor: pointer;
          text-align: left;
          flex: 1 1 auto;
          color: var(--foreground, #0f172a);
          min-width: 0;
        }

        .faq-q {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.12);
          color: #1d4ed8;
          font-weight: 900;
          font-size: 13.5px;
          line-height: 1;
          vertical-align: middle;
          transform: translateY(-1px);
          flex: 0 0 22px;
        }

        .faq-title-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .faq-menu {
          position: relative;
        }

        .faq-menu-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--surface, #fff);
          color: var(--foreground, #0f172a);
          cursor: pointer;
          font-size: 20px;
          line-height: 0;
          display: grid;
          place-items: center;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }

        .faq-menu-btn:hover {
          background: var(--surface-soft, #f3f4f6);
        }

        .faq-menu-pop {
          position: absolute;
          right: 0;
          top: 38px;
          min-width: 140px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 10px;
          background: var(--surface-elevated, #fff);
          box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.08));
          padding: 6px;
          display: none;
          z-index: 10;
        }

        .faq-menu-pop.open {
          display: block;
        }

        .faq-menu-pop button {
          width: 100%;
          text-align: left;
          padding: 8px 10px;
          background: none;
          border: 0;
          border-radius: 8px;
          cursor: pointer;
          color: var(--foreground, #0f172a);
        }

        .faq-menu-pop button:hover {
          background: var(--surface-soft, #f3f4f6);
        }

        .faq-menu-pop .danger {
          color: #ef4444;
        }

        .toolbar-seg,
        .faq-paging-seg {
          display: inline-flex;
          align-items: stretch;
          background: var(--surface-elevated, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.02));
        }

        .seg-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border: 0;
          background: transparent;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--foreground, #4b5563);
          line-height: 1;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }

        .seg-btn .ico,
        .faq-page-btn .ico {
          width: 20px;
          height: 20px;
        }

        .seg-btn:hover {
          background: var(--surface-soft, #f3f4f6);
        }

        .seg-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .faq-paging {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          margin-top: 0;
        }

        .faq-page-btn,
        .faq-page {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 14px;
          border: 0;
          background: transparent;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--foreground, #4b5563);
          line-height: 1;
          transition: background 0.15s, color 0.15s;
          min-width: 44px;
          height: 38px;
        }

        .faq-page-btn:hover,
        .faq-page:hover {
          background: var(--surface-soft, #f3f4f6);
        }

        .faq-page-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .faq-pages {
          display: flex;
          list-style: none;
          padding: 0;
          margin: 0;
          flex-wrap: wrap;
          justify-content: center;
          max-width: 720px;
        }

        .faq-pages li + li .faq-page {
          border-left: 1px solid var(--border, #e5e7eb);
        }

        .faq-page-btn:first-child {
          border-right: 1px solid var(--border, #e5e7eb);
        }

        .faq-page-btn.next {
          border-left: 1px solid var(--border, #e5e7eb);
        }

        .faq-page.active {
          color: #1d4ed8;
          background: rgba(59, 130, 246, 0.12);
        }

        .faq-bottom-search {
          display: flex;
          justify-content: center;
          margin-top: 10px;
        }

        .faq-search-box {
          width: min(520px, 100%);
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--surface-elevated, #fff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 12px;
          padding: 10px 12px;
          box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.02));
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .faq-search-box:focus-within {
          border-color: rgba(79, 70, 229, 0.35);
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.08);
        }

        .faq-search-ico {
          width: 18px;
          height: 18px;
          color: var(--muted, #94a3b8);
          flex: 0 0 18px;
        }

        .faq-search-box input {
          flex: 1 1 auto;
          border: 0;
          outline: none;
          background: transparent;
          font-size: 14px;
          color: var(--foreground, #0f172a);
          min-width: 0;
        }

        .faq-search-box input::placeholder {
          color: var(--muted, #94a3b8);
        }

        .faq-search-clear {
          width: 24px;
          height: 24px;
          border: 0;
          border-radius: 999px;
          background: var(--surface-soft, #f3f4f6);
          color: var(--muted, #64748b);
          cursor: pointer;
          display: grid;
          place-items: center;
          font-size: 16px;
          line-height: 1;
          flex: 0 0 24px;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .faq-search-clear:hover {
          background: var(--surface, #e5e7eb);
          color: var(--foreground, #334155);
        }

        [data-theme='dark'] .faq-q {
          background: rgba(96, 165, 250, 0.18);
          color: #93c5fd;
        }

        [data-theme='dark'] .faq-page.active {
          color: #93c5fd;
          background: rgba(96, 165, 250, 0.18);
        }

        @media (max-width: 768px) {
          .faq-wrap {
            padding-top: 8px;
            min-height: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
          }

          .faq-list-card {
            border-radius: 12px;
            padding: 4px;
            flex: 0 0 auto;
          }

          .faq-between-spacer {
            flex: 1 1 auto;
            min-height: 8px;
          }

          .faq-row {
            padding: 4px 10px;
            gap: 8px;
          }

          .faq-title {
            gap: 8px;
            font-size: 12px;
            line-height: 1.35;
          }

          .faq-q {
            width: 18px;
            height: 18px;
            font-size: 10px;
            flex: 0 0 18px;
          }

          .faq-menu-btn {
            width: 28px;
            height: 28px;
            font-size: 16px;
            flex: 0 0 28px;
          }

          .faq-paging {
            position: fixed;
            left: 50%;
            transform: translateX(-50%);
            bottom: 52px;
            z-index: 30;
            min-height: 38px;
            margin-top: 0;
            padding-top: 0;
            background: transparent;
          }

          .faq-bottom-search {
            position: fixed;
            left: 50%;
            transform: translateX(-50%);
            bottom: 8px;
            z-index: 31;
            width: calc(100% - 24px);
            max-width: 420px;
            margin-top: 0;
            padding-top: 0;
            padding-bottom: 0;
            background: transparent;
          }

          .faq-paging-seg {
            border-radius: 10px;
          }

          .faq-page-btn,
          .faq-page {
            min-width: 34px;
            height: 32px;
            padding: 6px 8px;
            font-size: 12px;
          }

          .faq-page-btn .ico {
            width: 16px;
            height: 16px;
          }

          .faq-pages {
            max-width: none;
            flex-wrap: nowrap;
          }

          .faq-search-box {
            border-radius: 10px;
            padding: 8px 10px;
            gap: 8px;
          }

          .faq-search-ico {
            width: 16px;
            height: 16px;
            flex: 0 0 16px;
          }

          .faq-search-box input {
            font-size: 12px;
          }

          .faq-search-clear {
            width: 22px;
            height: 22px;
            font-size: 14px;
            flex: 0 0 22px;
          }

          .faq-wrap {
            padding-bottom: 110px;
          }

          .faq-wrap {
            padding-bottom: 110px;
          }
        }
      `}</style>
    </div>
  );
}