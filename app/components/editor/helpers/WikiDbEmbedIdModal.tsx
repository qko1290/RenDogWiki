// =============================================
// File: components/editor/WikiDbEmbedSelectModal.tsx  (전체 코드)
// (이름 검색 → 리스트 선택 → id 반환 모달)
// - quest/npc/qna 공용
// - 검색어 입력 시 /api/wiki-embed/search?kind=&q= 호출
// - ↑↓/Enter/Escape 지원, 더블클릭 즉시 삽입
// - 모달 열릴 때 input 자동 포커스
// =============================================
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { WikiEmbedKind } from '../helpers/insertWikiDbEmbed';
import { toProxyUrl } from '@lib/cdn';

type Props = {
  open: boolean;
  kind: WikiEmbedKind; // 'quest' | 'npc' | 'qna'
  onClose: () => void;
  onSubmit: (id: number) => void;
};

type SearchItem = {
  id: number;
  title: string;
  subtitle?: string;
  icon?: string; // npc/quest icon url
};

function labelOf(kind: WikiEmbedKind) {
  if (kind === 'quest') return '퀘스트';
  if (kind === 'npc') return 'NPC';
  return 'QNA';
}

export default function WikiDbEmbedSelectModal({ open, kind, onClose, onSubmit }: Props) {
  const label = useMemo(() => labelOf(kind), [kind]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SearchItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);

  // 모달 열릴 때 초기화 + 포커스
  useEffect(() => {
    if (!open) return;

    document.body.classList.add('rd-modal-open');

    setQ('');
    setRows([]);
    setSelectedIdx(-1);
    setError(null);
    setLoading(false);

    requestAnimationFrame(() => {
      setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true } as any);
        inputRef.current?.select?.();
      }, 0);
    });

    return () => {
      document.body.classList.remove('rd-modal-open');
    };
  }, [open, kind]);

  // 검색 (debounce + abort)
  useEffect(() => {
    if (!open) return;

    const query = q.trim();
    if (!query) {
      setRows([]);
      setSelectedIdx(-1);
      setError(null);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/wiki-embed/search?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(query)}&limit=30&ts=${Date.now()}`,
          { cache: 'no-store', signal: ctrl.signal }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json().catch(() => null);

        const items: SearchItem[] = Array.isArray(data?.items) ? data.items : [];
        setRows(items);
        setSelectedIdx(items.length ? 0 : -1);
      } catch (e: any) {
        if (ctrl.signal.aborted) return;
        setRows([]);
        setSelectedIdx(-1);
        setError('검색에 실패했어. 잠시 후 다시 시도해줘.');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 180); // ✅ 체감 좋은 짧은 디바운스

    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [open, q, kind]);

  const selectedRow = selectedIdx >= 0 ? rows[selectedIdx] : null;

  const scrollSelectedIntoView = (idx: number) => {
    const wrap = listRef.current;
    if (!wrap) return;
    const el = wrap.querySelector<HTMLElement>(`[data-row-idx="${idx}"]`);
    if (!el) return;

    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    const viewTop = wrap.scrollTop;
    const viewBottom = viewTop + wrap.clientHeight;

    if (top < viewTop) wrap.scrollTop = top - 6;
    else if (bottom > viewBottom) wrap.scrollTop = bottom - wrap.clientHeight + 6;
  };

  const commit = (row: SearchItem | null) => {
    if (!row) return;
    onSubmit(row.id);
  };

  const onKeyDownCapture = (e: React.KeyboardEvent) => {
    if (!open) return;
    if ((e as any).isComposing) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      if (!rows.length) return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedIdx((prev) => {
        const next = Math.min(rows.length - 1, (prev < 0 ? 0 : prev + 1));
        requestAnimationFrame(() => scrollSelectedIntoView(next));
        return next;
      });
      return;
    }

    if (e.key === 'ArrowUp') {
      if (!rows.length) return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedIdx((prev) => {
        const next = Math.max(0, (prev < 0 ? 0 : prev - 1));
        requestAnimationFrame(() => scrollSelectedIntoView(next));
        return next;
      });
      return;
    }

    if (e.key === 'Enter') {
      // modifier 조합은 무시
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      if (!selectedRow) return;
      e.preventDefault();
      e.stopPropagation();
      commit(selectedRow);
      return;
    }
  };

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDownCapture={onKeyDownCapture}
      role="dialog"
      aria-modal="true"
      aria-label={`${label} 선택`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        zIndex: 20000,
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 720,
          maxWidth: 'calc(100vw - 40px)',
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          boxShadow: '0 18px 60px rgba(0,0,0,.18)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateRows: 'auto auto 1fr auto',
        }}
      >
        {/* header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #eef0f2', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>{label} 검색/선택</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
              이름으로 검색해서 목록에서 선택하면 <b>id</b>가 자동으로 들어가.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              marginLeft: 'auto',
              width: 34,
              height: 34,
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              color: '#94a3b8',
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            ×
          </button>
        </div>

        {/* search */}
        <div style={{ padding: 16, borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`${label} 이름 검색...`}
            style={{
              width: '100%',
              height: 42,
              borderRadius: 12,
              border: '1px solid #dbe3ef',
              padding: '0 12px',
              fontSize: 14,
              outline: 'none',
              background: '#fbfcfd',
            }}
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true } as any));
              }}
              style={{
                height: 42,
                padding: '0 12px',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: 800,
              }}
            >
              지우기
            </button>
          )}
        </div>

        {/* list */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', minHeight: 360 }}>
          <div
            ref={listRef}
            style={{
              padding: 10,
              overflowY: 'auto',
              borderRight: '1px solid #f1f5f9',
            }}
          >
            {!q.trim() ? (
              <div style={{ color: '#94a3b8', padding: 14 }}>
                검색어를 입력하면 목록이 나와.
              </div>
            ) : loading ? (
              <div style={{ color: '#94a3b8', padding: 14 }}>
                검색 중...
              </div>
            ) : rows.length === 0 ? (
              <div style={{ color: '#94a3b8', padding: 14 }}>
                검색 결과가 없어.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {rows.map((r, idx) => {
                  const active = idx === selectedIdx;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      data-row-idx={idx}
                      onClick={() => setSelectedIdx(idx)}
                      onDoubleClick={() => commit(r)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        borderRadius: 12,
                        border: active ? '1px solid #93c5fd' : '1px solid #e5e7eb',
                        background: active ? '#eff6ff' : '#fff',
                        padding: '10px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                      }}
                    >
                      {/* icon (npc/quest만) */}
                      {r.icon ? (
                        <img
                          src={toProxyUrl(r.icon)}
                          alt=""
                          width={34}
                          height={34}
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            objectFit: 'cover',
                            border: '1px solid #e5e7eb',
                            background: '#fafafa',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            border: '1px solid #e5e7eb',
                            background: '#f8fafc',
                            display: 'grid',
                            placeItems: 'center',
                            color: '#94a3b8',
                            fontWeight: 900,
                          }}
                        >
                          {kind === 'qna' ? 'Q' : 'N'}
                        </div>
                      )}

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 900, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 12.5, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.subtitle || `id=${r.id}`}
                        </div>
                      </div>

                      <div style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12.5, fontWeight: 800 }}>
                        #{r.id}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {error && (
              <div style={{ padding: 14, color: '#dc2626', fontSize: 12.5 }}>
                {error}
              </div>
            )}
          </div>

          {/* preview */}
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 800, marginBottom: 10 }}>
              선택 미리보기
            </div>

            {!selectedRow ? (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>
                선택된 항목이 없어.
              </div>
            ) : (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {selectedRow.icon ? (
                    <img
                      src={toProxyUrl(selectedRow.icon)}
                      alt=""
                      width={44}
                      height={44}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        objectFit: 'cover',
                        border: '1px solid #e5e7eb',
                        background: '#fafafa',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        border: '1px solid #e5e7eb',
                        background: '#f8fafc',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#94a3b8',
                        fontWeight: 900,
                      }}
                    >
                      {kind === 'qna' ? 'Q' : 'N'}
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 950, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedRow.title}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12.5, color: '#64748b' }}>
                      {selectedRow.subtitle || `id=${selectedRow.id}`}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12.5, color: '#475569' }}>
                  <b>ID</b>: {selectedRow.id}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: 14, borderTop: '1px solid #eef0f2', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClose}
            style={{
              height: 38,
              padding: '0 12px',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            취소 (Esc)
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commit(selectedRow)}
            disabled={!selectedRow}
            style={{
              height: 38,
              padding: '0 12px',
              borderRadius: 12,
              border: '1px solid transparent',
              background: selectedRow ? '#2a90ff' : '#e9eef6',
              color: selectedRow ? '#fff' : '#90a3bf',
              cursor: selectedRow ? 'pointer' : 'not-allowed',
              fontWeight: 950,
            }}
          >
            삽입 (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}