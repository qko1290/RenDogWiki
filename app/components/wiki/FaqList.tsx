// File: app/components/wiki/FaqList.tsx
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
  const [flags, setFlags] = useState({ canWrite: false, isAdmin: false, loading: true });

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
        const roles: string[] = (me?.roles ?? me?.user?.roles ?? me?.permissions ?? me?.user?.permissions ?? [])
          .map((v: any) => String(v).toLowerCase());

        const isAdmin = role === 'admin' || roles.includes('admin');
        const canWrite = isAdmin || role === 'writer' || roles.includes('writer');

        if (!cancelled) setFlags({ canWrite, isAdmin, loading: false });
      } catch {
        if (!cancelled) setFlags({ canWrite: false, isAdmin: false, loading: false });
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
      <div className="faq-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
        <div className="faq-modal" onClick={(e) => e.stopPropagation()}>
          <div className="faq-modal-header">
            <div className="faq-modal-title">
              <span className="faq-qa q">Q</span>
              <h3>{sel.title}</h3>
            </div>
            <button className="faq-modal-close" onClick={onClose} aria-label="close">
              <svg className="x-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
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
          background: #fff;
          border-radius: 20px;
          padding: 18px 18px 20px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
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
        }
        .faq-modal-title h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
        }
        .faq-modal-close {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          background: transparent;
          border: 0;
          border-radius: 0;
          color: #ef4444;
          cursor: pointer;
          transition: transform 0.12s ease;
        }
        .faq-modal-close:hover {
          transform: scale(1.06);
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
          background: #eaf2ff;
          color: #1d4ed8;
        }
        .faq-qa.a {
          background: #ffe9e9;
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
          background: #fff5f5;
          border: 1px solid #ffe2e2;
        }
        .qa-text {
          margin: 0;
          white-space: pre-wrap;
          font: inherit;
          color: #111827;
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
  const { isAdmin } = useAuthFlags(user);
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<FaqItem | null>(null);
  const [editTarget, setEditTarget] = useState<FaqItem | null>(null);

  const [menu, setMenu] = useState<{ open: boolean; id: number | null; x: number; y: number }>({
    open: false,
    id: null,
    x: 0,
    y: 0,
  });

  // --- 페이징 ---
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const viewItems = useMemo(() => items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [items, page]);

  useEffect(() => {
    const maxIdx = Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1);
    if (page > maxIdx) setPage(0);
  }, [items, page]);

  // 서버 쿼리(필터만 반영)
  const qs = useMemo(() => {
    const usp = new URLSearchParams();
    if (query) usp.set('q', query);
    if (tags?.length) usp.set('tags', tags.join(','));
    return usp.toString();
  }, [query, tags]);

  // ✅ 100개 제한이 있어도 전부 로드(100단위 반복 호출)
  async function refresh() {
    setLoading(true);
    try {
      const limit = 100;
      let offset = 0;
      let all: FaqItem[] = [];

      const MAX_ROUNDS = 200; // 20,000개 안전장치
      let rounds = 0;

      while (rounds < MAX_ROUNDS) {
        const r = await fetch(`/api/faq?${qs}${qs ? '&' : ''}limit=${limit}&offset=${offset}`, {
          cache: 'no-store',
        });

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
      {/* 리스트 카드 (✅ 높이 늘리지 않음: 내용만큼만) */}
      <div className="faq-list-card">
        {loading ? (
          <div className="faq-row muted">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="faq-row muted">등록된 질문이 없습니다.</div>
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
                      const x = Math.min(window.innerWidth - 100 - 8, Math.max(8, rect.right - 100));
                      const y = rect.bottom + 6;

                      setMenu((m) => ({
                        open: !(m.open && m.id === it.id),
                        id: it.id,
                        x,
                        y,
                      }));
                    }}
                    aria-expanded={menu.open && menu.id === it.id}
                  >
                    ⋯
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ✅ 카드 밖(바깥) 여백: 질문이 적으면 이게 늘어나서 페이징 위치 고정 */}
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
          >
            삭제
          </button>
        </div>
      )}

      {/* 페이징 (✅ 항상 같은 위치 느낌: wrap의 min-height + spacer로 고정) */}
      {pageCount > 1 && (
        <div className="faq-paging">
          <button className="faq-page-btn" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            ◀
          </button>

          <ul className="faq-pages">
            {Array.from({ length: pageCount }).map((_, i) => (
              <li key={i}>
                <button className={`faq-page ${i === page ? 'active' : ''}`} onClick={() => setPage(i)}>
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>

          <button
            className="faq-page-btn"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
          >
            ▶
          </button>
        </div>
      )}

      {/* 상세 모달(Q/A 뷰) */}
      {sel && <FaqDetailModal sel={sel} onClose={() => setSel(null)} />}

      {/* 수정 모달 */}
      {editTarget && (
        <FaqUpsertModal
          open
          mode="edit"
          initial={{ id: editTarget.id, title: editTarget.title, content: editTarget.content, tags: editTarget.tags }}
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
        /* ✅ wrap 자체를 "고정된 세로 슬롯"으로 만들기 */
        /* - 질문이 적으면 faq-between-spacer가 늘어나고
           - 질문이 많으면 spacer가 줄어들어 0에 수렴
           => 페이징이 항상 같은 위치 근처에 유지됨 */
        .faq-wrap {
          padding-top: 12px;

          display: flex;
          flex-direction: column;

          /* 12줄 + 페이징 공간 + 여유 */
          /* 필요하면 숫자만 조절 */
          min-height: calc(52px * 12 + 64px);
        }

        /* 카드 컨테이너(✅ 내용만큼만) */
        .faq-list-card {
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 14px;
          padding: 6px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(16, 24, 40, 0.04);
        }

        /* ✅ 카드 밖 빈공간(질문 적을 때 여기만 늘어난다) */
        .faq-between-spacer {
          flex: 1 1 auto;
          min-height: 12px; /* 너무 붙어 보이지 않게 최소 간격 */
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
          color: #888;
        }
        .faq-row:hover {
          background: #f8fafc;
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
          color: #0f172a;
        }

        .faq-q {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: #eaf2ff;
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
          background: #fff;
          cursor: pointer;
          font-size: 20px;
          line-height: 0;
          display: grid;
          place-items: center;
          transition: background 0.15s;
        }
        .faq-menu-btn:hover {
          background: #f3f4f6;
        }
        .faq-menu-pop {
          position: absolute;
          right: 0;
          top: 38px;
          min-width: 140px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
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
        }
        .faq-menu-pop button:hover {
          background: #f3f4f6;
        }
        .faq-menu-pop .danger {
          color: #d11;
        }

        /* 페이징 */
        .faq-paging {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;

          /* 페이징 영역 자체 높이 고정(레이아웃 흔들림 방지) */
          min-height: 44px;
          margin-top: 0;
        }
        .faq-page-btn {
          background: none;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .faq-page-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .faq-pages {
          display: flex;
          gap: 6px;
          list-style: none;
          padding: 0;
          margin: 0;

          flex-wrap: wrap;
          justify-content: center;
          max-width: 720px;
        }
        .faq-page {
          min-width: 36px;
          height: 32px;
          padding: 0 8px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
          cursor: pointer;
          font-weight: 600;
        }
        .faq-page.active {
          border-color: #1d4ed8;
          color: #1d4ed8;
          background: #eef5ff;
        }
      `}</style>
    </div>
  );
}