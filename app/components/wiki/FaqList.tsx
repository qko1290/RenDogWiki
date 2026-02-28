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
    return () => { cancelled = true; };
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
            <button
              className="faq-modal-close"
              onClick={onClose}
              aria-label="close"
            >
              <svg
                className="x-ic"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
              >
                <path
                  d="M6 6L18 18M18 6L6 18"
                  strokeLinecap="round"
                />
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
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          display: grid; place-items: center; padding: 16px; z-index: 1000;
        }
        .faq-modal {
          width: min(760px, 100%); background: #fff; border-radius: 20px;
          padding: 18px 18px 20px; box-shadow: 0 24px 80px rgba(0,0,0,0.28);
        }
        .faq-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; margin-bottom: 8px;
        }
        .faq-modal-title { display: inline-flex; align-items: center; gap: 12px; }
        .faq-modal-title h3 { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; }
        .faq-modal-close{
          width: 36px; height: 36px;
          display: grid; place-items: center;
          background: transparent; border: 0; border-radius: 0;
          color: #ef4444;
          cursor: pointer;
          transition: transform .12s ease;
        }
        .faq-modal-close:hover{ transform: scale(1.06); }
        .faq-modal-close:focus{ outline: none; }
        .faq-modal-close .x-ic{ width: 18px; height: 18px; }
        .faq-modal-body { display: grid; gap: 10px; margin-top: 6px; }

        .faq-qa {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 999px;
          font-weight: 900; font-size: 13.5px; line-height: 1; vertical-align: middle;
          transform: translateY(-1px);
          flex: 0 0 22px;
        }
        .faq-qa.q { background: #eaf2ff; color: #1d4ed8; }
        .faq-qa.a { background: #ffe9e9; color: #dc2626; }

        .qa-line {
          display: flex; align-items: flex-start; gap: 12px;
          border-radius: 12px; padding: 12px 14px;
        }
        .qa-line.a {
          background: #fff5f5;
          border: 1px solid #ffe2e2;
        }
        .qa-text { margin: 0; white-space: pre-wrap; font: inherit; color: #111827; }
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

  const [createOpen, setCreateOpen] = useState(false);

  const [menu, setMenu] = useState<{ open: boolean; id: number | null; x: number; y: number }>({
    open: false, id: null, x: 0, y: 0
  });

  // --- 페이징 ---
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const viewItems = useMemo(
    () => items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [items, page]
  );

  // ✅ “질문이 적을 때도” 페이징이 안 올라가게: wrap 높이를 ‘항상 동일’하게 유지
  // - row 실제 높이(디자인 기준)를 넉넉히 잡아서(52)
  // - 카드/페이징/여백을 포함한 높이를 고정(min-height)
  const ROW_PITCH = 52; // 한 줄(패딩 포함) 체감 높이
  const WRAP_BUFFER = 44; // “아주 살짝 위로” 문제 방지용 버퍼

  useEffect(() => {
    const maxIdx = Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1);
    if (page > maxIdx) setPage(0);
  }, [items, page]);

  // 서버 쿼리 (필터만)
  const qs = useMemo(() => {
    const usp = new URLSearchParams();
    if (query) usp.set('q', query);
    if (tags?.length) usp.set('tags', tags.join(','));
    return usp.toString();
  }, [query, tags]);

  async function refresh() {
    setLoading(true);
    try {
      const limit = 100; // 서버 제한 대응
      let offset = 0;
      let all: FaqItem[] = [];

      const MAX_ROUNDS = 200; // 안전장치
      let rounds = 0;

      while (rounds < MAX_ROUNDS) {
        const r = await fetch(`/api/faq?${qs}&limit=${limit}&offset=${offset}`, { cache: 'no-store' });
        const data = r.ok ? await r.json() : null;
        const chunk = Array.isArray(data?.items) ? (data.items as FaqItem[]) : [];

        all = all.concat(chunk);

        // 더 이상 받을 게 없으면 종료
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };

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

  useEffect(() => { refresh(); }, [qs]);
  useEffect(() => { if (refreshSignal) refresh(); }, [refreshSignal]);

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제할까요?')) return;
    const r = await fetch(`/api/faq/${id}`, { method: 'DELETE' });
    if (r.ok) refresh();
  };

  const pagingWindow = useMemo(() => {
    // 페이지가 많아도 버튼이 너무 길어지지 않게 (현재 129개 기준 11페이지 정도라 충분하지만, 안전하게)
    const total = pageCount;
    const cur = page;
    const windowSize = 9; // 가운데 기준으로 9개 정도
    if (total <= windowSize) return Array.from({ length: total }, (_, i) => i);

    const half = Math.floor(windowSize / 2);
    let start = Math.max(0, cur - half);
    let end = Math.min(total - 1, start + windowSize - 1);
    start = Math.max(0, end - windowSize + 1);

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, pageCount]);

  return (
    <div
      className="faq-wrap"
      style={{
        minHeight: `calc(${ROW_PITCH}px * ${PAGE_SIZE} + 64px + ${WRAP_BUFFER}px)`,
      }}
    >
      {/* 상단 버튼 영역: 질문 추가(세그먼트 스타일) */}
      {(canWrite || isAdmin) && (
        <div className="faq-topbar">
          <div className="toolbar-seg" role="group" aria-label="faq actions">
            <button
              className="seg-btn"
              onClick={() => setCreateOpen(true)}
              type="button"
            >
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              질문 추가
            </button>
          </div>
        </div>
      )}

      {/* 리스트 카드 */}
      <div className="faq-list-card">
        <div className="faq-list-body">
          {loading ? (
            <div className="faq-row muted">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="faq-row muted">등록된 질문이 없습니다.</div>
          ) : (
            viewItems.map(it => (
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
      </div>

      {/* 메뉴 팝오버 */}
      {menu.open && (
        <div
          className="faq-menu-pop faq-popover open"
          style={{
            position: 'fixed',
            left: Math.max(10, menu.x),
            top: menu.y,
            zIndex: 2000,
            minWidth: 100,
            width: 100
          }}
          role="menu"
        >
          <button
            role="menuitem"
            onClick={async () => {
              const id = menu.id!;
              setMenu({ open: false, id: null, x: 0, y: 0 });
              const fresh = await fetchFaqDetail(id);
              setEditTarget(fresh ?? (items.find(i => i.id === id) || null));
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

      {/* ✅ 리스트-페이징 사이 공간(항상 동일하게) */}
      <div className="faq-between-spacer" aria-hidden />

      {/* 페이징: 세그먼트 버튼 스타일 */}
      {pageCount > 1 && (
        <div className="faq-paging">
          <div className="toolbar-seg" role="navigation" aria-label="faq paging">
            <button
              className="seg-btn"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              type="button"
              aria-label="prev"
              title="이전"
            >
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* 번호들 */}
            <div className="faq-page-strip" aria-label="pages">
              {pagingWindow[0] > 0 && (
                <>
                  <button className={`seg-btn ${page === 0 ? 'active' : ''}`} onClick={() => setPage(0)} type="button">1</button>
                  {pagingWindow[0] > 1 && <span className="faq-ellipsis">…</span>}
                </>
              )}

              {pagingWindow.map((i) => (
                <button
                  key={i}
                  className={`seg-btn ${i === page ? 'active' : ''}`}
                  onClick={() => setPage(i)}
                  type="button"
                >
                  {i + 1}
                </button>
              ))}

              {pagingWindow[pagingWindow.length - 1] < pageCount - 1 && (
                <>
                  {pagingWindow[pagingWindow.length - 1] < pageCount - 2 && <span className="faq-ellipsis">…</span>}
                  <button
                    className={`seg-btn ${page === pageCount - 1 ? 'active' : ''}`}
                    onClick={() => setPage(pageCount - 1)}
                    type="button"
                  >
                    {pageCount}
                  </button>
                </>
              )}
            </div>

            <button
              className="seg-btn"
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={page === pageCount - 1}
              type="button"
              aria-label="next"
              title="다음"
            >
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
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

      {/* 생성 모달 */}
      {createOpen && (
        <FaqUpsertModal
          open
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      )}

      <style jsx>{`
        /* 레이아웃 고정 */
        .faq-wrap{
          padding-top: 12px;
          display: flex;
          flex-direction: column;
        }

        .faq-topbar{
          display: flex;
          justify-content: flex-end;
          margin-bottom: 10px;
        }

        /* 카드 */
        .faq-list-card {
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 14px;
          padding: 6px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(16,24,40,0.04);
        }

        /* 리스트 바디: 최소 높이 확보(페이징 위치 고정의 핵심) */
        .faq-list-body{
          min-height: calc(${ROW_PITCH}px * ${PAGE_SIZE});
          display: block;
        }

        .faq-between-spacer{
          flex: 1 1 auto;
          min-height: 12px; /* 페이징과 카드 사이 안전 여백 */
        }

        /* row */
        .faq-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-top: 1px solid var(--border, #eef0f2);
          gap: 12px;
          transition: background .15s ease;
        }
        .faq-row:first-child { border-top: 0; }
        .faq-row.muted { color: #888; }
        .faq-row:hover { background: #f8fafc; }

        /* 제목 */
        .faq-title {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 700;
          background: none; border: 0;
          padding: 2px 0;
          cursor: pointer;
          text-align: left; flex: 1 1 auto;
          color: #0f172a;
        }
        .faq-q {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 999px;
          background: #eaf2ff; color: #1d4ed8;
          font-weight: 900; font-size: 13.5px; line-height: 1;
          transform: translateY(-1px);
          flex: 0 0 22px;
        }
        .faq-title-text {
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        /* 점3개 */
        .faq-menu { position: relative; }
        .faq-menu-btn {
          width: 32px; height: 32px; border-radius: 8px;
          border: 1px solid var(--border, #e5e7eb); background: #fff; cursor: pointer;
          font-size: 20px; line-height: 0; display: grid; place-items: center;
          transition: background .15s;
        }
        .faq-menu-btn:hover { background: #f3f4f6; }

        .faq-menu-pop {
          position: absolute; right: 0; top: 38px; min-width: 140px;
          border: 1px solid var(--border, #e5e7eb); border-radius: 10px; background: #fff;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          padding: 6px; display: none; z-index: 10;
        }
        .faq-menu-pop.open { display: block; }
        .faq-menu-pop button {
          width: 100%; text-align: left; padding: 8px 10px;
          background: none; border: 0; border-radius: 8px; cursor: pointer;
        }
        .faq-menu-pop button:hover { background: #f3f4f6; }
        .faq-menu-pop .danger { color: #d11; }

        /* 페이징 */
        .faq-paging{
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 44px;
          margin-top: 0;
          padding-bottom: 2px;
        }

        /* ✅ 너가 준 “세그먼트 버튼” 스타일 적용 */
        .toolbar-seg {
          display: inline-flex;
          align-items: stretch;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0,0,0,.02);
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
          font-size: .95rem;
          color: #4b5563;
          line-height: 1;
          transition: background .15s, color .15s;
          white-space: nowrap;
        }

        /* 세그먼트 구분선 */
        .seg-btn + .seg-btn { border-left: 1px solid #e5e7eb; }

        .seg-btn .ico { width: 20px; height: 20px; }
        .seg-btn:hover { background: #f3f4f6; }
        .seg-btn:disabled { opacity: .55; cursor: not-allowed; }

        /* 현재 페이지 강조 */
        .seg-btn.active{
          color: #1d4ed8;
          background: #eef5ff;
        }

        /* 페이지 스트립 */
        .faq-page-strip{
          display: inline-flex;
          align-items: stretch;
        }

        /* “…”은 세그먼트 버튼이 아니므로, 버튼 사이 느낌만 맞춤 */
        .faq-ellipsis{
          display: inline-flex;
          align-items: center;
          padding: 0 10px;
          color: #9ca3af;
          font-weight: 700;
          border-left: 1px solid #e5e7eb;
          user-select: none;
        }
      `}</style>
    </div>
  );
}