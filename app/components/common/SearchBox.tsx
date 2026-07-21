// =============================================
// File: app/components/common/SearchBox.tsx
// 전체 교체용 코드
// - 문서 / 문서 본문·목차 / 태그 검색
// - 퀘스트 NPC 검색 및 상위 모달 연결
// - FAQ(Q&A) 검색 및 내부 상세 모달
// - Home과 Wiki Header에서 같은 컴포넌트 재사용
// =============================================

'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEventHandler,
} from 'react';
import { useRouter } from 'next/navigation';

import { toProxyUrl } from '@lib/cdn';
import { markNextDocViewSource } from '@/wiki/lib/viewSource';

type DocResult = {
  id: number;
  title: string;
  path: string | number;
  icon?: string;
  tags: string[];
  match_type: 'title' | 'tags' | 'content';
  category_breadcrumb?: string;
  section_heading?: string | null;
  section_dom_id?: string | null;
  section_level?: 1 | 2 | 3 | null;
  section_snippet?: string | null;
  section_match_source?: 'heading' | 'body' | null;
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

type SearchResultItem =
  | {
      kind: 'doc';
      id: number;
      data: DocResult;
    }
  | {
      kind: 'quest';
      id: number;
      data: QuestNpcResult;
    };

type Props = {
  /** 검색창 정렬 */
  align?: 'center' | 'left';

  /** 검색창 전체 너비 */
  width?: string;

  /** 기존 헤더 배치 호환용 왼쪽 패딩 */
  paddingLeft?: number;

  /** 퀘스트 NPC 결과 클릭 시 상세 모달을 열기 위한 콜백 */
  onQuestNpcClick?: (id: number) => void;

  /**
   * SearchBox 바깥에서 열린 결과 상세 모달 상태.
   * true인 동안 모달 배경 클릭을 외부 클릭으로 처리하지 않는다.
   */
  resultModalOpen?: boolean;
};

function normalizeSearchText(value: string) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function buildCompactIndexMap(text: string) {
  const compactChars: string[] = [];
  const indexMap: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (/\s/.test(character)) {
      continue;
    }

    compactChars.push(character.toLowerCase());
    indexMap.push(index);
  }

  return {
    compact: compactChars.join(''),
    indexMap,
  };
}

function findLooseMatchRange(
  text: string,
  keyword: string
): { start: number; end: number } | null {
  if (!text || !keyword) {
    return null;
  }

  const normalizedKeyword = normalizeSearchText(keyword);

  if (!normalizedKeyword) {
    return null;
  }

  const { compact, indexMap } = buildCompactIndexMap(text);
  const compactStart = compact.indexOf(normalizedKeyword);

  if (compactStart < 0) {
    return null;
  }

  const start = indexMap[compactStart];
  const compactEnd = compactStart + normalizedKeyword.length - 1;
  const end = (indexMap[compactEnd] ?? start) + 1;

  return { start, end };
}

function highlight(text: string, keyword: string) {
  if (!keyword) {
    return text;
  }

  const range = findLooseMatchRange(text, keyword);

  if (!range) {
    return text;
  }

  return (
    <>
      {range.start > 0 && text.slice(0, range.start)}
      <mark className="rd-search-highlight">
        {text.slice(range.start, range.end)}
      </mark>
      {range.end < text.length && text.slice(range.end)}
    </>
  );
}

function normalizeTag(raw: string) {
  return String(raw ?? '')
    .replace(/^#+\s*/, '')
    .trim();
}

function escapeRegexCharacter(character: string) {
  return character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeLooseRegex(keyword: string) {
  const compact = normalizeSearchText(keyword);

  if (!compact) {
    return null;
  }

  try {
    return new RegExp(
      compact
        .split('')
        .map(escapeRegexCharacter)
        .join('.*'),
      'i'
    );
  } catch {
    return null;
  }
}

function isTagMatched(tag: string, keyword: string) {
  const cleanTag = normalizeTag(tag);
  const query = String(keyword ?? '').trim();

  if (!cleanTag || !query) {
    return false;
  }

  const lowerTag = cleanTag.toLowerCase();
  const lowerQuery = query.toLowerCase();

  if (lowerTag.includes(lowerQuery)) {
    return true;
  }

  const compactTag = normalizeSearchText(cleanTag);
  const compactQuery = normalizeSearchText(query);

  if (compactQuery && compactTag.includes(compactQuery)) {
    return true;
  }

  if (compactQuery.length >= 2) {
    const looseRegex = makeLooseRegex(query);

    if (looseRegex?.test(compactTag)) {
      return true;
    }
  }

  return false;
}

function isImageLike(value?: string | null) {
  return Boolean(
    value &&
      (/^https?:\/\//i.test(value) || value.startsWith('data:image'))
  );
}

function getImageSource(value: string) {
  return /^https?:\/\//i.test(value) ? toProxyUrl(value) : value;
}

function getDocumentPriority(document: DocResult) {
  if (document.match_type === 'title') {
    return 0;
  }

  if (
    document.match_type === 'content' &&
    document.section_match_source === 'heading'
  ) {
    return 1;
  }

  if (document.match_type === 'tags') {
    return 2;
  }

  if (
    document.match_type === 'content' &&
    document.section_match_source === 'body'
  ) {
    return 3;
  }

  if (document.match_type === 'content') {
    return 4;
  }

  return 99;
}

export default function SearchBox({
  align = 'center',
  width = 'min(720px, 56vw)',
  paddingLeft = 100,
  onQuestNpcClick,
  resultModalOpen = false,
}: Props) {
  const router = useRouter();
  const generatedListId = useId();
  const listId = `rd-search-${generatedListId.replace(/:/g, '')}`;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const [docs, setDocs] = useState<DocResult[]>([]);
  const [questNpcs, setQuestNpcs] = useState<QuestNpcResult[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingQuestNpcs, setLoadingQuestNpcs] = useState(false);
  const [loadingFaqs, setLoadingFaqs] = useState(false);

  const [activeDocIndex, setActiveDocIndex] = useState(-1);
  const [faqView, setFaqView] = useState<FaqItem | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const abortDocsRef = useRef<AbortController | null>(null);
  const abortQuestNpcRef = useRef<AbortController | null>(null);
  const abortFaqRef = useRef<AbortController | null>(null);

  const debounceTimerRef = useRef<number | null>(null);
  const faqDelayTimerRef = useRef<number | null>(null);

  const sortedDocs = useMemo(() => {
    return docs
      .map((document, originalIndex) => ({
        document,
        originalIndex,
      }))
      .sort((first, second) => {
        const priorityDifference =
          getDocumentPriority(first.document) -
          getDocumentPriority(second.document);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return first.originalIndex - second.originalIndex;
      })
      .map(({ document }) => document);
  }, [docs]);

  const combinedDocItems = useMemo<SearchResultItem[]>(() => {
    const documentItems: SearchResultItem[] = sortedDocs.map((document) => ({
      kind: 'doc',
      id: document.id,
      data: document,
    }));

    const questItems: SearchResultItem[] = questNpcs.map((npc) => ({
      kind: 'quest',
      id: npc.id,
      data: npc,
    }));

    return [...documentItems, ...questItems];
  }, [questNpcs, sortedDocs]);

  const combinedCount = combinedDocItems.length;

  useEffect(() => {
    if (combinedCount === 0) {
      setActiveDocIndex(-1);
      return;
    }

    setActiveDocIndex((currentIndex) => {
      if (currentIndex < 0) {
        return 0;
      }

      return Math.min(currentIndex, combinedCount - 1);
    });
  }, [combinedCount]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    const compactQuery = normalizeSearchText(trimmedQuery);

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (faqDelayTimerRef.current !== null) {
      window.clearTimeout(faqDelayTimerRef.current);
      faqDelayTimerRef.current = null;
    }

    abortDocsRef.current?.abort();
    abortQuestNpcRef.current?.abort();
    abortFaqRef.current?.abort();

    if (compactQuery.length < 2) {
      setOpen(false);
      setDocs([]);
      setQuestNpcs([]);
      setFaqs([]);
      setLoadingDocs(false);
      setLoadingQuestNpcs(false);
      setLoadingFaqs(false);
      setActiveDocIndex(-1);
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      const docsController = new AbortController();
      const questController = new AbortController();
      const faqController = new AbortController();

      abortDocsRef.current = docsController;
      abortQuestNpcRef.current = questController;
      abortFaqRef.current = faqController;

      setLoadingDocs(true);
      setLoadingQuestNpcs(true);
      setLoadingFaqs(true);
      setOpen(true);

      void (async () => {
        try {
          const response = await fetch(
            `/api/search?query=${encodeURIComponent(
              trimmedQuery
            )}&compact=${encodeURIComponent(compactQuery)}&limit=50`,
            {
              signal: docsController.signal,
              cache: 'no-store',
            }
          );

          if (!response.ok) {
            throw new Error(`document-search-failed:${response.status}`);
          }

          const data = (await response.json()) as DocResult[];

          setDocs(Array.isArray(data) ? data : []);
        } catch (error) {
          if (
            !(error instanceof DOMException && error.name === 'AbortError')
          ) {
            console.error('[SearchBox] 문서 검색 실패:', error);
            setDocs([]);
          }
        } finally {
          if (!docsController.signal.aborted) {
            setLoadingDocs(false);
          }
        }
      })();

      void (async () => {
        try {
          const response = await fetch(
            `/api/search/quest?query=${encodeURIComponent(
              trimmedQuery
            )}&limit=20`,
            {
              signal: questController.signal,
              cache: 'no-store',
            }
          );

          if (!response.ok) {
            throw new Error(`quest-search-failed:${response.status}`);
          }

          const data = (await response.json()) as QuestNpcResult[];

          setQuestNpcs(Array.isArray(data) ? data : []);
        } catch (error) {
          if (
            !(error instanceof DOMException && error.name === 'AbortError')
          ) {
            console.error('[SearchBox] 퀘스트 NPC 검색 실패:', error);
            setQuestNpcs([]);
          }
        } finally {
          if (!questController.signal.aborted) {
            setLoadingQuestNpcs(false);
          }
        }
      })();

      faqDelayTimerRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            const response = await fetch(
              `/api/faq?q=${encodeURIComponent(
                trimmedQuery
              )}&compact=${encodeURIComponent(
                compactQuery
              )}&limit=10&offset=0`,
              {
                signal: faqController.signal,
                cache: 'no-store',
              }
            );

            const data = response.ok
              ? ((await response.json()) as { items?: FaqItem[] })
              : { items: [] };

            setFaqs(Array.isArray(data.items) ? data.items : []);
          } catch (error) {
            if (
              !(error instanceof DOMException && error.name === 'AbortError')
            ) {
              console.error('[SearchBox] FAQ 검색 실패:', error);
              setFaqs([]);
            }
          } finally {
            if (!faqController.signal.aborted) {
              setLoadingFaqs(false);
            }
          }
        })();
      }, 180);
    }, 200);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }

      if (faqDelayTimerRef.current !== null) {
        window.clearTimeout(faqDelayTimerRef.current);
      }
    };
  }, [query]);

  useEffect(() => {
    return () => {
      abortDocsRef.current?.abort();
      abortQuestNpcRef.current?.abort();
      abortFaqRef.current?.abort();

      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }

      if (faqDelayTimerRef.current !== null) {
        window.clearTimeout(faqDelayTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleOutsideMouseDown = (event: MouseEvent) => {
      const root = wrapRef.current;

      if (!root) {
        return;
      }

      /*
       * FAQ 모달 또는 부모가 연 NPC 모달이 열린 동안에는
       * 모달 배경·닫기 버튼 클릭을 검색창 외부 클릭으로 취급하지 않는다.
       * 모달이 없는 일반 상태에서만 바깥 클릭으로 결과창을 닫는다.
       */
      if (faqView || resultModalOpen) {
        return;
      }

      if (!root.contains(event.target as Node)) {
        setOpen(false);
        setActiveDocIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleOutsideMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideMouseDown);
    };
  }, [faqView, resultModalOpen]);

  const resetSearchState = () => {
    setOpen(false);
    setQuery('');
    setDocs([]);
    setQuestNpcs([]);
    setFaqs([]);
    setActiveDocIndex(-1);
  };

  const goDocument = (document: DocResult | null) => {
    if (!document) {
      return;
    }

    const sectionDomId = String(document.section_dom_id ?? '').trim();

    const href =
      `/wiki?id=${encodeURIComponent(document.id)}` +
      `&path=${encodeURIComponent(document.path)}` +
      `&title=${encodeURIComponent(document.title)}` +
      (sectionDomId ? `#${encodeURIComponent(sectionDomId)}` : '');

    resetSearchState();
    markNextDocViewSource('search');
    router.push(href, { scroll: false });

    if (sectionDomId && typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent('rdwiki:search-hash-nav', {
            detail: {
              domId: sectionDomId,
            },
          })
        );
      });
    }
  };

  const openQuestNpc = (npc: QuestNpcResult | null) => {
    if (!npc) {
      return;
    }

    /*
     * 상세 모달을 닫았을 때 같은 검색 결과로 돌아올 수 있도록
     * query/results/open 상태를 그대로 유지한다.
     */
    setOpen(true);
    onQuestNpcClick?.(npc.id);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveDocIndex(-1);
      return;
    }

    if (!open || combinedCount === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveDocIndex((currentIndex) =>
        (currentIndex + 1 + combinedCount) % combinedCount
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveDocIndex((currentIndex) =>
        (currentIndex - 1 + combinedCount) % combinedCount
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      const selectedItem =
        combinedDocItems[activeDocIndex] ?? combinedDocItems[0] ?? null;

      if (!selectedItem) {
        return;
      }

      if (selectedItem.kind === 'doc') {
        goDocument(selectedItem.data);
      } else {
        openQuestNpc(selectedItem.data);
      }
    }
  };

  const renderDocumentTitle = (document: DocResult) => {
    if (document.match_type === 'title') {
      return (
        <mark className="rd-search-highlight">{document.title}</mark>
      );
    }

    return highlight(document.title, query);
  };

  const renderDocumentMeta = (document: DocResult) => {
    const sectionHeading = String(document.section_heading ?? '').trim();
    const breadcrumb = String(document.category_breadcrumb ?? '').trim();

    if (document.match_type === 'content' && sectionHeading) {
      return (
        <span className="rd-search-item-meta">
          {highlight(sectionHeading, query)}
        </span>
      );
    }

    if (!breadcrumb) {
      return null;
    }

    return (
      <span className="rd-search-item-meta">
        {highlight(breadcrumb, query)}
      </span>
    );
  };

  const wrapperMargin =
    align === 'center'
      ? {
          marginLeft: 'auto',
          marginRight: 'auto',
        }
      : {
          marginLeft: 0,
          marginRight: 0,
        };

  return (
    <>
      <div
        ref={wrapRef}
        className="rd-search-root"
        style={{
          width,
          paddingLeft,
          ...wrapperMargin,
        }}
      >
        <div className="rd-search-input-shell">
          <span className="rd-search-input-icon" aria-hidden="true">
            ⌕
          </span>

          <input
            ref={inputRef}
            value={query}
            className="rd-search-input"
            type="search"
            role="combobox"
            placeholder="검색어를 입력하세요."
            aria-label="렌독위키 통합 검색"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={
              activeDocIndex >= 0 && combinedDocItems[activeDocIndex]
                ? `${listId}-option-${combinedDocItems[activeDocIndex].kind}-${combinedDocItems[activeDocIndex].id}`
                : undefined
            }
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onInput={(event) => {
              setQuery((event.target as HTMLInputElement).value);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onFocus={() => {
              if (
                query.trim().length >= 2 &&
                (docs.length > 0 ||
                  questNpcs.length > 0 ||
                  faqs.length > 0 ||
                  loadingDocs ||
                  loadingQuestNpcs ||
                  loadingFaqs)
              ) {
                setOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        {open && (
          <div
            id={listId}
            className="rd-search-dropdown"
            role="listbox"
            aria-label="통합 검색 결과"
          >
            <section className="rd-search-column rd-search-document-column">
              <div className="rd-search-column-heading">
                <strong>문서</strong>

                {(loadingDocs || loadingQuestNpcs) && (
                  <span>검색 중...</span>
                )}
              </div>

              {!loadingDocs &&
                !loadingQuestNpcs &&
                combinedDocItems.length === 0 && (
                  <p className="rd-search-empty">결과가 없습니다.</p>
                )}

              <div className="rd-search-list">
                {combinedDocItems.map((item, index) => {
                  const selected = index === activeDocIndex;

                  if (item.kind === 'doc') {
                    const document = item.data;
                    const matchedTags = (document.tags ?? [])
                      .map(normalizeTag)
                      .filter(Boolean)
                      .filter((tag) => isTagMatched(tag, query));

                    return (
                      <button
                        key={`document-${document.id}-${index}`}
                        id={`${listId}-option-doc-${document.id}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`rd-search-result ${
                          selected ? 'is-selected' : ''
                        }`}
                        onMouseEnter={() => setActiveDocIndex(index)}
                        onClick={() => goDocument(document)}
                      >
                        <span className="rd-search-result-icon">
                          {document.icon ? (
                            isImageLike(document.icon) ? (
                              <img
                                src={getImageSource(document.icon)}
                                alt=""
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              document.icon
                            )
                          ) : (
                            '📄'
                          )}
                        </span>

                        <span className="rd-search-result-body">
                          <span className="rd-search-result-text">
                            <span className="rd-search-result-title">
                              {renderDocumentTitle(document)}
                            </span>

                            {renderDocumentMeta(document)}
                          </span>

                          {matchedTags.length > 0 && (
                            <span className="rd-search-tag-row">
                              {matchedTags.map((tag) => (
                                <span
                                  key={`${document.id}-${tag}`}
                                  className="rd-search-tag"
                                >
                                  {highlight(tag, query)}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  }

                  const npc = item.data;
                  const villageName = String(
                    npc.village_name ?? ''
                  ).trim();

                  return (
                    <button
                      key={`quest-${npc.id}-${index}`}
                      id={`${listId}-option-quest-${npc.id}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`rd-search-result ${
                        selected ? 'is-selected' : ''
                      }`}
                      onMouseEnter={() => setActiveDocIndex(index)}
                      onClick={() => openQuestNpc(npc)}
                    >
                      <span className="rd-search-result-icon">
                        {npc.icon ? (
                          isImageLike(npc.icon) ? (
                            <img
                              src={getImageSource(npc.icon)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            npc.icon
                          )
                        ) : (
                          '🧑'
                        )}
                      </span>

                      <span className="rd-search-result-body">
                        <span className="rd-search-result-text">
                          <span className="rd-search-result-title">
                            {highlight(npc.name, query)}
                          </span>

                          <span className="rd-search-item-meta">
                            퀘스트
                          </span>
                        </span>

                        {villageName && (
                          <span className="rd-search-tag-row">
                            <span className="rd-search-tag">
                              {highlight(villageName, query)}
                            </span>
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rd-search-column rd-search-faq-column">
              <div className="rd-search-column-heading">
                <strong>자주 묻는 질문</strong>

                {loadingFaqs && <span>검색 중...</span>}
              </div>

              {!loadingFaqs && faqs.length === 0 && (
                <p className="rd-search-empty">결과가 없습니다.</p>
              )}

              <div className="rd-search-list">
                {faqs.map((faq) => (
                  <button
                    key={`faq-${faq.id}`}
                    type="button"
                    className="rd-search-result rd-search-faq-result"
                    onClick={() => {
                      setOpen(true);
                      setFaqView(faq);
                    }}
                  >
                    <span className="rd-search-faq-badge">Q</span>

                    <span className="rd-search-result-body">
                      <span className="rd-search-result-text">
                        <span className="rd-search-result-title">
                          {highlight(faq.title, query)}
                        </span>
                      </span>

                      {faq.tags?.length > 0 && (
                        <span className="rd-search-tag-row">
                          {faq.tags.map((tag) => (
                            <span
                              key={`${faq.id}-${tag}`}
                              className="rd-search-tag"
                            >
                              {highlight(normalizeTag(tag), query)}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {faqView && (
        <div
          className="rd-search-faq-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${faqView.title} 답변`}
          onClick={() => setFaqView(null)}
        >
          <article
            className="rd-search-faq-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="rd-search-faq-modal-header">
              <div>
                <span className="rd-search-faq-modal-label">Q</span>
                <h2>{faqView.title}</h2>
              </div>

              <button
                type="button"
                aria-label="FAQ 닫기"
                onClick={() => setFaqView(null)}
              >
                ×
              </button>
            </header>

            <div className="rd-search-faq-answer">
              <span className="rd-search-faq-modal-label answer">A</span>
              <p>{faqView.content}</p>
            </div>

            {faqView.tags?.length > 0 && (
              <div className="rd-search-faq-modal-tags">
                {faqView.tags.map((tag) => (
                  <span key={`${faqView.id}-${tag}`}>
                    #{normalizeTag(tag)}
                  </span>
                ))}
              </div>
            )}
          </article>
        </div>
      )}

      <style jsx>{`
        .rd-search-root {
          position: relative;
          z-index: 1200;
          box-sizing: border-box;
          min-width: 0;
        }

        .rd-search-input-shell {
          display: flex;
          align-items: center;
          width: 100%;
          height: 46px;
          overflow: hidden;
          border: 1px solid var(--border, #d8e1da);
          border-radius: 999px;
          background: var(--surface-elevated, #ffffff);
          box-shadow:
            0 8px 22px rgba(15, 23, 42, 0.07),
            inset 0 1px 0 rgba(255, 255, 255, 0.7);
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .rd-search-input-shell:focus-within {
          border-color: #69ad72;
          box-shadow:
            0 0 0 3px rgba(105, 173, 114, 0.16),
            0 10px 28px rgba(15, 23, 42, 0.08);
        }

        .rd-search-input-icon {
          display: grid;
          place-items: center;
          flex: 0 0 43px;
          width: 43px;
          color: #4b9257;
          font-size: 27px;
          line-height: 1;
          user-select: none;
        }

        .rd-search-input {
          width: 100%;
          min-width: 0;
          height: 100%;
          padding: 0 18px 0 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--foreground, #1f2937);
          font: inherit;
          font-size: 14px;
        }

        .rd-search-input::-webkit-search-cancel-button {
          cursor: pointer;
        }

        .rd-search-input::placeholder {
          color: var(--muted-2, #8b9890);
        }

        .rd-search-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: ${paddingLeft}px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          width: calc(100% - ${paddingLeft}px);
          max-height: min(56vh, 460px);
          padding: 10px 12px;
          gap: 12px;
          overflow: hidden;
          border: 1px solid var(--border, #d8e1da);
          border-radius: 10px;
          background: var(--surface-elevated, #ffffff);
          box-shadow: var(
            --shadow-lg,
            0 18px 42px rgba(15, 23, 42, 0.18)
          );
          color: var(--foreground, #1f2937);
        }

        .rd-search-column {
          min-width: 0;
          min-height: 0;
          max-height: calc(min(56vh, 460px) - 20px);
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
          touch-action: pan-y;
        }

        .rd-search-document-column {
          padding-right: 8px;
          border-right: 1px solid var(--border-soft, #edf1ee);
        }

        .rd-search-faq-column {
          padding-left: 8px;
        }

        .rd-search-column::-webkit-scrollbar {
          width: 8px;
        }

        .rd-search-column::-webkit-scrollbar-thumb {
          border: 2px solid transparent;
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--muted-2, #8b9890) 48%,
            transparent
          );
          background-clip: padding-box;
        }

        .rd-search-column::-webkit-scrollbar-track {
          background: transparent;
        }

        .rd-search-column-heading {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 28px;
          margin-bottom: 6px;
          padding: 0 4px;
          background: var(--surface-elevated, #ffffff);
        }

        .rd-search-column-heading strong {
          color: var(--muted, #6b7280);
          font-size: 13px;
          font-weight: 800;
        }

        .rd-search-column-heading span {
          color: var(--muted-2, #8b9890);
          font-size: 10px;
        }

        .rd-search-list {
          display: flex;
          flex-direction: column;
          margin: 0;
          padding: 0;
          gap: 0;
        }

        .rd-search-result {
          display: flex;
          align-items: flex-start;
          width: 100%;
          min-width: 0;
          padding: 8px 6px;
          gap: 8px;
          border: 0;
          border-bottom: 1px solid var(--border-soft, #edf1ee);
          border-radius: 8px;
          background: transparent;
          color: inherit;
          font: inherit;
          line-height: 1.3;
          text-align: left;
          cursor: pointer;
        }

        .rd-search-result:last-child {
          border-bottom-color: transparent;
        }

        .rd-search-result:hover,
        .rd-search-result.is-selected {
          background: var(--accent-soft, #eef8ef);
        }

        .rd-search-result-icon {
          display: grid;
          place-items: center;
          flex: 0 0 22px;
          width: 22px;
          height: 22px;
          overflow: hidden;
          margin-top: 1px;
          border-radius: 3px;
          background: transparent;
          font-size: 19px;
          line-height: 1;
        }

        .rd-search-result-icon img {
          width: 22px;
          height: 22px;
          object-fit: cover;
        }

        .rd-search-result-body {
          display: flex;
          flex: 1;
          min-width: 0;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .rd-search-result-text {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          gap: 3px;
        }

        .rd-search-result-title {
          overflow: hidden;
          color: var(--foreground, #1f2937);
          font-size: 15px;
          font-weight: 700;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .rd-search-item-meta,
        .rd-search-item-snippet {
          overflow: hidden;
          color: var(--muted-2, #8b9890);
          font-size: 11px;
          line-height: 1.35;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .rd-search-tag-row {
          display: flex;
          flex: 0 1 170px;
          min-width: 0;
          max-width: 170px;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 5px;
          margin: 1px 0 0;
        }

        .rd-search-tag {
          max-width: 170px;
          overflow: hidden;
          padding: 2px 7px;
          border: 1px solid var(--tag-border, transparent);
          border-radius: 999px;
          background: var(--tag-bg, #eef6ef);
          color: var(--tag-fg, #43804d);
          font-size: 11px;
          line-height: 1.35;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .rd-search-faq-result {
          align-items: flex-start;
        }

        .rd-search-faq-badge,
        .rd-search-faq-modal-label {
          display: grid;
          place-items: center;
          flex: 0 0 20px;
          width: 20px;
          height: 20px;
          margin-top: 1px;
          border-radius: 999px;
          background: var(--faq-q-bg, #e7f5e8);
          color: var(--faq-q-fg, #377745);
          font-size: 12px;
          font-weight: 900;
        }

        .rd-search-faq-modal-label.answer {
          background: #e7f0fb;
          color: #33689b;
        }

        .rd-search-empty {
          margin: 0;
          padding: 28px 12px;
          color: var(--muted, #6b7280);
          font-size: 12px;
          text-align: center;
        }

        :global(.rd-search-highlight) {
          padding: 0;
          border-radius: 2px;
          background: #fff0a8;
          color: inherit;
          font-weight: 900;
        }

        .rd-search-faq-backdrop {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: grid;
          place-items: center;
          padding: 16px;
          background: var(--overlay, rgba(15, 23, 42, 0.55));
        }

        .rd-search-faq-modal {
          width: min(760px, 100%);
          max-height: min(82vh, 720px);
          overflow-y: auto;
          padding: 18px;
          border: 1px solid var(--border, #d8e1da);
          border-radius: 16px;
          background: var(--surface-elevated, #ffffff);
          box-shadow: var(
            --shadow-xl,
            0 24px 60px rgba(15, 23, 42, 0.25)
          );
          color: var(--foreground, #1f2937);
        }

        .rd-search-faq-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .rd-search-faq-modal-header > div {
          display: flex;
          min-width: 0;
          align-items: flex-start;
          gap: 10px;
        }

        .rd-search-faq-modal-header h2 {
          margin: 3px 0 0;
          font-size: 20px;
          line-height: 1.4;
        }

        .rd-search-faq-modal-header button {
          display: grid;
          place-items: center;
          flex: 0 0 36px;
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: var(--danger-fg, #c24141);
          font-size: 25px;
          cursor: pointer;
        }

        .rd-search-faq-answer {
          display: flex;
          align-items: flex-start;
          margin-top: 20px;
          gap: 10px;
        }

        .rd-search-faq-answer p {
          flex: 1;
          margin: 4px 0 0;
          color: var(--foreground, #1f2937);
          font-size: 14px;
          line-height: 1.75;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .rd-search-faq-modal-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 18px;
          padding-left: 40px;
        }

        .rd-search-faq-modal-tags span {
          padding: 4px 8px;
          border-radius: 999px;
          background: var(--surface-soft, #eef6ef);
          color: var(--muted, #5f6f63);
          font-size: 11px;
        }

        @media (max-width: 768px) {
          .rd-search-root {
            padding-left: 0 !important;
          }

          .rd-search-dropdown {
            left: 0;
            grid-template-columns: 1fr;
            width: 100%;
            max-height: min(68vh, 500px);
            padding: 8px;
            gap: 8px;
          }

          .rd-search-column {
            max-height: 31vh;
          }

          .rd-search-document-column {
            padding-right: 0;
            padding-bottom: 8px;
            border-right: 0;
            border-bottom: 1px solid var(--border-soft, #edf1ee);
          }

          .rd-search-faq-column {
            padding-top: 0;
            padding-left: 0;
          }
        }
      `}</style>
    </>
  );
}
