// =============================================
// File: app/components/common/SearchBox.tsx
// (문서/FAQ 동시 검색, 2열 반반 표시, IME 즉시 반응)
// + 헤더 내 중앙/왼쪽 정렬 지원 (align prop)
// + ✅ 문서 태그: 오른쪽에 표시, # 제거
// + 다크모드 대응
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
  content?: string;
  category_breadcrumb?: string;
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

type QuestNpcResult = {
  id: number;
  name: string;
  icon?: string | null;
  village_name?: string | null;
};

// -------------------- utils --------------------
function normalizeSearchText(v: string) {
  return String(v ?? '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function buildCompactIndexMap(text: string) {
  const compactChars: string[] = [];
  const indexMap: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) continue;
    compactChars.push(ch.toLowerCase());
    indexMap.push(i);
  }

  return {
    compact: compactChars.join(''),
    indexMap,
  };
}

function findLooseMatchRange(text: string, keyword: string): { start: number; end: number } | null {
  if (!text || !keyword) return null;

  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) return null;

  const { compact, indexMap } = buildCompactIndexMap(text);
  const idx = compact.indexOf(normalizedKeyword);
  if (idx < 0) return null;

  const start = indexMap[idx];
  const endCompactIdx = idx + normalizedKeyword.length - 1;
  const end = (indexMap[endCompactIdx] ?? start) + 1;

  return { start, end };
}

function highlight(text: string, keyword: string) {
  if (!keyword) return text;

  const range = findLooseMatchRange(text, keyword);
  if (!range) return text;

  const { start, end } = range;

  return (
    <>
      {start > 0 && <span>{text.slice(0, start)}</span>}
      <mark style={{ background: 'none', color: 'var(--accent)', fontWeight: 700 }}>
        {text.slice(start, end)}
      </mark>
      {end < text.length && <span>{text.slice(end)}</span>}
    </>
  );
}

function extractSlateTextSnippets(slate: any): string[] {
  const out: string[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (Array.isArray(n)) {
      for (const x of n) walk(x);
      return;
    }
    if (typeof n === 'object') {
      if (typeof n.text === 'string' && n.text.trim()) out.push(n.text);
      if (Array.isArray(n.children)) walk(n.children);
    }
  };
  walk(slate);
  return out;
}

function makeSnippetFromText(text: string, keyword: string, radius = 26) {
  const range = findLooseMatchRange(text, keyword);
  if (!range) return null;

  const start = Math.max(0, range.start - radius);
  const end = Math.min(text.length, range.end + radius);

  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';

  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function extractSlateSnippet(slate: any, keyword: string): string | null {
  const texts = extractSlateTextSnippets(slate);
  for (const t of texts) {
    const s = makeSnippetFromText(t, keyword);
    if (s) return s;
  }
  return null;
}

const isImageLike = (v?: string) => !!v && (/^https?:\/\//i.test(v) || v.startsWith('data:image'));
const isRemoteHttp = (v?: string) => !!v && /^https?:\/\//i.test(v);

// ✅ 태그 정규화: # 제거 + trim + 빈 값 제거
function normalizeTag(raw: string) {
  return String(raw ?? '').replace(/^#+\s*/, '').trim();
}

function escapeRegexChar(ch: string) {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeLooseRegex(keyword: string) {
  const compact = normalizeSearchText(keyword);
  if (!compact) return null;

  try {
    return new RegExp(compact.split('').map(escapeRegexChar).join('.*'), 'i');
  } catch {
    return null;
  }
}

function isTagMatched(tag: string, keyword: string) {
  const cleanTag = normalizeTag(tag);
  const q = String(keyword ?? '').trim();

  if (!cleanTag || !q) return false;

  const lowerTag = cleanTag.toLowerCase();
  const lowerQ = q.toLowerCase();

  // 1) 일반 포함
  if (lowerTag.includes(lowerQ)) return true;

  // 2) 공백 제거 포함
  const compactTag = normalizeSearchText(cleanTag);
  const compactQ = normalizeSearchText(q);
  if (compactQ && compactTag.includes(compactQ)) return true;

  // 3) 비연속 글자 매칭
  if (compactQ.length >= 2) {
    const loose = makeLooseRegex(q);
    if (loose && loose.test(compactTag)) return true;
  }

  return false;
}

// -------------------- component --------------------
type Props = {
  /** 헤더 안 정렬: center | left */
  align?: 'center' | 'left';
  /** 박스 너비 (CSS 값). 기본: min(720px, 56vw) */
  width?: string;
  /** 퀘스트 NPC 클릭 시 상위에서 모달 열기 */
  onQuestNpcClick?: (id: number) => void;
};

export default function SearchBox({
  align = 'center',
  width = 'min(720px, 56vw)',
  onQuestNpcClick,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  // 문서
  const [docs, setDocs] = useState<DocResult[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const [questNpcs, setQuestNpcs] = useState<QuestNpcResult[]>([]);
  const [loadingQuestNpcs, setLoadingQuestNpcs] = useState(false);

  // FAQ
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);

  const [activeDocIndex, setActiveDocIndex] = useState<number>(-1);
  const [faqView, setFaqView] = useState<FaqItem | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const abortDocsRef = useRef<AbortController | null>(null);
  const abortQuestNpcRef = useRef<AbortController | null>(null);
  const abortFaqRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);

  const router = useRouter();
  const listId = useMemo(() => `search-list-${Math.random().toString(36).slice(2)}`, []);

  // ===== 우선순위 정렬(제목 > 태그 > 내용) =====
  const sortedDocs = useMemo(() => {
    const order: Record<DocResult['match_type'], number> = { title: 0, tags: 1, content: 2 };
    return [...docs].sort((a, b) => {
      const oa = order[a.match_type] ?? 99;
      const ob = order[b.match_type] ?? 99;
      if (oa !== ob) return oa - ob;
      return (a.title?.length ?? 0) - (b.title?.length ?? 0);
    });
  }, [docs]);

  const combinedDocItems = useMemo(() => {
    const docItems = sortedDocs.map((doc) => ({
      kind: 'doc' as const,
      id: doc.id,
      data: doc,
    }));

    const questItems = questNpcs.map((npc) => ({
      kind: 'quest' as const,
      id: npc.id,
      data: npc,
    }));

    return [...docItems, ...questItems];
  }, [sortedDocs, questNpcs]);

  const combinedCount = combinedDocItems.length;

  // ===== 디바운스 & 동시 fetch(문서 + FAQ) =====
  useEffect(() => {
    const q = query.trim();
    const compactQuery = normalizeSearchText(q);

    if (compactQuery.length < 2) {
      setOpen(false);
      setDocs([]);
      setQuestNpcs([]);
      setFaqs([]);
      setActiveDocIndex(-1);
      if (abortDocsRef.current) abortDocsRef.current.abort();
      if (abortQuestNpcRef.current) abortQuestNpcRef.current.abort();
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

      // --- 퀘스트 NPC 요청 ---
      if (abortQuestNpcRef.current) abortQuestNpcRef.current.abort();
      const acQuestNpc = new AbortController();
      abortQuestNpcRef.current = acQuestNpc;
      setLoadingQuestNpcs(true);

      if (compactQuery.length >= 2) {
        (async () => {
          try {
            const res = await fetch(
              `/api/search/quest?query=${encodeURIComponent(q)}&limit=20`,
              { signal: acQuestNpc.signal, cache: 'no-store' }
            );
            if (!res.ok) throw new Error('quest-search-failed');
            const data = (await res.json()) as QuestNpcResult[];
            setQuestNpcs(Array.isArray(data) ? data : []);
          } catch (e: any) {
            if (e?.name !== 'AbortError') setQuestNpcs([]);
          } finally {
            setLoadingQuestNpcs(false);
          }
        })();
      } else {
        setQuestNpcs([]);
        setLoadingQuestNpcs(false);
      }

      (async () => {
        try {
          const res = await fetch(
            `/api/search?query=${encodeURIComponent(q)}&compact=${encodeURIComponent(compactQuery)}&limit=50`,
            {
              signal: acDocs.signal,
              cache: 'no-store',
            }
          );
          if (!res.ok) throw new Error('search-failed');
          const data = (await res.json()) as DocResult[];
          setDocs(Array.isArray(data) ? data : []);
          setActiveDocIndex(data?.length ? 0 : -1);
        } catch (e: any) {
          if (e?.name !== 'AbortError') {
            setDocs([]);
            setActiveDocIndex(-1);
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
        window.setTimeout(async () => {
          try {
            const url =
              `/api/faq?q=${encodeURIComponent(q)}` +
              `&compact=${encodeURIComponent(compactQuery)}` +
              `&limit=10&offset=0`;

            const res = await fetch(url, {
              signal: acFaq.signal,
              cache: 'no-store',
            });

            const data = res.ok ? await res.json() : { items: [] };
            setFaqs(Array.isArray(data.items) ? data.items : []);
          } catch (e: any) {
            if (e?.name !== 'AbortError') setFaqs([]);
          } finally {
            setLoadingFaqs(false);
          }
        }, 180);
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
    setDocs([]);
    setFaqs([]);
    setActiveDocIndex(-1);
    router.push(
      `/wiki?id=${encodeURIComponent(res.id)}&path=${encodeURIComponent(res.path)}&title=${encodeURIComponent(res.title)}`
    );
  };

  const openQuestNpc = (npc: QuestNpcResult | null) => {
    if (!npc) return;

    setOpen(false);
    setQuery('');
    setDocs([]);
    setQuestNpcs([]);
    setFaqs([]);
    setActiveDocIndex(-1);

    onQuestNpcClick?.(npc.id);
  };

  // 키보드(문서 리스트 포커스)
  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!open || (!combinedCount && e.key !== 'Escape')) {
      if (e.key === 'Escape') {
        setOpen(false);
        setActiveDocIndex(-1);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveDocIndex((i) => (combinedCount ? (i + 1) % combinedCount : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveDocIndex((i) => (combinedCount ? (i - 1 + combinedCount) % combinedCount : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();

      const picked = combinedDocItems[activeDocIndex] ?? combinedDocItems[0] ?? null;
      if (!picked) return;

      if (picked.kind === 'doc') {
        goDoc(picked.data);
      } else {
        openQuestNpc(picked.data);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setActiveDocIndex(-1);
    }
  };

  // ✅ 드롭다운 내부 스크롤을 위한 높이 기준값
  const dropdownMaxH = 'min(72vh, 560px)';

  return (
    <div
      ref={wrapRef}
      className="search-wrapper"
      role="combobox"
      aria-expanded={open}
      aria-owns={listId}
      aria-haspopup="listbox"
      data-align={align}
      style={{ width }}
    >
      <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z" />
      </svg>

      <input
        type="search"
        ref={inputRef}
        className="search-input"
        placeholder="Search"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => (docs.length || questNpcs.length || faqs.length) && setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          activeDocIndex >= 0 && combinedDocItems[activeDocIndex]
            ? `${listId}-opt-${combinedDocItems[activeDocIndex].kind}-${combinedDocItems[activeDocIndex].id}`
            : undefined
        }
      />

      {open && (
        <div
          className="wiki-search-dropdown"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 58,
            zIndex: 9999,
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-lg)',
            padding: '10px 12px',
            maxHeight: dropdownMaxH,
            overflow: 'auto',
          }}
        >
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
            <div style={{ borderRight: '1px solid var(--border-soft)', paddingRight: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
                문서
              </div>

              {!loadingDocs && !loadingQuestNpcs && combinedDocItems.length === 0 && (
                <div style={{ color: 'var(--muted-2)', fontSize: 14, padding: '6px 4px' }}>
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
                  maxHeight: 420,
                  overflowY: 'auto',
                }}
              >
                {combinedDocItems.map((item, idx) => {
                  const selected = idx === activeDocIndex;

                  if (item.kind === 'doc') {
                    const res = item.data;

                    let contentSnippet: string | null = null;
                    if (res.match_type === 'content') {
                      try {
                        const slate = typeof res.content === 'string' ? JSON.parse(res.content) : res.content;
                        contentSnippet = extractSlateSnippet(slate, query);
                      } catch {
                        contentSnippet = null;
                      }
                    }

                    const cleanTags = (res.tags ?? [])
                      .map(normalizeTag)
                      .filter(Boolean)
                      .filter((tag) => isTagMatched(tag, query));

                    return (
                      <li
                        id={`${listId}-opt-doc-${res.id}`}
                        role="option"
                        aria-selected={selected}
                        key={`doc-${res.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          padding: '11px 12px',
                          cursor: 'pointer',
                          borderBottom: idx !== combinedDocItems.length - 1 ? '1px solid var(--border-soft)' : undefined,
                          background: selected ? 'var(--accent-soft)' : 'transparent',
                          color: 'var(--foreground)',
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

                        <div style={{ minWidth: 0, flex: 1, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{highlight(res.title, query)}</div>

                            {!!res.category_breadcrumb && (
                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: 12,
                                  color: 'var(--muted-2)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={res.category_breadcrumb}
                              >
                                {res.category_breadcrumb}
                              </div>
                            )}

                            {res.match_type === 'content' && contentSnippet && (
                              <div
                                style={{
                                  color: 'var(--muted)',
                                  fontSize: 13,
                                  marginTop: 6,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {highlight(contentSnippet, query)}
                              </div>
                            )}
                          </div>

                          {cleanTags.length > 0 && (
                            <div
                              style={{
                                flex: '0 0 auto',
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'flex-end',
                                gap: 6,
                                maxWidth: 180,
                                marginTop: 2,
                              }}
                            >
                              {cleanTags.map((t, i) => (
                                <span
                                  key={`${t}-${i}`}
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--tag-fg)',
                                    background: 'var(--tag-bg)',
                                    border: '1px solid var(--tag-border)',
                                    borderRadius: 999,
                                    padding: '2px 8px',
                                    lineHeight: 1.4,
                                    maxWidth: 180,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={t}
                                >
                                  {highlight(t, query)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  }

                  const npc = item.data;
                  const villageName = String(npc.village_name ?? '').trim();

                  return (
                    <li
                      id={`${listId}-opt-quest-${npc.id}`}
                      role="option"
                      aria-selected={selected}
                      key={`quest-${npc.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        padding: '11px 12px',
                        cursor: 'pointer',
                        borderBottom: idx !== combinedDocItems.length - 1 ? '1px solid var(--border-soft)' : undefined,
                        background: selected ? 'var(--accent-soft)' : 'transparent',
                        color: 'var(--foreground)',
                        fontSize: 15,
                        lineHeight: 1.3,
                        gap: 10,
                        borderRadius: 8,
                      }}
                      onMouseEnter={() => setActiveDocIndex(idx)}
                      onClick={() => openQuestNpc(npc)}
                    >
                      <span style={{ marginRight: 8, fontSize: 20 }}>
                        {npc.icon ? (
                          isImageLike(npc.icon ?? undefined) ? (
                            <img
                              src={isRemoteHttp(npc.icon ?? undefined) ? toProxyUrl(npc.icon as string) : (npc.icon as string)}
                              alt=""
                              width={22}
                              height={22}
                              style={{ width: 22, height: 22, objectFit: 'cover' }}
                              loading="lazy"
                              decoding="async"
                              draggable={false}
                            />
                          ) : (
                            npc.icon
                          )
                        ) : (
                          '🧑'
                        )}
                      </span>

                      <div style={{ minWidth: 0, flex: 1, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{highlight(npc.name, query)}</div>

                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              color: 'var(--muted-2)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title="퀘스트"
                          >
                            퀘스트
                          </div>
                        </div>

                        {villageName && (
                          <div
                            style={{
                              flex: '0 0 auto',
                              display: 'flex',
                              flexWrap: 'wrap',
                              justifyContent: 'flex-end',
                              gap: 6,
                              maxWidth: 180,
                              marginTop: 2,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: 'var(--tag-fg)',
                                background: 'var(--tag-bg)',
                                border: '1px solid var(--tag-border)',
                                borderRadius: 999,
                                padding: '2px 8px',
                                lineHeight: 1.4,
                                maxWidth: 180,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={villageName}
                            >
                              {highlight(villageName, query)}
                            </span>
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
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
                자주 묻는 질문
              </div>

              {!loadingFaqs && faqs.length === 0 && (
                <div style={{ color: 'var(--muted-2)', fontSize: 14, padding: '6px 4px' }}>
                  결과가 없습니다.
                </div>
              )}

              <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 420, overflowY: 'auto' }}>
                {faqs.map((f) => (
                  <li
                    key={`faq-${f.id}`}
                    style={{
                      padding: '11px 12px',
                      borderBottom: '1px solid var(--border-soft)',
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
                          background: 'var(--faq-q-bg)',
                          color: 'var(--faq-q-fg)',
                          fontWeight: 900,
                          fontSize: 12.5,
                          flex: '0 0 20px',
                        }}
                        aria-hidden
                      >
                        Q
                      </span>
                      <div style={{ fontWeight: 700, fontSize: 15, minWidth: 0, color: 'var(--foreground)' }}>
                        {highlight(f.title, query)}
                      </div>
                    </div>
                    {f.tags?.length > 0 && (
                      <div
                        style={{
                          color: 'var(--tag-fg)',
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
            background: 'var(--overlay)',
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
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 16,
              boxShadow: 'var(--shadow-xl)',
              color: 'var(--foreground)',
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
                    background: 'var(--faq-q-bg)',
                    color: 'var(--faq-q-fg)',
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
                  width: 34,
                  height: 34,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--danger-fg)',
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
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  background: 'var(--faq-a-bg)',
                  border: '1px solid var(--faq-a-border)',
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: 'var(--faq-a-badge-bg)',
                    color: 'var(--faq-a-badge-fg)',
                    fontWeight: 900,
                    fontSize: 13.5,
                    flex: '0 0 22px',
                  }}
                >
                  A
                </span>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', font: 'inherit', color: 'var(--foreground)' }}>
                  {faqView.content}
                </pre>
              </div>
              {faqView.tags?.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    color: 'var(--tag-fg)',
                    fontSize: 12,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  {faqView.tags.map((t, i) => (
                    <span key={t + i}>#{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .search-wrapper {
          max-width: 100%;
        }
        @media (max-width: 768px) {
          .search-wrapper {
            width: min(92vw, 640px) !important;
          }
        }
      `}</style>
    </div>
  );
}