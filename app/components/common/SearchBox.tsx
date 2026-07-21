// =============================================
// File: app/components/common/SearchBox.tsx
// 전체 교체용 코드
// - main 브랜치 SearchBox의 디자인/크기/2열 구성 그대로 사용
// - main 브랜치와 동일한 문서·퀘스트 NPC·FAQ 검색 방식 유지
// - 결과 상세 모달을 닫아도 검색어와 결과창 유지
// - 모달이 없을 때만 바깥 클릭으로 결과창 닫기
// =============================================

'use client';

import {
  useEffect,
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
  /** 헤더 안 정렬: center | left */
  align?: 'center' | 'left';

  /** 박스 너비 */
  width?: string;

  /** 기존 호출부 호환용 */
  paddingLeft?: number;

  /** 퀘스트 NPC 결과 클릭 시 상위에서 모달 열기 */
  onQuestNpcClick?: (id: number) => void;

  /**
   * SearchBox 밖에서 열린 NPC 상세 모달의 상태.
   * true인 동안 모달 배경 클릭을 검색창 외부 클릭으로 처리하지 않는다.
   */
  resultModalOpen?: boolean;
};

function normalizeSearchText(value: string) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function isSectionHeadingHighlighted(
  heading: string,
  keyword: string
) {
  const normalizedHeading = normalizeSearchText(heading);
  const normalizedKeyword = normalizeSearchText(keyword);

  if (!normalizedHeading || !normalizedKeyword) {
    return false;
  }

  return normalizedHeading.includes(normalizedKeyword);
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
  const compactIndex = compact.indexOf(normalizedKeyword);

  if (compactIndex < 0) {
    return null;
  }

  const start = indexMap[compactIndex];
  const compactEnd =
    compactIndex + normalizedKeyword.length - 1;
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
      <mark>{text.slice(range.start, range.end)}</mark>
      {range.end < text.length && text.slice(range.end)}
    </>
  );
}

const isImageLike = (value?: string | null) =>
  Boolean(
    value &&
      (/^https?:\/\//i.test(value) ||
        value.startsWith('data:image'))
  );

const isRemoteHttp = (value?: string | null) =>
  Boolean(value && /^https?:\/\//i.test(value));

function normalizeTag(raw: string) {
  return String(raw ?? '')
    .replace(/^#+\s*/, '')
    .trim();
}

function escapeRegexCharacter(character: string) {
  return character.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
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

  if (
    compactQuery &&
    compactTag.includes(compactQuery)
  ) {
    return true;
  }

  if (compactQuery.length >= 2) {
    const looseRegex = makeLooseRegex(query);

    if (
      looseRegex &&
      looseRegex.test(compactTag)
    ) {
      return true;
    }
  }

  return false;
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
  void paddingLeft;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const [docs, setDocs] = useState<DocResult[]>([]);
  const [loadingDocs, setLoadingDocs] =
    useState(false);

  const [questNpcs, setQuestNpcs] =
    useState<QuestNpcResult[]>([]);
  const [loadingQuestNpcs, setLoadingQuestNpcs] =
    useState(false);

  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loadingFaqs, setLoadingFaqs] =
    useState(false);

  const [activeDocIndex, setActiveDocIndex] =
    useState(-1);
  const [faqView, setFaqView] =
    useState<FaqItem | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(
    null
  );
  const wrapRef = useRef<HTMLDivElement | null>(
    null
  );

  const abortDocsRef =
    useRef<AbortController | null>(null);
  const abortQuestNpcRef =
    useRef<AbortController | null>(null);
  const abortFaqRef =
    useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const faqTimerRef =
    useRef<number | null>(null);

  const router = useRouter();

  const listId = useMemo(
    () =>
      `search-list-${Math.random()
        .toString(36)
        .slice(2)}`,
    []
  );

  const sortedDocs = useMemo(() => {
    return docs
      .map((document, index) => ({
        document,
        index,
      }))
      .sort((first, second) => {
        const firstPriority =
          getDocumentPriority(first.document);
        const secondPriority =
          getDocumentPriority(second.document);

        if (
          firstPriority !== secondPriority
        ) {
          return (
            firstPriority - secondPriority
          );
        }

        return first.index - second.index;
      })
      .map(({ document }) => document);
  }, [docs]);

  const combinedDocItems =
    useMemo<SearchResultItem[]>(() => {
      const documentItems =
        sortedDocs.map((document) => ({
          kind: 'doc' as const,
          id: document.id,
          data: document,
        }));

      const questItems = questNpcs.map(
        (npc) => ({
          kind: 'quest' as const,
          id: npc.id,
          data: npc,
        })
      );

      return [
        ...documentItems,
        ...questItems,
      ];
    }, [questNpcs, sortedDocs]);

  const combinedCount =
    combinedDocItems.length;

  useEffect(() => {
    const trimmedQuery = query.trim();
    const compactQuery =
      normalizeSearchText(trimmedQuery);

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (faqTimerRef.current !== null) {
      window.clearTimeout(
        faqTimerRef.current
      );
      faqTimerRef.current = null;
    }

    abortDocsRef.current?.abort();
    abortQuestNpcRef.current?.abort();
    abortFaqRef.current?.abort();

    if (compactQuery.length < 2) {
      setOpen(false);
      setDocs([]);
      setQuestNpcs([]);
      setFaqs([]);
      setActiveDocIndex(-1);
      setLoadingDocs(false);
      setLoadingQuestNpcs(false);
      setLoadingFaqs(false);
      return;
    }

    timerRef.current = window.setTimeout(
      () => {
        const docsController =
          new AbortController();
        const questController =
          new AbortController();
        const faqController =
          new AbortController();

        abortDocsRef.current =
          docsController;
        abortQuestNpcRef.current =
          questController;
        abortFaqRef.current =
          faqController;

        setLoadingDocs(true);
        setLoadingQuestNpcs(true);
        setLoadingFaqs(true);
        setOpen(true);

        void (async () => {
          try {
            const response = await fetch(
              `/api/search?query=${encodeURIComponent(
                trimmedQuery
              )}&compact=${encodeURIComponent(
                compactQuery
              )}&limit=50`,
              {
                signal:
                  docsController.signal,
                cache: 'no-store',
              }
            );

            if (!response.ok) {
              throw new Error(
                'search-failed'
              );
            }

            const data =
              (await response.json()) as DocResult[];

            setDocs(
              Array.isArray(data)
                ? data
                : []
            );

            setActiveDocIndex(
              Array.isArray(data) &&
                data.length > 0
                ? 0
                : -1
            );
          } catch (error) {
            if (
              !(
                error instanceof DOMException &&
                error.name === 'AbortError'
              )
            ) {
              setDocs([]);
              setActiveDocIndex(-1);
            }
          } finally {
            if (
              !docsController.signal.aborted
            ) {
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
                signal:
                  questController.signal,
                cache: 'no-store',
              }
            );

            if (!response.ok) {
              throw new Error(
                'quest-search-failed'
              );
            }

            const data =
              (await response.json()) as QuestNpcResult[];

            setQuestNpcs(
              Array.isArray(data)
                ? data
                : []
            );
          } catch (error) {
            if (
              !(
                error instanceof DOMException &&
                error.name === 'AbortError'
              )
            ) {
              setQuestNpcs([]);
            }
          } finally {
            if (
              !questController.signal.aborted
            ) {
              setLoadingQuestNpcs(false);
            }
          }
        })();

        faqTimerRef.current =
          window.setTimeout(() => {
            void (async () => {
              try {
                const url =
                  `/api/faq?q=${encodeURIComponent(
                    trimmedQuery
                  )}` +
                  `&compact=${encodeURIComponent(
                    compactQuery
                  )}` +
                  '&limit=10&offset=0';

                const response =
                  await fetch(url, {
                    signal:
                      faqController.signal,
                    cache: 'no-store',
                  });

                const data =
                  response.ok
                    ? ((await response.json()) as {
                        items?: FaqItem[];
                      })
                    : { items: [] };

                setFaqs(
                  Array.isArray(
                    data.items
                  )
                    ? data.items
                    : []
                );
              } catch (error) {
                if (
                  !(
                    error instanceof
                      DOMException &&
                    error.name ===
                      'AbortError'
                  )
                ) {
                  setFaqs([]);
                }
              } finally {
                if (
                  !faqController.signal
                    .aborted
                ) {
                  setLoadingFaqs(false);
                }
              }
            })();
          }, 180);
      },
      200
    );

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(
          timerRef.current
        );
      }

      if (
        faqTimerRef.current !== null
      ) {
        window.clearTimeout(
          faqTimerRef.current
        );
      }
    };
  }, [query]);

  useEffect(() => {
    return () => {
      abortDocsRef.current?.abort();
      abortQuestNpcRef.current?.abort();
      abortFaqRef.current?.abort();

      if (timerRef.current !== null) {
        window.clearTimeout(
          timerRef.current
        );
      }

      if (
        faqTimerRef.current !== null
      ) {
        window.clearTimeout(
          faqTimerRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    const onDocumentMouseDown = (
      event: MouseEvent
    ) => {
      const root = wrapRef.current;

      if (!root) {
        return;
      }

      /*
       * 결과 상세 모달이 열린 동안에는
       * 모달 배경/닫기 클릭을 검색창 외부 클릭으로
       * 처리하지 않는다.
       */
      if (faqView || resultModalOpen) {
        return;
      }

      if (
        !root.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
        setActiveDocIndex(-1);
      }
    };

    document.addEventListener(
      'mousedown',
      onDocumentMouseDown
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        onDocumentMouseDown
      );
    };
  }, [faqView, resultModalOpen]);

  const renderDocumentTitle = (
    result: DocResult
  ) => {
    if (
      result.match_type === 'title'
    ) {
      return <mark>{result.title}</mark>;
    }

    return highlight(
      result.title,
      query
    );
  };

  const renderSectionMeta = (
    result: DocResult
  ) => {
    const sectionHeading = String(
      result.section_heading ?? ''
    ).trim();
    const breadcrumb = String(
      result.category_breadcrumb ?? ''
    ).trim();

    if (
      result.match_type === 'content' &&
      sectionHeading
    ) {
      const highlighted =
        isSectionHeadingHighlighted(
          sectionHeading,
          query
        );

      return (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: highlighted
              ? 'var(--accent)'
              : 'var(--muted-2)',
            fontWeight: highlighted
              ? 700
              : 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={sectionHeading}
        >
          {highlight(
            sectionHeading,
            query
          )}
        </div>
      );
    }

    if (!breadcrumb) {
      return null;
    }

    return (
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: 'var(--muted-2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={breadcrumb}
      >
        {highlight(breadcrumb, query)}
      </div>
    );
  };

  const resetSearchState = () => {
    setOpen(false);
    setQuery('');
    setDocs([]);
    setQuestNpcs([]);
    setFaqs([]);
    setActiveDocIndex(-1);
  };

  const goDocument = (
    result: DocResult | null
  ) => {
    if (!result) {
      return;
    }

    const nextHashDomId = String(
      result.section_dom_id ?? ''
    ).trim();

    resetSearchState();

    const href =
      `/wiki?id=${encodeURIComponent(
        result.id
      )}` +
      `&path=${encodeURIComponent(
        result.path
      )}` +
      `&title=${encodeURIComponent(
        result.title
      )}` +
      (nextHashDomId
        ? `#${encodeURIComponent(
            nextHashDomId
          )}`
        : '');

    markNextDocViewSource('search');

    router.push(href, {
      scroll: false,
    });

    if (
      nextHashDomId &&
      typeof window !== 'undefined'
    ) {
      window.requestAnimationFrame(
        () => {
          window.dispatchEvent(
            new CustomEvent(
              'rdwiki:search-hash-nav',
              {
                detail: {
                  domId: nextHashDomId,
                },
              }
            )
          );
        }
      );
    }
  };

  const openQuestNpc = (
    npc: QuestNpcResult | null
  ) => {
    if (!npc) {
      return;
    }

    /*
     * 상세 모달을 닫았을 때 같은 결과를 다시 볼 수 있도록
     * query/open/results를 초기화하지 않는다.
     */
    setOpen(true);
    onQuestNpcClick?.(npc.id);
  };

  const onKeyDown: KeyboardEventHandler<HTMLInputElement> = (
    event
  ) => {
    if (
      !open ||
      (!combinedCount &&
        event.key !== 'Escape')
    ) {
      if (event.key === 'Escape') {
        setOpen(false);
        setActiveDocIndex(-1);
      }

      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();

      setActiveDocIndex((index) =>
        combinedCount
          ? (index + 1) %
            combinedCount
          : -1
      );
    } else if (
      event.key === 'ArrowUp'
    ) {
      event.preventDefault();

      setActiveDocIndex((index) =>
        combinedCount
          ? (index -
              1 +
              combinedCount) %
            combinedCount
          : -1
      );
    } else if (
      event.key === 'Enter'
    ) {
      event.preventDefault();

      const selected =
        combinedDocItems[
          activeDocIndex
        ] ??
        combinedDocItems[0] ??
        null;

      if (!selected) {
        return;
      }

      if (selected.kind === 'doc') {
        goDocument(selected.data);
      } else {
        openQuestNpc(selected.data);
      }
    } else if (
      event.key === 'Escape'
    ) {
      event.preventDefault();
      setOpen(false);
      setActiveDocIndex(-1);
    }
  };

  const dropdownMaxHeight =
    'min(72vh, 560px)';

  return (
    <>
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
        <svg
          className="search-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z" />
        </svg>

        <input
          type="search"
          ref={inputRef}
          className="search-input"
          placeholder="Search"
          value={query}
          onInput={(event) =>
            setQuery(
              (
                event.target as HTMLInputElement
              ).value
            )
          }
          onChange={(event) =>
            setQuery(event.target.value)
          }
          onFocus={() => {
            if (
              docs.length ||
              questNpcs.length ||
              faqs.length
            ) {
              setOpen(true);
            }
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={
            activeDocIndex >= 0 &&
            combinedDocItems[
              activeDocIndex
            ]
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
              background:
                'var(--surface-elevated)',
              border:
                '1px solid var(--border)',
              borderRadius: 10,
              boxShadow:
                'var(--shadow-lg)',
              padding: '10px 12px',
              maxHeight:
                dropdownMaxHeight,
              overflow: 'auto',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr',
                gap: 12,
                alignItems: 'start',
                minHeight: 120,
              }}
            >
              <div
                style={{
                  borderRight:
                    '1px solid var(--border-soft)',
                  paddingRight: 8,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 13,
                    color: 'var(--muted)',
                    marginBottom: 6,
                  }}
                >
                  문서
                </div>

                {!loadingDocs &&
                  !loadingQuestNpcs &&
                  combinedDocItems.length ===
                    0 && (
                    <div
                      style={{
                        color:
                          'var(--muted-2)',
                        fontSize: 14,
                        padding: '6px 4px',
                      }}
                    >
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
                  {combinedDocItems.map(
                    (item, index) => {
                      const selected =
                        index ===
                        activeDocIndex;

                      if (
                        item.kind === 'doc'
                      ) {
                        const result =
                          item.data;
                        const cleanTags = (
                          result.tags ?? []
                        )
                          .map(normalizeTag)
                          .filter(Boolean)
                          .filter((tag) =>
                            isTagMatched(
                              tag,
                              query
                            )
                          );

                        return (
                          <li
                            id={`${listId}-opt-doc-${result.id}`}
                            role="option"
                            aria-selected={
                              selected
                            }
                            key={`doc-${result.id}`}
                            style={{
                              display:
                                'flex',
                              alignItems:
                                'flex-start',
                              padding:
                                '11px 12px',
                              cursor:
                                'pointer',
                              borderBottom:
                                index !==
                                combinedDocItems.length -
                                  1
                                  ? '1px solid var(--border-soft)'
                                  : undefined,
                              background:
                                selected
                                  ? 'var(--accent-soft)'
                                  : 'transparent',
                              color:
                                'var(--foreground)',
                              fontSize: 15,
                              lineHeight: 1.3,
                              gap: 10,
                              borderRadius: 8,
                            }}
                            onMouseEnter={() =>
                              setActiveDocIndex(
                                index
                              )
                            }
                            onClick={() =>
                              goDocument(
                                result
                              )
                            }
                          >
                            <span
                              style={{
                                marginRight: 8,
                                fontSize: 20,
                              }}
                            >
                              {result.icon ? (
                                isImageLike(
                                  result.icon
                                ) ? (
                                  <img
                                    src={
                                      isRemoteHttp(
                                        result.icon
                                      )
                                        ? toProxyUrl(
                                            result.icon
                                          )
                                        : result.icon
                                    }
                                    alt=""
                                    width={22}
                                    height={22}
                                    style={{
                                      width: 22,
                                      height: 22,
                                      objectFit:
                                        'cover',
                                    }}
                                    loading="lazy"
                                    decoding="async"
                                    draggable={
                                      false
                                    }
                                  />
                                ) : (
                                  result.icon
                                )
                              ) : (
                                ''
                              )}
                            </span>

                            <div
                              style={{
                                minWidth: 0,
                                flex: 1,
                                display: 'flex',
                                gap: 10,
                                alignItems:
                                  'flex-start',
                              }}
                            >
                              <div
                                style={{
                                  minWidth: 0,
                                  flex: 1,
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 16,
                                  }}
                                >
                                  {renderDocumentTitle(
                                    result
                                  )}
                                </div>

                                {renderSectionMeta(
                                  result
                                )}
                              </div>

                              {cleanTags.length >
                                0 && (
                                <div
                                  style={{
                                    flex: '0 0 auto',
                                    display: 'flex',
                                    flexWrap:
                                      'wrap',
                                    justifyContent:
                                      'flex-end',
                                    gap: 6,
                                    maxWidth: 180,
                                    marginTop: 2,
                                  }}
                                >
                                  {cleanTags.map(
                                    (
                                      tag,
                                      tagIndex
                                    ) => (
                                      <span
                                        key={`${tag}-${tagIndex}`}
                                        style={{
                                          fontSize: 12,
                                          color:
                                            'var(--tag-fg)',
                                          background:
                                            'var(--tag-bg)',
                                          border:
                                            '1px solid var(--tag-border)',
                                          borderRadius: 999,
                                          padding:
                                            '2px 8px',
                                          lineHeight: 1.4,
                                          maxWidth: 180,
                                          overflow:
                                            'hidden',
                                          textOverflow:
                                            'ellipsis',
                                          whiteSpace:
                                            'nowrap',
                                        }}
                                        title={tag}
                                      >
                                        {highlight(
                                          tag,
                                          query
                                        )}
                                      </span>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      }

                      const npc = item.data;
                      const villageName =
                        String(
                          npc.village_name ??
                            ''
                        ).trim();

                      return (
                        <li
                          id={`${listId}-opt-quest-${npc.id}`}
                          role="option"
                          aria-selected={
                            selected
                          }
                          key={`quest-${npc.id}`}
                          style={{
                            display: 'flex',
                            alignItems:
                              'flex-start',
                            padding:
                              '11px 12px',
                            cursor: 'pointer',
                            borderBottom:
                              index !==
                              combinedDocItems.length -
                                1
                                ? '1px solid var(--border-soft)'
                                : undefined,
                            background:
                              selected
                                ? 'var(--accent-soft)'
                                : 'transparent',
                            color:
                              'var(--foreground)',
                            fontSize: 15,
                            lineHeight: 1.3,
                            gap: 10,
                            borderRadius: 8,
                          }}
                          onMouseEnter={() =>
                            setActiveDocIndex(
                              index
                            )
                          }
                          onClick={() =>
                            openQuestNpc(npc)
                          }
                        >
                          <span
                            style={{
                              marginRight: 8,
                              fontSize: 20,
                            }}
                          >
                            {npc.icon ? (
                              isImageLike(
                                npc.icon
                              ) ? (
                                <img
                                  src={
                                    isRemoteHttp(
                                      npc.icon
                                    )
                                      ? toProxyUrl(
                                          npc.icon
                                        )
                                      : npc.icon
                                  }
                                  alt=""
                                  width={22}
                                  height={22}
                                  style={{
                                    width: 22,
                                    height: 22,
                                    objectFit:
                                      'cover',
                                  }}
                                  loading="lazy"
                                  decoding="async"
                                  draggable={false}
                                />
                              ) : (
                                npc.icon
                              )
                            ) : (
                              ''
                            )}
                          </span>

                          <div
                            style={{
                              minWidth: 0,
                              flex: 1,
                              display: 'flex',
                              gap: 10,
                              alignItems:
                                'flex-start',
                            }}
                          >
                            <div
                              style={{
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 16,
                                }}
                              >
                                {highlight(
                                  npc.name,
                                  query
                                )}
                              </div>

                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: 12,
                                  color:
                                    'var(--muted-2)',
                                  overflow:
                                    'hidden',
                                  textOverflow:
                                    'ellipsis',
                                  whiteSpace:
                                    'nowrap',
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
                                  flexWrap:
                                    'wrap',
                                  justifyContent:
                                    'flex-end',
                                  gap: 6,
                                  maxWidth: 180,
                                  marginTop: 2,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 12,
                                    color:
                                      'var(--tag-fg)',
                                    background:
                                      'var(--tag-bg)',
                                    border:
                                      '1px solid var(--tag-border)',
                                    borderRadius: 999,
                                    padding:
                                      '2px 8px',
                                    lineHeight: 1.4,
                                    maxWidth: 180,
                                    overflow:
                                      'hidden',
                                    textOverflow:
                                      'ellipsis',
                                    whiteSpace:
                                      'nowrap',
                                  }}
                                  title={
                                    villageName
                                  }
                                >
                                  {highlight(
                                    villageName,
                                    query
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    }
                  )}
                </ul>
              </div>

              <div
                style={{
                  paddingLeft: 8,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 13,
                    color: 'var(--muted)',
                    marginBottom: 6,
                  }}
                >
                  자주 묻는 질문
                </div>

                {!loadingFaqs &&
                  faqs.length === 0 && (
                    <div
                      style={{
                        color:
                          'var(--muted-2)',
                        fontSize: 14,
                        padding: '6px 4px',
                      }}
                    >
                      결과가 없습니다.
                    </div>
                  )}

                <ul
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    maxHeight: 420,
                    overflowY: 'auto',
                  }}
                >
                  {faqs.map((faq) => (
                    <li
                      key={`faq-${faq.id}`}
                      style={{
                        padding:
                          '11px 12px',
                        borderBottom:
                          '1px solid var(--border-soft)',
                        cursor: 'pointer',
                        borderRadius: 8,
                      }}
                      onClick={() => {
                        setOpen(true);
                        setFaqView(faq);
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems:
                            'center',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            display:
                              'inline-flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            width: 20,
                            height: 20,
                            borderRadius: 999,
                            background:
                              'var(--faq-q-bg)',
                            color:
                              'var(--faq-q-fg)',
                            fontWeight: 900,
                            fontSize: 12.5,
                            flex: '0 0 20px',
                          }}
                          aria-hidden
                        >
                          Q
                        </span>

                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                            minWidth: 0,
                            color:
                              'var(--foreground)',
                          }}
                        >
                          {highlight(
                            faq.title,
                            query
                          )}
                        </div>
                      </div>

                      {faq.tags?.length >
                        0 && (
                        <div
                          style={{
                            color:
                              'var(--tag-fg)',
                            fontSize: 12,
                            marginTop: 6,
                            display: 'flex',
                            flexWrap:
                              'wrap',
                            gap: 6,
                          }}
                        >
                          {faq.tags.map(
                            (
                              tag,
                              tagIndex
                            ) => (
                              <span
                                key={
                                  tag +
                                  tagIndex
                                }
                              >
                                {highlight(
                                  tag,
                                  query
                                )}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {faqView && (
        <div
          onClick={() =>
            setFaqView(null)
          }
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
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width:
                'min(760px, 100%)',
              background:
                'var(--surface-elevated)',
              border:
                '1px solid var(--border)',
              borderRadius: 16,
              padding: 16,
              boxShadow:
                'var(--shadow-xl)',
              color:
                'var(--foreground)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    display:
                      'inline-flex',
                    alignItems: 'center',
                    justifyContent:
                      'center',
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background:
                      'var(--faq-q-bg)',
                    color:
                      'var(--faq-q-fg)',
                    fontWeight: 900,
                    fontSize: 13.5,
                    flex: '0 0 22px',
                  }}
                >
                  Q
                </span>

                <h3
                  style={{
                    margin: 0,
                    color:
                      'var(--foreground)',
                  }}
                >
                  {faqView.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setFaqView(null)
                }
                aria-label="close"
                style={{
                  width: 34,
                  height: 34,
                  display: 'grid',
                  placeItems: 'center',
                  background:
                    'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color:
                    'var(--danger-fg)',
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                marginTop: 14,
                border:
                  '1px solid var(--faq-a-border)',
                background:
                  'var(--faq-a-bg)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                alignItems:
                  'flex-start',
                gap: 10,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent:
                    'center',
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background:
                    'var(--faq-a-badge-bg)',
                  color:
                    'var(--faq-a-badge-fg)',
                  fontWeight: 900,
                  fontSize: 13.5,
                  flex: '0 0 22px',
                }}
              >
                A
              </span>

              <div
                style={{
                  color:
                    'var(--foreground)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                }}
              >
                {faqView.content}
              </div>
            </div>

            {faqView.tags?.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  color:
                    'var(--tag-fg)',
                  fontSize: 12,
                }}
              >
                {faqView.tags.map(
                  (tag, index) => (
                    <span
                      key={`${tag}-${index}`}
                    >
                      #{tag}
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
