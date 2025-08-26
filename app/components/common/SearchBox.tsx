// =============================================
// File: app/components/common/SearchBox.tsx
// (실시간 검색: 조합 상태와 무관하게 즉시 반응 / onInput 사용)
// =============================================
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toProxyUrl } from '@lib/cdn';

type SearchResult = {
  id: number;
  title: string;
  path: string | number;
  icon?: string;
  tags: string[];
  match_type: 'title' | 'tags' | 'content';
  content?: string;
};

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

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  const router = useRouter();

  const count = results.length;
  const listId = useMemo(() => `search-list-${Math.random().toString(36).slice(2)}`, []);

  // ===== 디바운스 + AbortController =====
  useEffect(() => {
    const q = query; // 스냅샷
    if (!q.trim()) {
      // 빈 검색어 → 닫기/초기화
      setResults([]);
      setOpen(false);
      setActiveIndex(-1);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      try {
        const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`, {
          signal: ac.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('search-failed');
        const data = (await res.json()) as SearchResult[];
        setResults(data);
        setOpen(true);
        setActiveIndex(data.length ? 0 : -1);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          // 실패 시에도 드롭다운은 열어두고 "없음" 표기
          setResults([]);
          setOpen(true);
          setActiveIndex(-1);
        }
      } finally {
        setLoading(false);
      }
    }, 200) as unknown as number;

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [query]);

  // 외부 클릭 → 닫기
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const root = wrapRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) {
        setOpen(false);
        setResults([]);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const go = (res: SearchResult | null) => {
    if (!res) return;
    setOpen(false);
    setQuery('');
    setResults([]);
    setActiveIndex(-1);
    router.push(`/wiki?path=${encodeURIComponent(res.path)}&title=${encodeURIComponent(res.title)}`);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!open || (!count && e.key !== 'Escape')) {
      if (e.key === 'Escape') {
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % count);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + count) % count);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[activeIndex] ?? results[0] ?? null);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
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

      {/* 핵심: onInput으로 매 타이핑마다 값 동기화 (조합 중에도 발생) */}
      <input
        type="search"
        ref={inputRef}
        className="search-input"
        placeholder="Search"
        value={query}
        onInput={(e) => {
          const val = (e.target as HTMLInputElement).value;
          setQuery(val); // ← 조합 여부와 상관없이 즉시 반영
        }}
        // onChange는 일부 환경(모바일/브라우저) 호환용으로 유지
        onChange={(e) => {
          if (e.target instanceof HTMLInputElement) {
            setQuery(e.target.value);
          }
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          activeIndex >= 0 && results[activeIndex]
            ? `${listId}-opt-${results[activeIndex].id}`
            : undefined
        }
      />

      {loading && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 58,
            background: 'white',
            borderRadius: 10,
            boxShadow: '0 6px 32px rgba(0,0,0,0.10)',
            padding: '18px 25px',
            fontSize: 16,
            color: '#aaa',
            zIndex: 99,
          }}
        >
          검색 중...
        </div>
      )}

      {open && !loading && results.length === 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 58,
            background: 'white',
            color: '#aaa',
            borderRadius: 10,
            boxShadow: '0 6px 32px rgba(0,0,0,0.12)',
            padding: '18px 25px',
            fontSize: 16,
            zIndex: 99,
          }}
        >
          검색 결과가 없습니다.
        </div>
      )}

      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="wiki-search-dropdown"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 58,
            zIndex: 9999,
            background: 'white',
            borderRadius: 10,
            boxShadow: '0 6px 32px rgba(0,0,0,0.14)',
            padding: '0.5em 0',
            margin: 0,
            maxHeight: 420,
            overflowY: 'auto',
          }}
        >
          {results.map((res, idx) => {
            const selected = idx === activeIndex;
            return (
              <li
                id={`${listId}-opt-${res.id}`}
                role="option"
                aria-selected={selected}
                key={res.id}
                className="wiki-search-item"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '13px 30px',
                  cursor: 'pointer',
                  borderBottom: idx !== results.length - 1 ? '1px solid #f5f6fa' : undefined,
                  background: selected ? 'rgba(24,118,247,0.06)' : 'transparent',
                  fontSize: 16,
                  lineHeight: 1.3,
                  gap: 14,
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => go(res)}
              >
                <span style={{ marginRight: 12, fontSize: 22 }}>
                  {res.icon ? (
                    isImageLike(res.icon) ? (
                      <img
                        src={isRemoteHttp(res.icon) ? toProxyUrl(res.icon) : res.icon}
                        alt=""
                        width={24}
                        height={24}
                        style={{ width: 24, height: 24, verticalAlign: 'middle', objectFit: 'cover' }}
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
                  {res.match_type === 'title' && (
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{highlight(res.title, query)}</div>
                  )}

                  {res.match_type === 'tags' && (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 2 }}>
                        {highlight(res.title, query)}
                      </div>
                      <div
                        style={{
                          color: '#198544',
                          fontSize: 14,
                          marginTop: 2,
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        {res.tags.map((tag, i) => (
                          <span key={tag + i}>{highlight(tag, query)}</span>
                        ))}
                      </div>
                    </>
                  )}

                  {res.match_type === 'content' && (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>
                        {highlight(res.title, query)}
                      </div>
                      <div
                        style={{
                          color: '#555',
                          fontSize: 14,
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
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
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
