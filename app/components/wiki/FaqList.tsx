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

type FaqItem = {
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
        if (!user) { setFlags({ canWrite: false, isAdmin: false, loading: false }); return; }
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        const me = r.ok ? await r.json() : null;

        const role = (me?.role ?? me?.user?.role ?? '').toLowerCase?.() || '';
        const roles: string[] = (me?.roles ?? me?.user?.roles ?? me?.permissions ?? me?.user?.permissions ?? [])
          .map((v: any) => String(v).toLowerCase());

        const isAdmin = ['admin', 'manager'].includes(role) || roles.includes('admin') || roles.includes('manager');
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
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const [menu, setMenu] = useState<{open: boolean; id: number|null; x: number; y: number}>({
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
  useEffect(() => {
    const maxIdx = Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1);
    if (page > maxIdx) setPage(0);
  }, [items, page]);

  useEffect(() => {
    const closeIfOutside = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el || !el.closest('.faq-menu')) setOpenMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenuId(null); };

    document.addEventListener('mousedown', closeIfOutside);
    document.addEventListener('scroll', closeIfOutside, true);
    window.addEventListener('resize', closeIfOutside);
    window.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mousedown', closeIfOutside);
      document.removeEventListener('scroll', closeIfOutside, true);
      window.removeEventListener('resize', closeIfOutside);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // 서버 쿼리
  const qs = useMemo(() => {
    const usp = new URLSearchParams();
    if (query) usp.set('q', query);
    if (tags?.length) usp.set('tags', tags.join(','));
    usp.set('limit', '100');
    usp.set('offset', '0');
    return usp.toString();
  }, [query, tags]);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch(`/api/faq?${qs}`, { cache: 'no-store' });
      const data = r.ok ? await r.json() : { items: [] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  if (!menu.open) return;

  const close = () => setMenu({ open:false, id:null, x:0, y:0 });
    const onPointer = (e: Event) => {
      const el = e.target as HTMLElement | null;
      // 팝업이나 ⋯버튼을 누른 게 아니면 닫기
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

  return (
    <div className="faq-wrap">
      {/* 리스트 카드 */}
      <div className="faq-list-card">
        {loading ? (
          <div className="faq-row muted">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="faq-row muted">등록된 질문이 없습니다.</div>
        ) : (
          viewItems.map(it => (
            <div key={it.id} className="faq-row">
              {/* 제목(왼쪽) */}
              <button className="faq-title" onClick={() => setSel(it)} title={it.title}>
                <span className="faq-q">Q</span>
                <span className="faq-title-text">{it.title}</span>
              </button>

              {/* 점3개 메뉴 – 관리자만 표시 */}
              {isAdmin && (
                <div className="faq-menu" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="faq-menu-btn"
                    aria-label="more"
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      // 버튼의 오른쪽 가장자리에 '붙여서', 아래로 6px 내린 위치
                      const x = Math.min(
                        window.innerWidth - 100 - 8,  // 우측 밖으로 나가지 않게
                        Math.max(8, rect.right - 100) // 버튼 오른쪽에 flush
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
                  >⋯</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
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
          <button role="menuitem" onClick={() => { setMenu({open:false,id:null,x:0,y:0}); setEditTarget(items.find(i => i.id === menu.id) || null); }}>
            수정
          </button>
          <button
            role="menuitem"
            className="danger"
            onClick={() => { const id = menu.id!; setMenu({open:false,id:null,x:0,y:0}); handleDelete(id); }}
          >
            삭제
          </button>
        </div>
      )}

      {/* 페이징 */}
      {pageCount > 1 && (
        <div className="faq-paging">
          <button
            className="faq-page-btn"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >◀</button>

          <ul className="faq-pages">
            {Array.from({ length: pageCount }).map((_, i) => (
              <li key={i}>
                <button
                  className={`faq-page ${i === page ? 'active' : ''}`}
                  onClick={() => setPage(i)}
                >{i + 1}</button>
              </li>
            ))}
          </ul>

          <button
            className="faq-page-btn"
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={page === pageCount - 1}
          >▶</button>
        </div>
      )}

      {/* 상세 모달(Q/A 뷰) */}
      {sel && (
        <div className="faq-modal-backdrop" onClick={() => setSel(null)}>
          <div className="faq-modal" onClick={e => e.stopPropagation()}>
            <div className="faq-modal-header">
              <div className="faq-modal-title">
                <span className="faq-qa q">Q</span>
                <h3>{sel.title}</h3>
              </div>
              <button className="faq-modal-close" onClick={() => setSel(null)} aria-label="close">
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
      )}

      {/* ✨ 수정도 같은 모달 재사용 */}
      {editTarget && (
        <FaqUpsertModal
          open
          mode="edit"
          initial={{ id: editTarget.id, title: editTarget.title, content: editTarget.content, tags: editTarget.tags }}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); refresh(); }}
        />
      )}

      {/* 스타일 */}
      <style jsx>{`
        /* 상단 간격 */
        .faq-wrap { padding-top: 12px; }

        /* 카드 컨테이너 */
        .faq-list-card {
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 14px;
          padding: 6px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(16,24,40,0.04);
        }

        /* 행 (높이 30% 축소) */
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

        /* 제목 버튼 */
        .faq-title {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 700;
          background: none; border: 0;
          padding: 2px 0;            /* › 화살표 제거 */
          cursor: pointer;
          text-align: left; flex: 1 1 auto;
          color: #0f172a;
        }

        /* Q 토큰 (리스트) */
        .faq-q {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 999px;
          background: #eaf2ff; color: #1d4ed8;
          font-weight: 900; font-size: 13.5px; line-height: 1; vertical-align: middle;
          transform: translateY(-1px);
          flex: 0 0 22px;
        }
        .faq-title-text {
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        /* 점3개 메뉴 */
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
          box-shadow: 0 8px 24px rgba(0,0,0,0.08); padding: 6px; display: none; z-index: 10;
        }
        .faq-menu-pop.open { display: block; }
        .faq-menu-pop button {
          width: 100%; text-align: left; padding: 8px 10px; background: none; border: 0; border-radius: 8px; cursor: pointer;
        }
        .faq-menu-pop button:hover { background: #f3f4f6; }
        .faq-menu-pop .danger { color: #d11; }

        /* 상세 모달 (뷰) */
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
          color: #ef4444;           /* 빨간색 */
          cursor: pointer;
          transition: transform .12s ease;
        }
        .faq-modal-close:hover{ transform: scale(1.06); }
        .faq-modal-close:focus{ outline: none; }
        .faq-modal-close .x-ic{ width: 18px; height: 18px; }
        .faq-modal-body { display: grid; gap: 10px; margin-top: 6px; }

        /* Q/A 공통 토큰 */
        .faq-qa {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 999px;
          font-weight: 900; font-size: 13.5px; line-height: 1; vertical-align: middle;
          transform: translateY(-1px);
          flex: 0 0 22px;
        }
        .faq-qa.q { background: #eaf2ff; color: #1d4ed8; }
        .faq-qa.a { background: #ffe9e9; color: #dc2626; }

        /* A 라인 카드 */
        .qa-line {
          display: flex; align-items: flex-start; gap: 12px;
          border-radius: 12px; padding: 12px 14px;
        }
        .qa-line.a {
          background: #fff5f5;
          border: 1px solid #ffe2e2;
        }
        .qa-text { margin: 0; white-space: pre-wrap; font: inherit; color: #111827; }

        /* 페이징 */
        .faq-paging {
          display: flex; align-items: center; justify-content: center;
          gap: 10px; margin-top: 12px;
        }
        .faq-page-btn {
          background: none; border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 6px 10px; cursor: pointer;
        }
        .faq-page-btn:disabled { opacity: .5; cursor: default; }
        .faq-pages {
          display: flex; gap: 6px; list-style: none; padding: 0; margin: 0;
        }
        .faq-page {
          min-width: 36px; height: 32px; padding: 0 8px;
          border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; cursor: pointer;
          font-weight: 600;
        }
        .faq-page.active {
          border-color: #1d4ed8; color: #1d4ed8; background: #eef5ff;
        }
      `}</style>
    </div>
  );
}
