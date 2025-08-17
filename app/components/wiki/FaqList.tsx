// File: app/components/wiki/FaqList.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

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

// writer 이상 권한 확인
function useCanWrite(user: User) {
  const [loading, setLoading] = useState(true);
  const [can, setCan] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user) { setCan(false); setLoading(false); return; }
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        const me = r.ok ? await r.json() : null;

        const role = (me?.role ?? me?.user?.role ?? '').toLowerCase?.() || '';
        const roles: string[] = (me?.roles ?? me?.user?.roles ?? me?.permissions ?? me?.user?.permissions ?? [])
          .map((v: any) => String(v).toLowerCase());

        const canWrite = ['admin','manager','writer'].includes(role)
          || roles.includes('admin') || roles.includes('writer') || roles.includes('manager');

        if (!cancelled) { setCan(!!canWrite); setLoading(false); }
      } catch {
        if (!cancelled) { setCan(false); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { canWrite: can, loading };
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
  const { canWrite } = useCanWrite(user);
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<FaqItem | null>(null);
  const [editTarget, setEditTarget] = useState<FaqItem | null>(null);

  // 서버 쿼리스트링 구성(부모가 내려준 초기값만 사용)
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

  useEffect(() => { refresh(); }, [qs]);
  useEffect(() => { if (refreshSignal) refresh(); }, [refreshSignal]); // 저장 후 강제 새로고침

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제할까요?')) return;
    const r = await fetch(`/api/faq/${id}`, { method: 'DELETE' });
    if (r.ok) refresh();
  };

  return (
    <div className="faq-wrap">
      {/* 상단 버튼은 부모로 이동했으므로 여기선 렌더 X */}

      {/* 리스트 카드 */}
      <div className="faq-list-card">
        {loading ? (
          <div className="faq-row muted">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="faq-row muted">등록된 질문이 없습니다.</div>
        ) : (
          items.map(it => (
            <div key={it.id} className="faq-row">
              {/* 제목(왼쪽) */}
              <button className="faq-title" onClick={() => setSel(it)} title={it.title}>
                {it.title}
              </button>

              {/* 점3개 메뉴 – writer+만 표시 (수정/삭제) */}
              {canWrite && (
                <div className="faq-menu" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="faq-menu-btn"
                    aria-label="more"
                    onClick={(e) => {
                      const pop = (e.currentTarget.nextElementSibling as HTMLDivElement | null);
                      if (pop) pop.classList.toggle('open');
                    }}
                  >⋯</button>
                  <div className="faq-menu-pop">
                    <button onClick={() => setEditTarget(it)}>수정</button>
                    <button className="danger" onClick={() => handleDelete(it.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 상세 모달(제목 + 내용만) */}
      {sel && (
        <div className="faq-modal-backdrop" onClick={() => setSel(null)}>
          <div className="faq-modal" onClick={e => e.stopPropagation()}>
            <div className="faq-modal-header">
              <h3>{sel.title}</h3>
              <button className="faq-modal-close" onClick={() => setSel(null)} aria-label="close">✕</button>
            </div>
            <div className="faq-modal-body">
              <pre style={{ whiteSpace: 'pre-wrap', font: 'inherit', margin: 0 }}>{sel.content}</pre>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 (writer+) */}
      {editTarget && (
        <FaqEditModal
          mode="edit"
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); refresh(); }}
        />
      )}

      {/* 스타일 */}
      <style jsx>{`
        .faq-list-card {
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 14px;
          padding: 6px 0;
        }
        .faq-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-top: 1px solid var(--border, #eef0f2);
        }
        .faq-row:first-child { border-top: 0; }
        .faq-row.muted { color: #888; }
        .faq-title {
          font-size: 16px;
          font-weight: 600;
          background: none; border: 0; padding: 4px 0; cursor: pointer;
          text-align: left; flex: 1 1 auto;
        }
        .faq-menu { position: relative; }
        .faq-menu-btn {
          width: 32px; height: 32px; border-radius: 8px;
          border: 1px solid var(--border, #e5e7eb); background: #fff; cursor: pointer;
          font-size: 20px; line-height: 0; display: grid; place-items: center;
        }
        .faq-menu-pop {
          position: absolute; right: 0; top: 38px; min-width: 120px;
          border: 1px solid var(--border, #e5e7eb); border-radius: 10px; background: #fff;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08); padding: 6px; display: none; z-index: 10;
        }
        .faq-menu-pop.open { display: block; }
        .faq-menu-pop button {
          width: 100%; text-align: left; padding: 8px 10px; background: none; border: 0; border-radius: 8px; cursor: pointer;
        }
        .faq-menu-pop button:hover { background: #f3f4f6; }
        .faq-menu-pop .danger { color: #d11; }

        /* 모달(상세) – 전역 CSS 없이도 동작하도록 포함 */
        .faq-modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          display: grid; place-items: center; padding: 16px; z-index: 1000;
        }
        .faq-modal {
          width: min(680px, 100%); background: #fff; border-radius: 16px;
          padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .faq-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .faq-modal-header h3 { margin: 0; font-size: 18px; }
        .faq-modal-close {
          border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; width: 32px; height: 32px; cursor: pointer;
        }
        .faq-modal-body { font-size: 15px; line-height: 1.6; }
      `}</style>
    </div>
  );
}

// ----------------- 편집(수정) 모달 -----------------
function FaqEditModal({
  mode, target, onClose, onSaved,
}: {
  mode: 'edit';
  target: FaqItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(target?.title ?? '');
  const [content, setContent] = useState(target?.content ?? '');
  const [tags, setTags] = useState((target?.tags ?? []).join(','));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목/내용을 입력해주세요'); return;
    }
    setSaving(true);
    try {
      const payload = { title: title.trim(), content: content.trim(), tags };
      const r = await fetch(`/api/faq/${target!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw 0;
      onSaved();
    } catch {
      alert('저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="faq-modal-backdrop" onClick={onClose}>
      <div className="faq-modal" onClick={e => e.stopPropagation()}>
        <div className="faq-modal-header">
          <h3>{mode === 'edit' ? '질문 수정' : '질문'}</h3>
          <button className="faq-modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 6 }}>제목</label>
            <input style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}
                   value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 6 }}>내용</label>
            <textarea style={{ width: '100%', height: 140, resize: 'vertical', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}
                      value={content} onChange={e => setContent(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#555', marginBottom: 6 }}>태그(쉼표)</label>
            <input style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}
                   value={tags} onChange={e => setTags(e.target.value)} placeholder="예: 뉴비,설정" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="wiki-btn" onClick={onClose}>취소</button>
          <button className="wiki-btn wiki-btn-primary" onClick={save} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
