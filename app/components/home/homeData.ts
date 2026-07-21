// =============================================
// File: app/components/home/homeData.ts
// 전체 교체용 코드
//
// 대표 카테고리 연결 방식:
// 1. 모든 카테고리를 조회한다.
// 2. 실제 카테고리 트리와 동일하게 부모를 따라가며 RPG 영역인지 판별한다.
// 3. 정식 이름(컨텐츠 / 시스템 / 시세표 / 법전)의 카테고리를 찾는다.
// 4. categories.document_id가 있으면 대표 문서를 사용한다.
// 5. 대표 문서가 없으면 해당 카테고리 하위에서 정렬상 첫 문서를 사용한다.
// 6. /wiki?id=문서ID&mode=RPG 로 이동한다.
//    WikiPageInner는 id가 있으면 id를 최우선으로 직접 로드한다.
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
  document_id: number | string | null;
  mode_tags: string[] | null;
  order: number | string | null;
};

type DocumentRow = {
  id: number | string;
  title: string;
  path: string | number | null;
  order: number | string | null;
  is_featured: boolean | null;
};

type NormalizedCategory = {
  id: number;
  name: string;
  parentId: number | null;
  documentId: number | null;
  modeTags: string[];
  order: number;
};

type NormalizedDocument = {
  id: number;
  title: string;
  categoryId: number | null;
  order: number;
  isFeatured: boolean;
};

const ROOT_FEATURED_DOCUMENT_ID = 73;
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

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
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

function normalizeName(value: string) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '');
}

function normalizeModeTag(value: string) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

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

function createWikiDocumentHref(
  documentId: number
) {
  const searchParams =
    new URLSearchParams({
      id: String(documentId),
      mode: HOME_MODE,
    });

  return `/wiki?${searchParams.toString()}`;
}

function createRecentDocumentHref(
  id: number,
  path: string | number | null,
  title: string
) {
  const searchParams =
    new URLSearchParams({
      id: String(id),
      path: String(path ?? 0),
      title,
      mode: HOME_MODE,
    });

  return `/wiki?${searchParams.toString()}`;
}

function createEmptyCategoryLinks(): HomeCategoryLink[] {
  return HOME_CATEGORY_DEFINITIONS.map(
    (definition) => ({
      key: definition.key,
      title: definition.title,
      href: '/wiki',
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
          documentId:
            toPositiveInteger(
              row.document_id
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

function normalizeDocuments(
  rows: DocumentRow[]
): NormalizedDocument[] {
  return rows
    .map(
      (
        row
      ): NormalizedDocument | null => {
        const id =
          toPositiveInteger(row.id);
        const title = String(
          row.title ?? ''
        ).trim();

        if (
          !id ||
          !title ||
          id ===
            ROOT_FEATURED_DOCUMENT_ID
        ) {
          return null;
        }

        return {
          id,
          title,
          categoryId:
            toPositiveInteger(
              row.path
            ),
          order:
            toFiniteOrder(
              row.order
            ),
          isFeatured:
            Boolean(
              row.is_featured
            ),
        };
      }
    )
    .filter(
      (
        document
      ): document is NormalizedDocument =>
        document !== null &&
        !document.isFeatured
    );
}

function getCategoryDepth(
  category: NormalizedCategory,
  categoryById: Map<
    number,
    NormalizedCategory
  >
) {
  let depth = 0;
  let cursor:
    | NormalizedCategory
    | undefined = category;
  const visited = new Set<number>();

  while (
    cursor?.parentId &&
    !visited.has(cursor.id)
  ) {
    visited.add(cursor.id);
    depth += 1;
    cursor = categoryById.get(
      cursor.parentId
    );
  }

  return depth;
}

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
  let cursor:
    | NormalizedCategory
    | undefined = category;
  const visited = new Set<number>();

  while (
    cursor &&
    !visited.has(cursor.id)
  ) {
    visited.add(cursor.id);

    if (
      cursor.modeTags.includes(
        normalizedMode
      )
    ) {
      return true;
    }

    cursor = cursor.parentId
      ? categoryById.get(
          cursor.parentId
        )
      : undefined;
  }

  return false;
}

function isCategoryInsideTarget(
  categoryId: number | null,
  targetCategoryId: number,
  categoryById: Map<
    number,
    NormalizedCategory
  >
) {
  if (!categoryId) {
    return false;
  }

  let cursor =
    categoryById.get(categoryId);
  const visited = new Set<number>();

  while (
    cursor &&
    !visited.has(cursor.id)
  ) {
    if (
      cursor.id ===
      targetCategoryId
    ) {
      return true;
    }

    visited.add(cursor.id);
    cursor = cursor.parentId
      ? categoryById.get(
          cursor.parentId
        )
      : undefined;
  }

  return false;
}

function getDistanceFromTarget(
  categoryId: number | null,
  targetCategoryId: number,
  categoryById: Map<
    number,
    NormalizedCategory
  >
) {
  if (!categoryId) {
    return Number.MAX_SAFE_INTEGER;
  }

  let distance = 0;
  let cursor =
    categoryById.get(categoryId);
  const visited = new Set<number>();

  while (
    cursor &&
    !visited.has(cursor.id)
  ) {
    if (
      cursor.id ===
      targetCategoryId
    ) {
      return distance;
    }

    visited.add(cursor.id);
    distance += 1;
    cursor = cursor.parentId
      ? categoryById.get(
          cursor.parentId
        )
      : undefined;
  }

  return Number.MAX_SAFE_INTEGER;
}

function selectTargetCategory(
  title: string,
  categories: NormalizedCategory[],
  categoryById: Map<
    number,
    NormalizedCategory
  >
) {
  const normalizedTitle =
    normalizeName(title);

  const candidates =
    categories.filter(
      (category) =>
        normalizeName(
          category.name
        ) === normalizedTitle
    );

  candidates.sort(
    (first, second) => {
      const firstInRpg =
        isCategoryInMode(
          first,
          categoryById,
          HOME_MODE
        );
      const secondInRpg =
        isCategoryInMode(
          second,
          categoryById,
          HOME_MODE
        );

      if (
        firstInRpg !==
        secondInRpg
      ) {
        return firstInRpg
          ? -1
          : 1;
      }

      const firstHasRepresentative =
        first.documentId !== null;
      const secondHasRepresentative =
        second.documentId !== null;

      if (
        firstHasRepresentative !==
        secondHasRepresentative
      ) {
        return firstHasRepresentative
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

      if (depthDifference !== 0) {
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

      return first.id - second.id;
    }
  );

  return candidates[0] ?? null;
}

function selectTargetDocument(
  category: NormalizedCategory,
  documents: NormalizedDocument[],
  documentById: Map<
    number,
    NormalizedDocument
  >,
  categoryById: Map<
    number,
    NormalizedCategory
  >
) {
  if (category.documentId) {
    const representative =
      documentById.get(
        category.documentId
      );

    if (representative) {
      return representative;
    }
  }

  const subtreeDocuments =
    documents.filter(
      (document) =>
        isCategoryInsideTarget(
          document.categoryId,
          category.id,
          categoryById
        )
    );

  subtreeDocuments.sort(
    (first, second) => {
      const firstDistance =
        getDistanceFromTarget(
          first.categoryId,
          category.id,
          categoryById
        );
      const secondDistance =
        getDistanceFromTarget(
          second.categoryId,
          category.id,
          categoryById
        );

      if (
        firstDistance !==
        secondDistance
      ) {
        return (
          firstDistance -
          secondDistance
        );
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

      const titleDifference =
        first.title.localeCompare(
          second.title,
          'ko'
        );

      if (titleDifference !== 0) {
        return titleDifference;
      }

      return first.id - second.id;
    }
  );

  return subtreeDocuments[0] ?? null;
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
                d.updated_at
                  IS NOT NULL
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
      'home:category-links:v5',
      {
        ttlSec: 60,
        tags: [
          'category:list',
          'category:tree',
          'doc:list',
        ],
      },
      async () => {
        const [
          rawCategories,
          rawDocuments,
        ] = await Promise.all([
          runDbRead(
            'home:category-links:categories',
            async () => {
              return await sql`
                SELECT
                  id,
                  name,
                  parent_id,
                  document_id,
                  mode_tags,
                  "order"
                FROM categories
                ORDER BY
                  parent_id,
                  "order",
                  id
              `;
            }
          ),
          runDbRead(
            'home:category-links:documents',
            async () => {
              return await sql`
                SELECT
                  id,
                  title,
                  path,
                  "order",
                  is_featured
                FROM documents
              `;
            }
          ),
        ]);

        const categories =
          normalizeCategories(
            rawCategories as unknown as CategoryRow[]
          );
        const documents =
          normalizeDocuments(
            rawDocuments as unknown as DocumentRow[]
          );

        const categoryById =
          new Map(
            categories.map(
              (category) => [
                category.id,
                category,
              ]
            )
          );
        const documentById =
          new Map(
            documents.map(
              (document) => [
                document.id,
                document,
              ]
            )
          );

        return HOME_CATEGORY_DEFINITIONS.map(
          (definition) => {
            const category =
              selectTargetCategory(
                definition.title,
                categories,
                categoryById
              );

            if (!category) {
              console.error(
                `[home] 카테고리를 찾지 못했습니다: ${definition.title}`
              );

              return {
                key: definition.key,
                title: definition.title,
                href: '/wiki',
                categoryId: null,
                documentId: null,
              };
            }

            const document =
              selectTargetDocument(
                category,
                documents,
                documentById,
                categoryById
              );

            if (!document) {
              console.error(
                `[home] 카테고리 하위에서 열 문서를 찾지 못했습니다: ${definition.title}`,
                {
                  categoryId:
                    category.id,
                  representativeDocumentId:
                    category.documentId,
                }
              );

              return {
                key: definition.key,
                title: definition.title,
                href: '/wiki',
                categoryId:
                  category.id,
                documentId: null,
              };
            }

            return {
              key: definition.key,
              title: definition.title,
              href:
                createWikiDocumentHref(
                  document.id
                ),
              categoryId:
                category.id,
              documentId:
                document.id,
            };
          }
        );
      }
    );
  } catch (error) {
    console.error(
      '[home] 대표 카테고리 연결 조회 실패:',
      error
    );

    return createEmptyCategoryLinks();
  }
}