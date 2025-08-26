// =============================================
// File: app/components/common/SearchBox.tsx
// (문서/FAQ 동시 검색, 2열 반반 표시, IME 즉시 반응)
// =============================================
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toProxyUrl } from '@lib/cdn';

// -------------------- types --------------------
type DocResult = {
  id: number;
  title: string;
  path: string | number;
  icon?: string;
  tags: string[];
  match_type: 'title' | 'tags' | 'content';
  content?: string; // optional: 일부 본문(JSON 문자열)
};

type FaqItem = {
  id: number;
  title: string;
  content: string;
  tags: string[];
  uploader: string;
  created_at?: string;
  updated_at?: string;
};

// -------------------- utils --------------------
function highlight(text: string, keyword: string) {
  if (!keyword) return text;
  const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${safe})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} style={{ background: 'none', color: '#1876f7', fontWeight: 700 }}>
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
function extractSlateTextLine(slate: any, keyword: string): string | null {
  if (Array.isArray(slate)) {
    for (const node of slate) {
      const found = extractSlateTextLine(node, keyword);
      if (found) return found;
    }
  } else if (typeof slate === 'object' && slate) {
    if (typeof slate.text === 'string' && slate.text.toLowerCase().includes(keyword.toLowerCase())) {
      return slate.text;
    }
    if (Array.isArray(slate.children)) {
      const found = extractSlateTextLine(slate.children, keyword);
      if (found) return found;
    }
  }
  return null;
}
const isImageLike = (v?: string) => !!v && (/^https?:\/\//i.test(v) || v.startsWith('data:image'));
const isRemoteHttp = (v?: string) => !!v && /^https?:\/\//i.test(v);

// -------------------- component --------------------
export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  // 문서
  const [docs, setDocs] = useState<DocResult[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // FAQ
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);

  // 선택/키보드 포커스는 문서 리스트만 기존처럼 지원
  const [activeDocIndex, setActiveDocIndex] = useState<number>(-1);

  // FAQ 뷰 모달
  const [faqView, setFaqView] = useState<FaqItem | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const abortDocsRef = useRef<AbortController | null>(null);
  const abortFaqRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  const router = useRouter();
  const docsCount = docs.length;
  const listId = useMemo(() => `search-list-${Math.random().toString(36).slice(2)}`, []);

  // ===== 디바운스 & 동시 fetch(문서 + FAQ) =====
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setOpen(false);
      setDocs([]); setFaqs([]);
      setActiveDocIndex(-1);
      if (abortDocsRef.current) abortDocsRef.current.abort();
      if (abortFaqRef.current) abortFaqRef.current.abort();
      return;
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      // --- 문서 요청 ---
      if (abortDocsRef.current) abortDocsRef.current.abort();
      const acDocs = new AbortController();
      abortDocsRef.current = acDocs;
      setLoadingDocs(true);
      (async () => {
        try {
          const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`, {
            signal: acDocs.signal,
            cache: 'no-store',
          });
          if (!res.ok) throw new Error('search-failed');
          const data = (await res.json()) as DocResult[];
          setDocs(data);
          setActiveDocIndex(data.length ? 0 : -1);
        } catch (e: any) {
          if (e?.name !== 'AbortError') {
            setDocs([]); setActiveDocIndex(-1);
          }
        } finally {
          setLoadingDocs(false);
        }
      })();

      // --- FAQ 요청 ---
      if (abortFaqRef.current) abortFaqRef.current.abort();
      const acFaq = new AbortController();
      abortFaqRef.current = acFaq;
      setLoadingFaqs(true);
      (async () => {
        try {
          // ✅ /api/faq?q=...&limit=10 사용 (서버는 title/content/tags ILIKE 검색 가정)
          const url = `/api/faq?q=${encodeURIComponent(q)}&limit=10&offset=0`;
          const res = await fetch(url, { signal: acFaq.signal, cache: 'no-store' });
          const data = res.ok ? await res.json() : { items: [] };
          setFaqs(Array.isArray(data.items) ? data.items : []);
        } catch (e: any) {
          if (e?.name !== 'AbortError') setFaqs([]);
        } finally {
          setLoadingFaqs(false);
        }
      })();

      setOpen(true);
    }, 200) as unknown as number;

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [query]);

  // 외부 클릭으로 닫기
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const root = wrapRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        setOpen(false);
        setActiveDocIndex(-1);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  // 이동
  const goDoc = (res: DocResult | null) => {
    if (!res) return;
    setOpen(false);
    setQuery('');
    setDocs([]); setFaqs([]);
    setActiveDocIndex(-1);
    router.push(`/wiki?path=${encodeURIComponent(res.path)}&title=${encodeURIComponent(res.title)}`);
  };

  // 키보드(문서 리스트 포커스)
  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!open || (!docsCount && e.key !== 'Escape')) {
      if (e.key === 'Escape') {
        setOpen(false);
        setActiveDocIndex(-1);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveDocIndex((i) => (docsCount ? (i + 1) % docsCount : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveDocIndex((i) => (docsCount ? (i - 1 + docsCount) % docsCount : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goDoc(docs[activeDocIndex] ?? docs[0] ?? null);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setActiveDocIndex(-1);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="search-wrapper"
      role="combobox"
      aria-expanded={open}
      aria-owns={listId}
      aria-haspopup="listbox"
      style={{ position: 'relative' }}
    >
      <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z" />
      </svg>

      {/* onInput: IME 조합 중에도 즉시 반응 */}
      <input
        type="search"
        ref={inputRef}
        className="search-input"
        placeholder="Search"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        onChange={(e) => setQuery(e.target.value)} // 호환용
        onFocus={() => (docs.length || faqs.length) && setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          activeDocIndex >= 0 && docs[activeDocIndex]
            ? `${listId}-opt-${docs[activeDocIndex].id}`
            : undefined
        }
      />

      {/* 드롭다운 */}
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 58,
            zIndex: 9999,
            background: 'white',
            borderRadius: 10,
            boxShadow: '0 6px 32px rgba(0,0,0,0.14)',
            padding: '10px 12px',
          }}
        >
          {/* 상단 상태줄 */}
          {(loadingDocs || loadingFaqs) && (
            <div style={{ color: '#9aa1ac', fontSize: 13, padding: '6px 2px 8px' }}>
              {loadingDocs ? '문서 검색 중…' : ''} {loadingDocs && loadingFaqs ? '·' : ''}{' '}
              {loadingFaqs ? 'FAQ 검색 중…' : ''}
            </div>
          )}

          {/* 2열 그리드: 좌(문서) / 우(FAQ) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              alignItems: 'start',
              minHeight: 120,
            }}
          >
            {/* 문서 컬럼 */}
            <div style={{ borderRight: '1px solid #f0f2f5', paddingRight: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#556070', marginBottom: 6 }}>
                문서
              </div>

              {(!loadingDocs && docs.length === 0) && (
                <div style={{ color: '#9aa1ac', fontSize: 14, padding: '6px 4px' }}>
                  결과가 없습니다.
                </div>
              )}

              <ul
                id={listId}
                role="listbox"
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  maxHeight: 360,
                  overflowY: 'auto',
                }}
              >
                {docs.map((res, idx) => {
                  const selected = idx === activeDocIndex;
                  return (
                    <li
                      id={`${listId}-opt-${res.id}`}
                      role="option"
                      aria-selected={selected}
                      key={`doc-${res.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        padding: '11px 12px',
                        cursor: 'pointer',
                        borderBottom: idx !== docs.length - 1 ? '1px solid #f5f6fa' : undefined,
                        background: selected ? 'rgba(24,118,247,0.06)' : 'transparent',
                        fontSize: 15,
                        lineHeight: 1.3,
                        gap: 10,
                        borderRadius: 8,
                      }}
                      onMouseEnter={() => setActiveDocIndex(idx)}
                      onClick={() => goDoc(res)}
                    >
                      <span style={{ marginRight: 8, fontSize: 20 }}>
                        {res.icon ? (
                          isImageLike(res.icon) ? (
                            <img
                              src={isRemoteHttp(res.icon) ? toProxyUrl(res.icon) : res.icon}
                              alt=""
                              width={22}
                              height={22}
                              style={{ width: 22, height: 22, objectFit: 'cover' }}
                              loading="lazy"
                              decoding="async"
                              draggable={false}
                            />
                          ) : (
                            res.icon
                          )
                        ) : (
                          '📄'
                        )}
                      </span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>
                          {highlight(res.title, query)}
                        </div>
                        {res.match_type === 'content' && (
                          <div
                            style={{
                              color: '#667085',
                              fontSize: 13,
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {(() => {
                              try {
                                const slate =
                                  typeof res.content === 'string' ? JSON.parse(res.content) : res.content;
                                const line = extractSlateTextLine(slate, query) || '';
                                return line ? highlight(line, query) : null;
                              } catch {
                                return null;
                              }
                            })()}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* FAQ 컬럼 */}
            <div style={{ paddingLeft: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#556070', marginBottom: 6 }}>
                자주 묻는 질문
              </div>

              {(!loadingFaqs && faqs.length === 0) && (
                <div style={{ color: '#9aa1ac', fontSize: 14, padding: '6px 4px' }}>
                  결과가 없습니다.
                </div>
              )}

              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  maxHeight: 360,
                  overflowY: 'auto',
                }}
              >
                {faqs.map((f) => (
                  <li
                    key={`faq-${f.id}`}
                    style={{
                      padding: '11px 12px',
                      borderBottom: '1px solid #f5f6fa',
                      cursor: 'pointer',
                      borderRadius: 8,
                    }}
                    onClick={() => setFaqView(f)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          background: '#eaf2ff',
                          color: '#1d4ed8',
                          fontWeight: 900,
                          fontSize: 12.5,
                          flex: '0 0 20px',
                        }}
                        aria-hidden
                      >
                        Q
                      </span>
                      <div style={{ fontWeight: 700, fontSize: 15, minWidth: 0 }}>
                        {highlight(f.title, query)}
                      </div>
                    </div>
                    {f.tags?.length > 0 && (
                      <div
                        style={{
                          color: '#198544',
                          fontSize: 12,
                          marginTop: 6,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        {f.tags.map((t, i) => (
                          <span key={t + i}>{highlight(t, query)}</span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* FAQ 뷰 간단 모달 */}
      {faqView && (
        <div
          onClick={() => setFaqView(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 10000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(760px, 100%)',
              background: '#fff',
              borderRadius: 16,
              padding: 16,
              boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: '#eaf2ff',
                    color: '#1d4ed8',
                    fontWeight: 900,
                    fontSize: 13.5,
                    flex: '0 0 22px',
                  }}
                >
                  Q
                </span>
                <h3 style={{ margin: 0, fontSize: 18 }}>{faqView.title}</h3>
              </div>
              <button
                onClick={() => setFaqView(null)}
                aria-label="close"
                style={{
                  width: 34, height: 34, display: 'grid', placeItems: 'center',
                  background: 'transparent', border: 0, cursor: 'pointer', color: '#ef4444'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                  <path d="M6 6L18 18M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  background: '#fff5f5', border: '1px solid #ffe2e2', borderRadius: 12, padding: '12px 14px'
                }}
              >
                <span
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: 999, background: '#ffe9e9', color: '#dc2626',
                    fontWeight: 900, fontSize: 13.5, flex: '0 0 22px'
                  }}
                >
                  A
                </span>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', font: 'inherit', color: '#111827' }}>
                  {faqView.content}
                </pre>
              </div>
              {faqView.tags?.length > 0 && (
                <div style={{ marginTop: 10, color: '#198544', fontSize: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {faqView.tags.map((t, i) => <span key={t + i}>#{t}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
