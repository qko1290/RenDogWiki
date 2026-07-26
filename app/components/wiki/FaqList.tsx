// =============================================
// File: app/components/wiki/FaqList.tsx
// 전체 코드
//
// - FAQ 목록 / 상세 보기 / 검색 / 페이징
// - writer, manager, admin 권한에 편집 버튼 표시
// - admin 권한에 삭제 버튼 표시
// - 질문 편집은 FaqUpsertModal 재사용
// =============================================

'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import FaqUpsertModal from '@/components/wiki/FaqUpsertModal';
import {
  recordFaqView,
} from '@/wiki/lib/faqView';

type User = {
  id: number;
  username: string;
  minecraft_name: string;
  email: string;
} | null;

export type FaqItem = {
  id: number;
  title: string;
  content: string;
  tags: string[];
  uploader: string;
  created_at?: string;
  updated_at?: string;
};

type AuthFlags = {
  canWrite: boolean;
  isAdmin: boolean;
  loading: boolean;
};

const EMPTY_FLAGS: AuthFlags = {
  canWrite: false,
  isAdmin: false,
  loading: true,
};

function normalizeRoleList(
  value: unknown,
) {
  if (!Array.isArray(value)) return [];

  return value.map((item) =>
    String(item).toLowerCase(),
  );
}

function useAuthFlags(
  user: User,
) {
  const [
    flags,
    setFlags,
  ] = useState<AuthFlags>(
    EMPTY_FLAGS,
  );

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setFlags({
        canWrite: false,
        isAdmin: false,
        loading: false,
      });
      return;
    }

    void (async () => {
      try {
        const response = await fetch(
          '/api/auth/me',
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );

        if (!response.ok) {
          throw new Error(
            `auth-fetch-failed:${response.status}`,
          );
        }

        const data = await response.json();

        const role = String(
          data?.role ??
          data?.user?.role ??
          '',
        ).toLowerCase();

        const roles = normalizeRoleList(
          data?.roles ??
          data?.permissions ??
          data?.user?.roles ??
          data?.user?.permissions,
        );

        const isAdmin =
          role === 'admin' ||
          roles.includes('admin');

        const canWrite =
          isAdmin ||
          role === 'writer' ||
          role === 'manager' ||
          roles.includes('writer') ||
          roles.includes('manager');

        if (!cancelled) {
          setFlags({
            canWrite,
            isAdmin,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setFlags({
            canWrite: false,
            isAdmin: false,
            loading: false,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return flags;
}

function normalizeFaqItem(
  value: unknown,
): FaqItem | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const id = Number(row.id);

  if (!Number.isFinite(id)) {
    return null;
  }

  const rawTags = row.tags;

  const tags = Array.isArray(rawTags)
    ? rawTags
        .map((tag) => String(tag).trim())
        .filter(Boolean)
    : String(rawTags ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

  return {
    id,
    title: String(row.title ?? ''),
    content: String(row.content ?? ''),
    tags,
    uploader: String(
      row.uploader ??
      row.username ??
      '',
    ),
    created_at:
      row.created_at == null
        ? undefined
        : String(row.created_at),
    updated_at:
      row.updated_at == null
        ? undefined
        : String(row.updated_at),
  };
}

export async function fetchFaqDetail(
  id: number,
): Promise<FaqItem | null> {
  try {
    const response = await fetch(
      `/api/faq/${id}`,
      {
        cache: 'no-store',
        credentials: 'include',
      },
    );

    if (!response.ok) return null;

    return normalizeFaqItem(
      await response.json(),
    );
  } catch (error) {
    console.error(
      '[FAQ detail] failed',
      error,
    );
    return null;
  }
}

function formatFaqDate(
  value?: string,
) {
  if (!value) return '';

  const date = new Date(value);
  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'ko-KR',
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    },
  ).format(date);
}

export function FaqDetailModal({
  sel,
  onClose,
}: {
  sel: FaqItem;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === 'Escape'
      ) {
        onClose();
      }
    };

    window.addEventListener(
      'keydown',
      onKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        onKeyDown,
      );
    };
  }, [onClose]);

  return (
    <div
      className="faq-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <article
        className="faq-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`faq-detail-title-${sel.id}`}
      >
        <header className="faq-detail-header">
          <div className="faq-detail-title-group">
            <span
              className="faq-detail-q"
              aria-hidden="true"
            >
              Q
            </span>

            <div>
              <span className="faq-detail-eyebrow">
                자주 묻는 질문
              </span>
              <h3
                id={`faq-detail-title-${sel.id}`}
              >
                {sel.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            className="faq-modal-close"
            onClick={onClose}
            aria-label="질문 상세 닫기"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="m6 6 12 12M18 6 6 18"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="faq-detail-body">
          <div
            className="faq-detail-a"
            aria-hidden="true"
          >
            A
          </div>

          <p>{sel.content}</p>
        </div>

        {(sel.tags.length > 0 ||
          sel.uploader ||
          sel.updated_at ||
          sel.created_at) && (
          <footer className="faq-detail-footer">
            {sel.tags.length > 0 && (
              <div className="faq-detail-tags">
                {sel.tags.map((tag) => (
                  <span key={tag}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="faq-detail-meta">
              {sel.uploader && (
                <span>
                  작성자 {sel.uploader}
                </span>
              )}

              {(sel.updated_at ||
                sel.created_at) && (
                <span>
                  {formatFaqDate(
                    sel.updated_at ??
                    sel.created_at,
                  )}
                </span>
              )}
            </div>
          </footer>
        )}
      </article>
    </div>
  );
}

type Props = {
  query?: string;
  tags?: string[];
  user: User;
  refreshSignal?: number;
};

export default function FaqList({
  query = '',
  tags = [],
  user,
  refreshSignal = 0,
}: Props) {
  const {
    canWrite,
    isAdmin,
    loading: authLoading,
  } = useAuthFlags(user);

  const [
    items,
    setItems,
  ] = useState<FaqItem[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const [
    selected,
    setSelected,
  ] = useState<FaqItem | null>(
    null,
  );

  const [
    editTarget,
    setEditTarget,
  ] = useState<FaqItem | null>(
    null,
  );

  const [
    listSearch,
    setListSearch,
  ] = useState('');

  const [
    page,
    setPage,
  ] = useState(0);

  const [
    isMobile,
    setIsMobile,
  ] = useState(false);

  const pageSize =
    isMobile
      ? 10
      : 12;

  useEffect(() => {
    const media =
      window.matchMedia(
        '(max-width: 768px)',
      );

    const apply = () => {
      setIsMobile(
        media.matches,
      );
    };

    apply();

    if (
      typeof media.addEventListener ===
      'function'
    ) {
      media.addEventListener(
        'change',
        apply,
      );

      return () => {
        media.removeEventListener(
          'change',
          apply,
        );
      };
    }

    media.addListener(apply);

    return () => {
      media.removeListener(apply);
    };
  }, []);

  const requestQuery = useMemo(
    () => {
      const params =
        new URLSearchParams();

      if (query.trim()) {
        params.set(
          'q',
          query.trim(),
        );
      }

      if (tags.length > 0) {
        params.set(
          'tags',
          tags.join(','),
        );
      }

      return params.toString();
    },
    [query, tags],
  );

  const refresh = async () => {
    setLoading(true);
    setError('');

    try {
      const collected: FaqItem[] = [];
      const limit = 100;
      let offset = 0;

      for (
        let round = 0;
        round < 200;
        round += 1
      ) {
        const params =
          new URLSearchParams(
            requestQuery,
          );

        params.set(
          'limit',
          String(limit),
        );
        params.set(
          'offset',
          String(offset),
        );

        const response = await fetch(
          `/api/faq?${params.toString()}`,
          {
            cache: 'no-store',
            credentials: 'include',
          },
        );

        if (!response.ok) {
          throw new Error(
            `faq-list-failed:${response.status}`,
          );
        }

        const data =
          await response.json();

        const rows = Array.isArray(
          data?.items,
        )
          ? data.items
          : Array.isArray(data)
            ? data
            : [];

        const chunk = rows
          .map(normalizeFaqItem)
          .filter(
            (
              item,
            ): item is FaqItem =>
              item !== null,
          );

        collected.push(
          ...chunk,
        );

        if (
          rows.length <
          limit
        ) {
          break;
        }

        offset += limit;
      }

      setItems(collected);
    } catch (requestError) {
      console.error(
        '[FAQ list] failed',
        requestError,
      );

      setItems([]);
      setError(
        '질문 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestQuery]);

  useEffect(() => {
    if (
      refreshSignal === 0
    ) {
      return;
    }

    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const normalizedSearch =
    listSearch
      .trim()
      .toLowerCase();

  const filteredItems =
    useMemo(
      () => {
        if (!normalizedSearch) {
          return items;
        }

        return items.filter(
          (item) => {
            const searchable = [
              item.title,
              item.content,
              item.uploader,
              item.tags.join(' '),
            ]
              .join(' ')
              .toLowerCase();

            return searchable.includes(
              normalizedSearch,
            );
          },
        );
      },
      [
        items,
        normalizedSearch,
      ],
    );

  const pageCount = Math.max(
    1,
    Math.ceil(
      filteredItems.length /
      pageSize,
    ),
  );

  useEffect(() => {
    setPage((current) =>
      Math.min(
        current,
        pageCount - 1,
      ),
    );
  }, [pageCount]);

  useEffect(() => {
    setPage(0);
  }, [
    normalizedSearch,
    isMobile,
  ]);

  const visibleItems =
    useMemo(
      () =>
        filteredItems.slice(
          page * pageSize,
          (page + 1) *
          pageSize,
        ),
      [
        filteredItems,
        page,
        pageSize,
      ],
    );

  const visiblePageNumbers =
    useMemo(
      () => {
        if (
          !isMobile ||
          pageCount <= 5
        ) {
          return Array.from(
            {
              length: pageCount,
            },
            (_, index) =>
              index,
          );
        }

        const start =
          Math.max(
            0,
            Math.min(
              page - 2,
              pageCount - 5,
            ),
          );

        return Array.from(
          {
            length: 5,
          },
          (_, index) =>
            start + index,
        );
      },
      [
        isMobile,
        page,
        pageCount,
      ],
    );

  const openDetail = async (
    item: FaqItem,
  ) => {
    const fresh =
      await fetchFaqDetail(
        item.id,
      );

    setSelected(
      fresh ??
      item,
    );

    void recordFaqView(
      item.id,
      'list',
    );
  };

  const openEdit = async (
    item: FaqItem,
  ) => {
    const fresh =
      await fetchFaqDetail(
        item.id,
      );

    setEditTarget(
      fresh ??
      item,
    );
  };

  const deleteItem = async (
    item: FaqItem,
  ) => {
    if (
      !window.confirm(
        `"${item.title}" 질문을 삭제할까요?`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/faq/${item.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          data?.error ??
          '질문 삭제에 실패했습니다.',
        );
      }

      if (
        selected?.id ===
        item.id
      ) {
        setSelected(null);
      }

      await refresh();
    } catch (deleteError) {
      window.alert(
        deleteError instanceof Error
          ? deleteError.message
          : '질문 삭제에 실패했습니다.',
      );
    }
  };

  return (
    <section className="faq-manager">
      <div className="faq-manager-toolbar">
        <div className="faq-manager-summary">
          <span className="faq-manager-summary-icon">
            Q
          </span>

          <div>
            <strong>
              자주 묻는 질문
            </strong>
            <span>
              총 {filteredItems.length}개
            </span>
          </div>
        </div>

        <label className="faq-list-search">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle
              cx="11"
              cy="11"
              r="7"
            />
            <path
              d="m20 20-3.4-3.4"
              strokeLinecap="round"
            />
          </svg>

          <input
            value={listSearch}
            onChange={(event) =>
              setListSearch(
                event.target.value,
              )
            }
            placeholder="목록 내 검색"
            aria-label="FAQ 목록 내 검색"
          />

          {listSearch && (
            <button
              type="button"
              onClick={() =>
                setListSearch('')
              }
              aria-label="검색어 지우기"
            >
              ×
            </button>
          )}
        </label>
      </div>

      <div className="faq-list">
        {loading ? (
          <div className="faq-list-state">
            <span className="faq-list-spinner" />
            질문 목록을 불러오는 중입니다.
          </div>
        ) : error ? (
          <div className="faq-list-state is-error">
            <strong>{error}</strong>
            <button
              type="button"
              onClick={() =>
                void refresh()
              }
            >
              다시 불러오기
            </button>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="faq-list-state">
            {normalizedSearch
              ? '검색 결과가 없습니다.'
              : '등록된 질문이 없습니다.'}
          </div>
        ) : (
          visibleItems.map(
            (item) => (
              <article
                key={item.id}
                className="faq-list-item"
              >
                <button
                  type="button"
                  className="faq-list-main"
                  onClick={() =>
                    void openDetail(
                      item,
                    )
                  }
                  title={item.title}
                >
                  <span
                    className="faq-list-q"
                    aria-hidden="true"
                  >
                    Q
                  </span>

                  <span className="faq-list-copy">
                    <strong>
                      {item.title}
                    </strong>

                    <span>
                      {item.content}
                    </span>
                  </span>

                  {item.tags.length > 0 && (
                    <span className="faq-list-tags">
                      {item.tags
                        .slice(0, 2)
                        .map((tag) => (
                          <span
                            key={tag}
                          >
                            #{tag}
                          </span>
                        ))}
                    </span>
                  )}
                </button>

                {!authLoading &&
                  canWrite && (
                  <div className="faq-list-actions">
                    <button
                      type="button"
                      className="faq-item-edit"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openEdit(
                          item,
                        );
                      }}
                      aria-label={`${item.title} 편집`}
                      title="질문 편집"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          d="M12 20h9"
                          strokeLinecap="round"
                        />
                        <path
                          d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>편집</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        className="faq-item-delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          void deleteItem(
                            item,
                          );
                        }}
                        aria-label={`${item.title} 삭제`}
                        title="질문 삭제"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            d="M3 6h18"
                            strokeLinecap="round"
                          />
                          <path
                            d="M8 6V4h8v2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="m19 6-1 14H6L5 6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </article>
            ),
          )
        )}
      </div>

      {pageCount > 1 && (
        <nav
          className="faq-pagination"
          aria-label="FAQ 페이지"
        >
          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.max(
                  0,
                  current - 1,
                ),
              )
            }
            disabled={page === 0}
            aria-label="이전 페이지"
          >
            ‹
          </button>

          {visiblePageNumbers.map(
            (pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={
                  pageNumber === page
                    ? 'is-active'
                    : ''
                }
                onClick={() =>
                  setPage(
                    pageNumber,
                  )
                }
                aria-current={
                  pageNumber === page
                    ? 'page'
                    : undefined
                }
              >
                {pageNumber + 1}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.min(
                  pageCount - 1,
                  current + 1,
                ),
              )
            }
            disabled={
              page ===
              pageCount - 1
            }
            aria-label="다음 페이지"
          >
            ›
          </button>
        </nav>
      )}

      {selected && (
        <FaqDetailModal
          sel={selected}
          onClose={() =>
            setSelected(null)
          }
        />
      )}

      {editTarget && (
        <FaqUpsertModal
          open
          mode="edit"
          initial={editTarget}
          onClose={() =>
            setEditTarget(null)
          }
          onSaved={async () => {
            const editedId =
              editTarget.id;

            setEditTarget(null);
            await refresh();

            if (
              selected?.id ===
              editedId
            ) {
              const fresh =
                await fetchFaqDetail(
                  editedId,
                );

              if (fresh) {
                setSelected(
                  fresh,
                );
              }
            }
          }}
        />
      )}
    </section>
  );
}
