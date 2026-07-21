// =============================================
// File: app/components/home/homeData.ts
// 전체 교체용 코드
//
// Home 카테고리 버튼은 대표 문서를 직접 추측하지 않는다.
// 실제 카테고리 ID만 /wiki에 전달하고,
// WikiPageInner가 CategoryTree 클릭과 같은 방식으로
// category.document_id를 읽어 대표 문서를 연다.
// =============================================

import 'server-only';

import { cached } from '@/wiki/lib/cache';
import { runDbRead, sql } from '@/wiki/lib/db';

export type HomeRecentDocument = {
  id: number;
  title: string;
  category: string;
  href: string;
  updatedAt: string;
  updatedLabel: string;
};

export type HomeCategoryKey =
  | 'content'
  | 'system'
  | 'price'
  | 'policy';

export type HomeCategoryLink = {
  key: HomeCategoryKey;
  title: string;
  href: string;
  categoryId: number | null;
  documentId: number | null;
};

type RecentDocumentRow = {
  id: number | string;
  title: string;
  path: string | number | null;
  updated_at: string | Date | null;
  category_name: string | null;
};

type CategoryRow = {
  id: number | string;
  name: string;
  parent_id: number | string | null;
  mode_tags: string[] | null;
  order: number | string | null;
};

type NormalizedCategory = {
  id: number;
  name: string;
  parentId: number | null;
  modeTags: string[];
  order: number;
};

const HOME_MODE = 'RPG';

const HOME_CATEGORY_DEFINITIONS: ReadonlyArray<{
  key: HomeCategoryKey;
  title: string;
}> = [
  {
    key: 'content',
    title: '컨텐츠',
  },
  {
    key: 'system',
    title: '시스템',
  },
  {
    key: 'price',
    title: '시세표',
  },
  {
    key: 'policy',
    title: '법전',
  },
];

const homeDateFormatter =
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
  });

function toPositiveInteger(
  value: unknown
): number | null {
  const parsed = Number(value);

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

function toFiniteOrder(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : Number.MAX_SAFE_INTEGER;
}

function normalizeModeTag(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function normalizeDate(
  value: string | Date | null
) {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatDateLabel(date: Date) {
  const parts =
    homeDateFormatter.formatToParts(date);

  const month =
    parts.find(
      (part) => part.type === 'month'
    )?.value ?? '--';

  const day =
    parts.find(
      (part) => part.type === 'day'
    )?.value ?? '--';

  return `${month}.${day}`;
}

function createRecentDocumentHref(
  documentId: number,
  path: string | number | null,
  title: string
) {
  const searchParams =
    new URLSearchParams({
      id: String(documentId),
      path: String(path ?? 0),
      title,
      mode: HOME_MODE,
    });

  return `/wiki?${searchParams.toString()}`;
}

function createCategoryClickHref(
  categoryId: number
) {
  const searchParams =
    new URLSearchParams({
      category: String(categoryId),
      mode: HOME_MODE,
    });

  return `/wiki?${searchParams.toString()}`;
}

function createEmptyCategoryLinks(): HomeCategoryLink[] {
  return HOME_CATEGORY_DEFINITIONS.map(
    (definition) => ({
      key: definition.key,
      title: definition.title,
      href: `/wiki?mode=${encodeURIComponent(
        HOME_MODE
      )}`,
      categoryId: null,
      documentId: null,
    })
  );
}

function normalizeCategories(
  rows: CategoryRow[]
): NormalizedCategory[] {
  return rows
    .map(
      (
        row
      ): NormalizedCategory | null => {
        const id =
          toPositiveInteger(row.id);

        if (!id) {
          return null;
        }

        return {
          id,
          name: String(
            row.name ?? ''
          ).trim(),
          parentId:
            toPositiveInteger(
              row.parent_id
            ),
          modeTags:
            Array.isArray(
              row.mode_tags
            )
              ? row.mode_tags.map(
                  normalizeModeTag
                )
              : [],
          order:
            toFiniteOrder(
              row.order
            ),
        };
      }
    )
    .filter(
      (
        category
      ): category is NormalizedCategory =>
        category !== null
    );
}

/**
 * CategoryTree의 mode_tags 상속 규칙과 동일하게
 * 현재 카테고리 또는 조상 중 하나가 RPG 태그를 가지면
 * RPG 카테고리로 본다.
 */
function isCategoryInMode(
  category: NormalizedCategory,
  categoryById: Map<
    number,
    NormalizedCategory
  >,
  mode: string
) {
  const normalizedMode =
    normalizeModeTag(mode);

  let current:
    | NormalizedCategory
    | undefined = category;

  const visited = new Set<number>();

  while (
    current &&
    !visited.has(current.id)
  ) {
    visited.add(current.id);

    if (
      current.modeTags.includes(
        normalizedMode
      )
    ) {
      return true;
    }

    current = current.parentId
      ? categoryById.get(
          current.parentId
        )
      : undefined;
  }

  return false;
}

function getCategoryDepth(
  category: NormalizedCategory,
  categoryById: Map<
    number,
    NormalizedCategory
  >
) {
  let depth = 0;

  let current:
    | NormalizedCategory
    | undefined = category;

  const visited = new Set<number>();

  while (
    current?.parentId &&
    !visited.has(current.id)
  ) {
    visited.add(current.id);
    depth += 1;

    current = categoryById.get(
      current.parentId
    );
  }

  return depth;
}

export async function getRecentHomeDocuments(
  requestedLimit = 4
): Promise<HomeRecentDocument[]> {
  const limit = Math.min(
    Math.max(
      Math.trunc(requestedLimit),
      1
    ),
    10
  );

  try {
    return await cached(
      `home:recent-documents:${limit}`,
      {
        ttlSec: 60,
        tags: ['doc:list'],
      },
      async () => {
        const rows = (await runDbRead(
          'home:recent-documents',
          async () => {
            return await sql`
              SELECT
                d.id,
                d.title,
                d.path,
                d.updated_at,
                COALESCE(
                  c.name,
                  '문서'
                ) AS category_name
              FROM documents d
              LEFT JOIN categories c
                ON c.id::text =
                  d.path::text
              WHERE
                d.updated_at IS NOT NULL
              ORDER BY
                d.updated_at DESC,
                d.id DESC
              LIMIT ${limit}
            `;
          }
        )) as unknown as RecentDocumentRow[];

        return rows
          .map(
            (
              row
            ): HomeRecentDocument | null => {
              const id =
                toPositiveInteger(
                  row.id
                );

              const updatedDate =
                normalizeDate(
                  row.updated_at
                );

              if (
                !id ||
                !row.title ||
                !updatedDate
              ) {
                return null;
              }

              return {
                id,
                title: row.title,
                category:
                  row.category_name ||
                  '문서',
                href:
                  createRecentDocumentHref(
                    id,
                    row.path,
                    row.title
                  ),
                updatedAt:
                  updatedDate.toISOString(),
                updatedLabel:
                  formatDateLabel(
                    updatedDate
                  ),
              };
            }
          )
          .filter(
            (
              document
            ): document is HomeRecentDocument =>
              document !== null
          );
      }
    );
  } catch (error) {
    console.error(
      '[home] 최근 업데이트 문서 조회 실패:',
      error
    );

    return [];
  }
}

export async function getHomeCategoryLinks(): Promise<
  HomeCategoryLink[]
> {
  try {
    return await cached(
      'home:category-links:v7',
      {
        ttlSec: 60,
        tags: [
          'category:list',
          'category:tree',
        ],
      },
      async () => {
        /*
         * 대표 문서는 여기서 조회하지 않는다.
         * CategoryTree와 WikiPageInner가 실제로 사용하는
         * 동일한 카테고리 ID만 Home에 전달한다.
         */
        const rows = (await runDbRead(
          'home:category-links:v7',
          async () => {
            return await sql`
              SELECT
                id,
                name,
                parent_id,
                mode_tags,
                "order"
              FROM categories
              ORDER BY
                parent_id,
                "order",
                id
            `;
          }
        )) as unknown as CategoryRow[];

        const categories =
          normalizeCategories(rows);

        const categoryById =
          new Map(
            categories.map(
              (category) => [
                category.id,
                category,
              ]
            )
          );

        return HOME_CATEGORY_DEFINITIONS.map(
          (definition) => {
            const candidates =
              categories.filter(
                (category) =>
                  category.name ===
                  definition.title
              );

            candidates.sort(
              (first, second) => {
                const firstInMode =
                  isCategoryInMode(
                    first,
                    categoryById,
                    HOME_MODE
                  );

                const secondInMode =
                  isCategoryInMode(
                    second,
                    categoryById,
                    HOME_MODE
                  );

                if (
                  firstInMode !==
                  secondInMode
                ) {
                  return firstInMode
                    ? -1
                    : 1;
                }

                const depthDifference =
                  getCategoryDepth(
                    first,
                    categoryById
                  ) -
                  getCategoryDepth(
                    second,
                    categoryById
                  );

                if (
                  depthDifference !== 0
                ) {
                  return depthDifference;
                }

                if (
                  first.order !==
                  second.order
                ) {
                  return (
                    first.order -
                    second.order
                  );
                }

                return (
                  first.id -
                  second.id
                );
              }
            );

            const category =
              candidates[0] ?? null;

            if (!category) {
              console.error(
                `[home] 카테고리를 찾지 못했습니다: ${definition.title}`
              );

              return {
                key: definition.key,
                title: definition.title,
                href:
                  `/wiki?mode=${encodeURIComponent(
                    HOME_MODE
                  )}`,
                categoryId: null,
                documentId: null,
              };
            }

            return {
              key: definition.key,
              title: definition.title,
              href:
                createCategoryClickHref(
                  category.id
                ),
              categoryId:
                category.id,

              /*
               * 대표 문서 ID는 WikiPageInner에서
               * 실제 category.document_id로 확정한다.
               */
              documentId: null,
            };
          }
        );
      }
    );
  } catch (error) {
    console.error(
      '[home] 카테고리 링크 조회 실패:',
      error
    );

    return createEmptyCategoryLinks();
  }
}
