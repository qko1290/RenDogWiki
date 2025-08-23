// =============================================
// File: app/components/common/SearchBox.tsx
// =============================================
'use client';

/**
 * 문서/태그/본문 통합 검색 입력
 * - 200ms 디바운스 + AbortController로 이전 요청 취소
 * - 키보드 탐색: ↑/↓, Enter 이동, Esc 닫기
 * - IME 조합 중(composition)엔 검색 지연
 * - 결과 하이라이트(안전한 캡처-스플릿 방식)
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toProxyUrl } from '@lib/cdn';

// 검색 결과 데이터 타입
type SearchResult = {
  id: number;
  title: string;
  path: string | number;
  icon?: string;
  tags: string[];
  match_type: 'title' | 'tags' | 'content';
  content?: string; // 서버가 슬레이트 JSON 문자열(일부) 제공
};

/** 안전한 하이라이트: 캡처-스플릿으로 쪼개고, 홀수 인덱스만 강조 */
function highlight(text: string, keyword: string) {
  if (!keyword) return text;
  const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${safe})`, 'gi'); // split 시 캡처 포함
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

/** 슬레이트(JSON) 구조에서 키워드가 들어있는 첫 텍스트 라인 추출 */
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

// 아이콘 값을 이미지처럼 렌더해야 하는지 판별(원격 http/https 또는 data:image)
const isImageLike = (v?: string) => !!v && (/^https?:\/\//i.test(v) || v.startsWith('data:image'));
const isRemoteHttp = (v?: string) => !!v && /^https?:\/\//i.test(v);

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [activeIndex, setActiveIndex] = useState<number>(-1); // 키보드 포커스용
  const [isComposing, setIsComposing] = useState(false); // IME 조합 여부

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  const router = useRouter();

  /** 현재 결과 수 메모 */
  const count = results.length;

  /** 입력 변경 시 -> 디바운스 검색 */
  useEffect(() => {
    // 조합 중이면 검색 보류(한글 등)
    if (isComposing) return;

    // 공백/빈 검색어 → 닫고 초기화
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      setActiveIndex(-1);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    // 200ms 디바운스
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      // 이전 요청 취소
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      try {
        const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`, {
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
  }, [query, isComposing]);

  /** 외부 클릭 -> 닫기 */
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

  /** 결과 클릭/Enter 이동 */
  const go = (res: SearchResult | null) => {
    if (!res) return;
    setOpen(false);
    setQuery('');
    setResults([]);
    setActiveIndex(-1);
    router.push(`/wiki?path=${encodeURIComponent(res.path)}&title=${encodeURIComponent(res.title)}`);
  };

  /** 키보드 핸들러 (↑/↓/Enter/Esc) */
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

  /** 드롭다운 ARIA 속성 */
  const listId = useMemo(() => `search-list-${Math.random().toString(36).slice(2)}`, []);

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

      {/* 입력 */}
      <input
        type="search"
        ref={inputRef}
        className="search-input"
        placeholder="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          activeIndex >= 0 && results[activeIndex]
            ? `${listId}-opt-${results[activeIndex].id}`
            : undefined
        }
      />

      {/* 로딩 상태 */}
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

      {/* 결과 없음 */}
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

      {/* 자동완성 드롭다운 */}
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
                {/* 아이콘 */}
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

                {/* 본문 */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* 제목 매치 */}
                  {res.match_type === 'title' && (
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{highlight(res.title, query)}</div>
                  )}

                  {/* 태그 매치 */}
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

                  {/* 본문(슬레이트) 매치 */}
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
