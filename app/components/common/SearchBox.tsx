// =============================================
// File: app/components/common/SearchBox.tsx
// =============================================
'use client';

/**
 * 문서, 태그, 본문 내용 등 다양한 기준으로 위키를 검색하는 검색창 컴포넌트
 * - 입력에 따라 자동 검색/드롭다운
 * - 검색 결과 하이라이트 및 빠른 이동 지원
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 검색 결과 데이터 타입
type SearchResult = {
  id: number;
  title: string;
  path: string | number;
  icon?: string;
  tags: string[];
  match_type: 'title' | 'tags' | 'content';
  content?: string;
};

/**
 * 검색어 하이라이트 함수 (검색 결과 내 일치 부분 강조)
 */
function highlight(text: string, keyword: string) {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(regex).map((part, i) =>
    regex.test(part)
      ? <mark key={i} style={{ background: 'none', color: '#1876f7', fontWeight: 700 }}>{part}</mark>
      : part
  );
}

/**
 * 본문 내 검색어 전후 일부만 미리보기(스니펫)로 추출
 */
function snippet(content: string, keyword: string, length = 48) {
  if (!content) return '';
  const idx = content.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return content.slice(0, length) + (content.length > length ? '...' : '');
  const start = Math.max(0, idx - Math.floor(length / 2));
  const end = Math.min(content.length, start + length);
  const slice = content.slice(start, end);
  return (
    <>
      {start > 0 && '...'}
      {highlight(slice, keyword)}
      {end < content.length && '...'}
    </>
  );
}

/**
 * Slate(문서 본문) JSON 구조에서 검색어 포함된 한 줄의 텍스트 추출
 */
function extractSlateTextLine(slate: any, keyword: string): string | null {
  if (Array.isArray(slate)) {
    for (const node of slate) {
      const found = extractSlateTextLine(node, keyword);
      if (found) return found;
    }
  } else if (typeof slate === 'object' && slate !== null) {
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

/**
 * [SearchBox 컴포넌트]
 * - 실시간 검색 자동완성/드롭다운, 검색 결과 클릭시 해당 문서로 이동
 * - 문서명/태그/본문 세 군데 모두 검색 지원
 */
export default function SearchBox() {
  const [query, setQuery] = useState('');                // 검색어
  const [results, setResults] = useState<SearchResult[]>([]); // 검색 결과
  const [open, setOpen] = useState(false);               // 드롭다운 오픈 여부
  const [loading, setLoading] = useState(false);         // 검색 중 여부
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 검색어 변경 시 검색 API 호출(디바운스 200ms)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const handler = setTimeout(() => {
      fetch(`/api/search?query=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
          setResults(data);
          setOpen(true);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handler);
  }, [query]);

  // 검색창 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        inputRef.current &&
        !inputRef.current.parentElement?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div
      className="wiki-search-container"
      style={{
        position: 'relative',
        width: 600,
        maxWidth: '92vw'
      }}
    >
      {/* 검색 입력창 */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="문서명, 태그, 내용으로 검색..."
        className="w-full px-5 py-3 rounded bg-slate-700 text-white placeholder-gray-400"
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        style={{
          outline: 'none',
          fontSize: 18,
          border: '1.5px solid #e1e6ef',
          background: '#23293a',
        }}
      />
      {/* 자동완성 드롭다운 */}
      {open && results.length > 0 && (
        <ul
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
            // 태그에서 검색어 일치 부분
            const tagMatches = res.tags?.filter(tag => tag.toLowerCase().includes(query.toLowerCase()));
            return (
              <li
                key={res.id}
                className="wiki-search-item"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '13px 30px',
                  cursor: 'pointer',
                  borderBottom: idx !== results.length - 1 ? '1px solid #f5f6fa' : undefined,
                  background: 'transparent',
                  fontSize: 16,
                  lineHeight: 1.3,
                  gap: 14,
                }}
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                  router.push(`/wiki?path=${encodeURIComponent(res.path)}&title=${encodeURIComponent(res.title)}`);
                }}
              >
                {/* 문서 아이콘 */}
                <span style={{ marginRight: 12, fontSize: 22 }}>
                  {res.icon
                    ? (res.icon.startsWith('http')
                        ? <img src={res.icon} alt="" style={{ width: 24, height: 24, verticalAlign: 'middle' }} />
                        : res.icon)
                    : '📄'}
                </span>
                {/* 본문(제목, 태그, 내용) 표시 */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  {/* 제목 일치 */}
                  {res.match_type === 'title' && (
                    <div style={{ fontWeight: 700, fontSize: 18 }}>
                      {highlight(res.title, query)}
                    </div>
                  )}
                  {/* 태그 일치 */}
                  {res.match_type === 'tags' && (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 2 }}>
                        {highlight(res.title, query)}
                      </div>
                      <div style={{ color: '#198544', fontSize: 14, marginTop: 2 }}>
                        {res.tags.map((tag, i) => (
                          <span key={tag + i} style={{ marginRight: 8 }}>
                            {tagMatches.includes(tag)
                              ? highlight(tag, query)
                              : tag}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {/* 본문(내용) 일치 */}
                  {res.match_type === 'content' && (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>
                        {highlight(res.title, query)}
                      </div>
                      <div style={{ color: '#555', fontSize: 14, marginTop: 2 }}>
                        {
                          (() => {
                            let previewText: string | null = '';
                            try {
                              const slate = typeof res.content === 'string' ? JSON.parse(res.content) : res.content;
                              previewText = extractSlateTextLine(slate, query) || '';
                            } catch { previewText = ''; }
                            if (!previewText) return null;
                            return highlight(previewText, query);
                          })()
                        }
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {/* 검색 결과 없음 */}
      {open && !loading && results.length === 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0, right: 0, top: 58,
            background: 'white', color: '#aaa',
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
      {/* 로딩 상태 */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            left: 0, right: 0, top: 58,
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
    </div>
  );
}
